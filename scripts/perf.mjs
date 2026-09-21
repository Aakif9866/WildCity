// Browser performance measurements (real Chrome, software GL). Usage: npm run perf [-- --json]
// Software rendering makes absolute FPS meaningless for GPUs; use it for relative comparisons,
// load-time, memory, draw calls and long-task counts. Measure real FPS on a device with ?stats.
import { spawn } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { chromium } from 'playwright-core'

const PORT = 4174
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const json = process.argv.includes('--json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const kb = (n) => +(n / 1024).toFixed(1)
const mb = (n) => +(n / 1048576).toFixed(1)
const pct = (arr, p) =>
  arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))]

// ---- static assets ----
const assets = []
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = `${dir}/${f}`
    if (statSync(p).isDirectory()) walk(p)
    else {
      const buf = readFileSync(p)
      assets.push({
        file: p.replace('dist/', ''),
        raw: buf.length,
        gzip: gzipSync(buf).length,
        brotli: brotliCompressSync(buf).length,
      })
    }
  }
}
walk('dist')
const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0)
const code = assets.filter((a) => /\.(js|css)$/.test(a.file))

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-precise-memory-info',
  ],
})
const results = []
try {
  for (let i = 0; i < 40; i++) {
    if (
      await fetch(`http://localhost:${PORT}`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break
    await sleep(250)
  }

  for (const city of (process.env.PERF_CITIES ?? 'demo,hyderabad,bengaluru,london').split(',')) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await page.addInitScript(() => {
      window.__long = []
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => window.__long.push(e.duration)),
      ).observe({ entryTypes: ['longtask'] })
    })
    const t0 = Date.now()
    await page.goto(`http://localhost:${PORT}/?debug&city=${city}&hour=12&quality=fixed`)
    await page.getByRole('button', { name: /Explore/ }).waitFor()
    const menuMs = Date.now() - t0
    const jsAtMenu = await page.evaluate(
      () => performance.getEntriesByType('resource').filter((r) => r.name.endsWith('.js')).length,
    )

    // Real players spend a moment on the menu; PERF_MENU_WAIT (ms) simulates that so the 3D chunk prefetch can finish.
    await sleep(Number(process.env.PERF_MENU_WAIT ?? 0))
    const t1 = Date.now()
    await page.getByRole('button', { name: /Explore/ }).click()
    await page.waitForFunction(() => !!window.__wildcity?.session, null, { timeout: 90000 })
    const loadMs = Date.now() - t1
    await page.evaluate(() => {
      const S = window.__wildcity.session
      S.clock.daySeconds = 1e9
      window.__long.length = 0
    })
    await sleep(1500)
    const heapLoad = await page.evaluate(() => performance.memory.usedJSHeapSize)

    // Frame pacing while standing, then running (uses rAF timestamps).
    const pace = (ms) =>
      page.evaluate(
        (ms) =>
          new Promise((resolve) => {
            const dts = []
            let last = performance.now()
            const end = last + ms
            const tick = (t) => {
              dts.push(t - last)
              last = t
              if (t < end) requestAnimationFrame(tick)
              else resolve(dts)
            }
            requestAnimationFrame(tick)
          }),
        ms,
      )
    const idle = await pace(4000)
    await page.keyboard.down('ShiftLeft')
    await page.keyboard.down('KeyW')
    const run = await pace(4000)
    await page.keyboard.up('KeyW')
    await page.keyboard.up('ShiftLeft')

    const info = await page.evaluate(() => window.__wildcity.renderInfo())
    const heapPlay = await page.evaluate(() => performance.memory.usedJSHeapSize)
    const long = await page.evaluate(() => window.__long)
    const fps = (d) => +((d.length / d.reduce((s, v) => s + v, 0)) * 1000).toFixed(1)
    results.push({
      city,
      'menu ms': menuMs,
      'js files at menu': jsAtMenu,
      'load ms (click->world)': loadMs,
      'heap MB (loaded)': mb(heapLoad),
      'heap MB (after run)': mb(heapPlay),
      'draw calls': info.calls,
      triangles: info.triangles,
      geometries: info.geometries,
      'fps idle (sw GL)': fps(idle),
      'fps run (sw GL)': fps(run),
      'frame p95 ms': +pct([...idle, ...run], 0.95).toFixed(1),
      'long tasks >50ms': long.length,
      'longest task ms': long.length ? Math.round(Math.max(...long)) : 0,
    })
    await page.close()
  }

  // Leak check: enter and quit the same city repeatedly; heap and GPU resources must not climb.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(`http://localhost:${PORT}/?debug&city=london&hour=12&quality=fixed`)
  const cycles = []
  for (let n = 0; n < 4; n++) {
    await page.getByRole('button', { name: /Explore/ }).click()
    await page.waitForFunction(() => !!window.__wildcity?.session, null, { timeout: 90000 })
    await sleep(1200)
    const r = await page.evaluate(() => ({ ...window.__wildcity.renderInfo() }))
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Quit to menu' }).click()
    await page.getByRole('button', { name: /Explore/ }).waitFor()
    await page.evaluate(() => window.gc?.())
    cycles.push({
      cycle: n + 1,
      geometries: r.geometries,
      textures: r.textures,
      'heap MB': mb(await page.evaluate(() => performance.memory.usedJSHeapSize)),
    })
  }
  await page.close()

  const report = {
    bundle: {
      'JS+CSS raw KB': kb(sum(code, 'raw')),
      'JS+CSS gzip KB': kb(sum(code, 'gzip')),
      'JS+CSS brotli KB': kb(sum(code, 'brotli')),
    },
    files: code.map((a) => ({
      file: a.file,
      'raw KB': kb(a.raw),
      'gzip KB': kb(a.gzip),
      'brotli KB': kb(a.brotli),
    })),
    data: assets
      .filter((a) => !/\.(js|css|html)$/.test(a.file))
      .map((a) => ({ file: a.file, 'raw KB': kb(a.raw), 'gzip KB': kb(a.gzip) })),
    runtime: results,
    leakCheck: cycles,
  }
  if (json) console.log(JSON.stringify(report, null, 2))
  else {
    console.log('Bundle:', report.bundle)
    console.table(report.files)
    console.table(report.data)
    console.table(report.runtime)
    console.log('Enter/quit leak check (London):')
    console.table(report.leakCheck)
  }
} finally {
  await browser.close()
  server.kill()
}
