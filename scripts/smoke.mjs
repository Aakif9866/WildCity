// Browser smoke test: builds nothing itself; run `npm run smoke` (builds, serves, drives Chrome).
// Usage: node scripts/smoke.mjs [--phase N]. Checks are cumulative up to the given phase.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const PHASE = Number(process.argv[process.argv.indexOf('--phase') + 1]) || 99
const OUT = process.env.SMOKE_OUT ?? 'smoke-out'
const PORT = 4173
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})
const browser = await chromium
  .launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
    ],
  })
  .catch((e) => {
    server.kill()
    throw e
  })

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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto(`http://localhost:${PORT}/?debug`)
  check('menu renders', await page.getByText('WILDCITY').first().isVisible())
  await page.screenshot({ path: `${OUT}/menu.png` })

  await page.getByRole('button', { name: 'Explore' }).click()
  await page.waitForSelector('canvas')
  await sleep(2500)
  await page.screenshot({ path: `${OUT}/phase1-world.png` })

  const info = await page.evaluate(() => window.__wildcity?.renderInfo())
  check('canvas renders geometry', !!info && info.triangles > 1000, JSON.stringify(info))
  check('draw calls stay low', !!info && info.calls > 0 && info.calls < 40, `calls=${info?.calls}`)

  check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  void PHASE
} finally {
  await browser.close()
  server.kill()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed`)
process.exit(failed.length ? 1 : 0)
