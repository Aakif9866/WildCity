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
  const warnings = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
    if (m.type() === 'warning') warnings.push(m.text())
  })

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

  // ---- Phase 2: player ----
  const P = () =>
    page.evaluate(() => {
      const { player, camera, world } = window.__wildcity.session
      return {
        x: player.x,
        y: player.y,
        z: player.z,
        cx: camera.px,
        cy: camera.py,
        cz: camera.pz,
        inB: !!world.buildingAt(player.x, player.z),
      }
    })
  const hold = async (keys, ms) => {
    for (const k of keys) await page.keyboard.down(k)
    await sleep(ms)
    for (const k of keys.slice().reverse()) await page.keyboard.up(k)
  }
  const teleport = (x, z, yaw) =>
    page.evaluate(
      ([x, z, yaw]) => {
        const { player, camera } = window.__wildcity.session
        player.x = x
        player.z = z
        player.vx = player.vz = 0
        camera.yaw = yaw
      },
      [x, z, yaw],
    )

  const p0 = await P()
  check(
    'spawns near the configured spawn point',
    Math.abs(p0.x) < 1 && Math.abs(p0.z - 20) < 1,
    JSON.stringify(p0),
  )
  await hold(['KeyW'], 1200)
  const p1 = await P()
  check('W walks the player forward', p1.z < p0.z - 2, `dz=${(p1.z - p0.z).toFixed(1)}`)

  await teleport(0, 100, 0)
  await hold(['KeyW'], 1000)
  const walkD = 100 - (await P()).z
  await teleport(0, 100, 0)
  await hold(['ShiftLeft', 'KeyW'], 1000)
  const runD = 100 - (await P()).z
  check(
    'Shift makes the player run faster',
    runD > walkD * 1.3,
    `walk=${walkD.toFixed(1)} run=${runD.toFixed(1)}`,
  )

  await teleport(0, 100, 0)
  await sleep(300)
  await page.keyboard.down('Space')
  await sleep(250)
  const airborne = await P()
  await page.keyboard.up('Space')
  await sleep(1200)
  const landed = await P()
  check(
    'Space jumps and player lands back on ground',
    airborne.y > 0.5 && landed.y === 0,
    `peak~${airborne.y.toFixed(2)} end=${landed.y}`,
  )

  // Run straight at the first building from the west; must stop at its wall.
  const wall = await page.evaluate(() => {
    const b = window.__wildcity.session.city.buildings.find((b) => b.height > 10)
    const xs = b.footprint.map((p) => p[0]),
      zs = b.footprint.map((p) => p[1])
    return { minX: Math.min(...xs), z: (Math.min(...zs) + Math.max(...zs)) / 2 }
  })
  await teleport(wall.minX - 6, wall.z, -Math.PI / 2)
  let inside = false
  const tRun = Date.now()
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  while (Date.now() - tRun < 2500) {
    const pp = await P()
    if (pp.inB) inside = true
    await sleep(60)
  }
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  const atWall = await P()
  check(
    'player cannot walk through a building',
    !inside && atWall.x <= wall.minX,
    `x=${atWall.x.toFixed(2)} wallX=${wall.minX.toFixed(2)}`,
  )
  const camInside = await page.evaluate(() => {
    const { camera, world } = window.__wildcity.session
    return world.isSolidAt(camera.px, camera.py, camera.pz)
  })
  check('camera does not clip into buildings', !camInside)
  await page.screenshot({ path: `${OUT}/phase2-wall.png` })

  await teleport(240, 0, -Math.PI / 2)
  await hold(['ShiftLeft', 'KeyW'], 2000)
  const edge = await P()
  check('player stays inside the map bounds', Math.abs(edge.x) <= 250, `x=${edge.x.toFixed(1)}`)

  await teleport(0, 20, 0)
  await sleep(1200)
  await page.screenshot({ path: `${OUT}/phase2-play.png` })

  await page.keyboard.press('Escape')
  await sleep(200)
  check('Escape opens the pause menu', await page.getByText('PAUSED').isVisible())
  const paused0 = await P()
  await hold(['KeyW'], 500)
  check('player does not move while paused', Math.abs((await P()).z - paused0.z) < 0.01)
  await page.getByRole('button', { name: 'Resume' }).click()
  await sleep(200)
  check('Resume closes the pause menu', !(await page.getByText('PAUSED').isVisible()))

  // ---- Phase 3: first animal ----
  const glb = await page.evaluate(async () => {
    const r = await fetch('/models/dog.glb')
    const buf = new Uint8Array(await r.arrayBuffer())
    return { ok: r.ok, size: buf.length, magic: String.fromCharCode(...buf.slice(0, 4)) }
  })
  check(
    'dog.glb is served as a real GLB',
    glb.ok && glb.magic === 'glTF' && glb.size > 1000,
    JSON.stringify(glb),
  )

  await teleport(0, 20, 0)
  const dogStart = await page.evaluate(() => {
    const a = window.__wildcity.session.animals
    return a.map((d) => ({ id: d.id, x: d.position.x, z: d.position.z }))
  })
  check(
    'a dog is spawned',
    dogStart.length >= 1 && dogStart[0].id.startsWith('dog'),
    JSON.stringify(dogStart),
  )

  const seen = new Set()
  let dogInside = false
  let moved = 0
  const tDog = Date.now()
  while (Date.now() - tDog < 14000) {
    const d = await page.evaluate(() => {
      const { animals, world } = window.__wildcity.session
      const a = animals[0]
      return {
        s: a.state,
        x: a.position.x,
        z: a.position.z,
        inB: !!world.buildingAt(a.position.x, a.position.z),
      }
    })
    seen.add(d.s)
    if (d.inB) dogInside = true
    moved = Math.max(moved, Math.hypot(d.x - dogStart[0].x, d.z - dogStart[0].z))
    await sleep(200)
  }
  check(
    'dog wanders independently (IDLE and WANDER, moves away)',
    seen.has('IDLE') && seen.has('WANDER') && moved > 4,
    `states=${[...seen]} moved=${moved.toFixed(1)}m`,
  )
  check('dog never enters a building', !dogInside)

  // Frame the dog for a screenshot.
  await page.evaluate(() => {
    const { animals, player, camera } = window.__wildcity.session
    const d = animals[0].position
    player.x = d.x
    player.z = d.z + 2.5
    player.vx = player.vz = 0
    camera.yaw = 0
    camera.pitch = 0.45
    camera.distance = 7
  })
  await sleep(1500)
  await page.screenshot({ path: `${OUT}/phase3-dog.png` })
  check(
    'GLB model loaded without fallback warning',
    !warnings.some((w) => w.includes('failed to load')),
    warnings.join('|'),
  )

  check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  void PHASE
} finally {
  await browser.close()
  server.kill()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed`)
process.exit(failed.length ? 1 : 0)
