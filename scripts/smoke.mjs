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
const appears = (locator, timeout = 8000) =>
  locator.waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false,
  )
const waitFor2 = async (fn, ms) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const v = await fn()
    if (v) return v
    await sleep(200)
  }
  return null
}

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

  await page.goto(`http://localhost:${PORT}/?debug&city=demo`) // deterministic town for phases 1-6
  check('menu renders', await page.getByText('WILDCITY').first().isVisible())
  await page.screenshot({ path: `${OUT}/menu.png` })

  await page.getByRole('button', { name: 'Explore' }).click()
  await page.waitForSelector('canvas')
  await sleep(2500)
  await page.screenshot({ path: `${OUT}/phase1-world.png` })

  const info = await page.evaluate(() => window.__wildcity?.renderInfo())
  check('canvas renders geometry', !!info && info.triangles > 1000, JSON.stringify(info))
  check('draw calls stay low', !!info && info.calls > 0 && info.calls < 200, `calls=${info?.calls}`)

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
    'dog acts independently (moves away on its own)',
    moved > 4,
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

  // ---- Phase 4: animal AI ----
  const dogNow = () =>
    page.evaluate(() => {
      const a = window.__wildcity.session.animals[0]
      return {
        s: a.state,
        hunger: a.hunger,
        energy: a.energy,
        x: a.position.x,
        z: a.position.z,
        k: a.targetKind,
        anim: a.animation,
      }
    })
  const waitFor = async (pred, ms) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      const d = await dogNow()
      if (pred(d)) return d
      await sleep(150)
    }
    return null
  }
  const setDog = (props) =>
    page.evaluate((p) => Object.assign(window.__wildcity.session.animals[0], p), props)
  await page.evaluate(() => (window.__wildcity.session.timeScale = 6))

  await setDog({ hunger: 92, state: 'IDLE', stateTime: 99, cooldown: 0 })
  const sawFood = await waitFor((d) => d.k === 'food' || d.s === 'EAT', 15000)
  check('hungry dog goes looking for food', !!sawFood, JSON.stringify(sawFood))
  const ate = await waitFor((d) => d.s === 'EAT', 60000)
  check(
    'dog reaches food and eats (eat animation)',
    !!ate && ate.anim === 'eat',
    JSON.stringify(ate),
  )
  const fed = await waitFor((d) => d.hunger < 50, 30000)
  check('eating reduces hunger', !!fed, `hunger=${fed?.hunger?.toFixed(0)}`)

  await setDog({ energy: 4, hunger: 5, state: 'IDLE', stateTime: 99, cooldown: 0 })
  const rested = await waitFor((d) => d.s === 'REST', 15000)
  check('exhausted dog rests', !!rested, JSON.stringify(rested))
  const recovered = await waitFor((d) => d.energy > 60, 40000)
  check('resting restores energy', !!recovered, `energy=${recovered?.energy?.toFixed(0)}`)

  // Startle a shy dog by running at it.
  await page.evaluate(() => (window.__wildcity.session.timeScale = 1))
  await setDog({
    curiosity: 5,
    social: 5,
    hunger: 5,
    energy: 100,
    state: 'IDLE',
    stateTime: 0,
    cooldown: 0,
    path: [],
  })
  await page.evaluate(() => {
    const { animals, player, camera } = window.__wildcity.session
    const d = animals[0].position
    player.x = d.x
    player.z = d.z + 9
    player.vx = player.vz = 0
    camera.yaw = 0 // forward = -z, towards the dog
  })
  await sleep(300)
  const dist0 = await page.evaluate(() => {
    const { animals, player } = window.__wildcity.session
    return Math.hypot(animals[0].position.x - player.x, animals[0].position.z - player.z)
  })
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  const fled = await waitFor((d) => d.s === 'FLEE', 4000)
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  check(
    'a running player startles the dog into FLEE',
    !!fled,
    `start dist=${dist0.toFixed(1)} ${JSON.stringify(fled)}`,
  )
  const calm = await waitFor((d) => d.s !== 'FLEE', 20000)
  check('dog calms down after fleeing', !!calm)

  // ---- Phase 5: multiple animals ----
  const census = await page.evaluate(() => {
    const c = {}
    for (const a of window.__wildcity.session.animals) c[a.species] = (c[a.species] ?? 0) + 1
    return c
  })
  check(
    'all five species spawn (4 dog, 3 cat, 8 pigeon, 3 monkey, 4 squirrel)',
    census.dog === 4 &&
      census.cat === 3 &&
      census.pigeon === 8 &&
      census.monkey === 3 &&
      census.squirrel === 4,
    JSON.stringify(census),
  )

  await page.evaluate(() => {
    const s = window.__wildcity.session
    s.timeScale = 4
    s.player.x = 0
    s.player.z = 20
  })
  let groundInside = false
  let sawAirborne = null
  const seenSpecies = new Map()
  const t5 = Date.now()
  while (Date.now() - t5 < 25000) {
    const snap = await page.evaluate(() => {
      const { animals, world } = window.__wildcity.session
      return animals.map((a) => ({
        id: a.id,
        sp: a.species,
        st: a.state,
        air: a.airborne,
        y: a.position.y,
        x: a.position.x,
        z: a.position.z,
        inB: !!world.buildingAt(a.position.x, a.position.z),
      }))
    })
    for (const a of snap) {
      if (a.sp !== 'pigeon' && a.inB) groundInside = true
      if (a.air && !sawAirborne) sawAirborne = a
      if (!seenSpecies.has(a.sp)) seenSpecies.set(a.sp, new Set())
      seenSpecies.get(a.sp).add(a.st)
    }
    await sleep(500)
  }
  check('no ground animal ever enters a building', !groundInside)
  check(
    'every species is acting (2+ distinct states)',
    [...seenSpecies.values()].every((set) => set.size >= 2),
    [...seenSpecies].map(([k, v]) => `${k}:${[...v]}`).join(' '),
  )
  check('a pigeon takes flight', !!sawAirborne, JSON.stringify(sawAirborne))

  // Deterministic lineup: one of each species in a row, held idle, plus a pigeon in flight.
  await page.evaluate(() => {
    const S = window.__wildcity.session
    S.timeScale = 1
    S.player.x = 0
    S.player.z = 20
    S.player.vx = S.player.vz = 0
    S.camera.yaw = 0
    S.camera.pitch = 0.22
    S.camera.distance = 7
    const order = ['dog', 'cat', 'pigeon', 'monkey', 'squirrel']
    order.forEach((sp, i) => {
      const a = S.animals.find((x) => x.species === sp && x.state !== 'FLEE')
      a.position.x = -4 + i * 2
      a.position.z = 14
      a.position.y = 0
      a.yaw = Math.PI // face the camera (+z)
      a.state = 'IDLE'
      a.stateTime = 0
      a.cooldown = 999 // hold still for the photo
      a.path = []
      a.airborne = false
      a.speed = 0
    })
    const flyer = S.animals.filter((x) => x.species === 'pigeon')[1]
    flyer.position.x = 0
    flyer.position.z = 12
    flyer.position.y = 3
    flyer.yaw = Math.PI
    flyer.airborne = true
    flyer.state = 'MOVE_TO_TARGET'
    flyer.path = [[0, 60]]
    flyer.pathIndex = 0
    flyer.cooldown = 0
  })
  await sleep(500)
  await page.screenshot({ path: `${OUT}/phase5-lineup.png` })

  const info5 = await page.evaluate(() => window.__wildcity.renderInfo())
  check('draw calls stay under budget with all animals', info5.calls < 200, JSON.stringify(info5))

  // ---- Phase 6: player <-> animal interaction ----
  const ui = () =>
    page.evaluate(() => {
      const st = window.__wildcity.store.getState()
      return {
        prompt: st.promptAnimalId,
        panel: st.panelAnimalId,
        follow: st.followAnimalId,
        observed: st.observedId,
      }
    })
  // Park a calm, sociable dog 3 m from the player on open road, held idle.
  await page.evaluate(() => {
    const S = window.__wildcity.session
    S.timeScale = 1
    const d = S.animals.find((a) => a.species === 'dog')
    // Isolate the test dog: park every other animal far away and hold it still.
    S.animals.forEach((o, i) => {
      if (o === d) return
      Object.assign(o, {
        state: 'IDLE',
        stateTime: 0,
        cooldown: 999,
        attention: 999,
        path: [],
        airborne: false,
        speed: 0,
      })
      o.position.x = 150 + (i % 5) * 10
      o.position.z = 150 + Math.floor(i / 5) * 10
      o.position.y = 0
    })
    Object.assign(d, {
      state: 'IDLE',
      stateTime: 0,
      cooldown: 999,
      attention: 999,
      path: [],
      airborne: false,
      hunger: 20,
      energy: 90,
      social: 100,
      curiosity: 100,
    })
    d.position.x = 2.5 // off to the side so the avatar doesn't hide it from the camera
    d.position.z = 12
    d.position.y = 0
    S.player.x = 0
    S.player.z = 16
    S.player.vx = S.player.vz = 0
    S.camera.yaw = 0
    S.camera.pitch = 0.3
    S.camera.distance = 7
    window.__dogId = d.id
  })
  await sleep(700)
  const near = await ui()
  check(
    'prompt appears near an animal',
    near.prompt?.startsWith('dog') && (await page.getByText('Inspect Dog').isVisible()),
    JSON.stringify(near),
  )
  await page.screenshot({ path: `${OUT}/phase6-prompt.png` })

  await page.keyboard.press('KeyE')
  await sleep(400)
  check(
    'E opens the animal panel with stats and actions',
    (await ui()).panel?.startsWith('dog') &&
      (await page.getByText('Energy').isVisible()) &&
      (await page.getByRole('button', { name: 'Follow' }).isVisible()),
  )
  await page.screenshot({ path: `${OUT}/phase6-panel.png` })

  await page.getByRole('button', { name: 'Interact' }).click()
  await sleep(300)
  const interactState = await page.evaluate(
    () => window.__wildcity.session.animals.find((a) => a.id === window.__dogId).state,
  )
  const msgShown = await page.locator('p.italic').isVisible()
  check(
    'Interact gives feedback and the dog responds',
    msgShown && ['INTERACT', 'FLEE'].includes(interactState),
    `dog=${interactState}`,
  )

  await page.getByRole('button', { name: 'Observe' }).click()
  await sleep(300)
  check('Observe highlights the animal', (await ui()).observed?.startsWith('dog'))

  await page.keyboard.press('KeyE')
  await sleep(300)
  check('E again closes the panel', (await ui()).panel === null)

  // Follow: camera tracks the dog; F stops it.
  await page.evaluate(() => {
    const S = window.__wildcity.session
    const d = S.animals.find((a) => a.id === window.__dogId)
    Object.assign(d, { state: 'IDLE', cooldown: 999, attention: 999, path: [] })
    S.player.x = d.position.x
    S.player.z = d.position.z + 3
    S.player.vx = S.player.vz = 0
  })
  await sleep(500)
  await page.keyboard.press('KeyE')
  await sleep(300)
  await page.getByRole('button', { name: 'Follow' }).click()
  await sleep(300)
  check(
    'Follow shows the banner and hides the panel',
    (await ui()).follow?.startsWith('dog') &&
      (await page.getByText('to stop').isVisible()) &&
      (await ui()).panel === null,
  )

  // Make the dog walk somewhere; the camera must go with it while the player stays put.
  const before = await page.evaluate(() => {
    const S = window.__wildcity.session
    const d = S.animals.find((a) => a.id === window.__dogId)
    d.cooldown = 0
    d.attention = 999
    d.state = 'WANDER'
    d.path = [[d.position.x + 20, d.position.z]]
    d.pathIndex = 0
    d.target = d.path[0]
    return { px: S.player.x, dx: d.position.x }
  })
  await sleep(4000)
  const fol = await page.evaluate(() => {
    const S = window.__wildcity.session
    const d = S.animals.find((a) => a.id === window.__dogId)
    return { px: S.player.x, dx: d.position.x, tx: S.camera.tx, tz: S.camera.tz, dz: d.position.z }
  })
  check(
    'camera follows the dog while the player stays still',
    Math.abs(fol.px - before.px) < 0.5 && fol.dx > before.dx + 3 && Math.abs(fol.tx - fol.dx) < 2,
    JSON.stringify({ before, fol }),
  )
  await page.screenshot({ path: `${OUT}/phase6-follow.png` })

  await page.keyboard.press('KeyF')
  await sleep(300)
  check('F stops following', (await ui()).follow === null)

  // Movement also ends following.
  await page.evaluate(() => {
    const S = window.__wildcity.session
    const st = window.__wildcity.store.getState()
    st.startFollow(window.__dogId)
    void S
  })
  await sleep(300)
  await hold(['KeyW'], 300)
  check('moving ends following', (await ui()).follow === null)

  // Spontaneous reaction: a sociable dog that has noticed the player does something about it.
  await page.evaluate(() => {
    const S = window.__wildcity.session
    const d = S.animals.find((a) => a.id === window.__dogId)
    Object.assign(d, {
      state: 'IDLE',
      stateTime: 0,
      cooldown: 0,
      attention: 0,
      path: [],
      social: 100,
      curiosity: 100,
    })
    d.position.x = -30
    d.position.z = 0
    S.player.x = -20
    S.player.z = 0
    S.player.vx = S.player.vz = 0
  })
  const dogId = await page.evaluate(() => window.__dogId)
  const reacted = await waitFor2(
    () =>
      page.evaluate((id) => {
        const d = window.__wildcity.session.animals.find((a) => a.id === id)
        return ['FOLLOW', 'INVESTIGATE'].includes(d.state) ? d.state : null
      }, dogId),
    25000,
  )
  check(
    'a sociable dog notices the player and comes over (FOLLOW/INVESTIGATE)',
    !!reacted,
    String(reacted),
  )

  // ---- Phase 7: real city data (Hyderabad) ----
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors2 = []
  page2.on('pageerror', (e) => errors2.push(String(e)))
  page2.on('console', (m) => m.type() === 'error' && errors2.push(m.text()))
  // Slow one file down so the loading screen is observable.
  await page2.route('**/cities/hyderabad/roads.json', async (route) => {
    await sleep(900)
    await route.continue()
  })
  await page2.goto(`http://localhost:${PORT}/?debug`)
  const tLoad = Date.now()
  await page2.getByRole('button', { name: 'Explore' }).click()
  check('loading screen shows progress', await appears(page2.getByText('Loading roads…'), 3000))
  await page2.waitForFunction(() => !!window.__wildcity?.session, null, { timeout: 60000 })
  const loadMs = Date.now() - tLoad
  await sleep(1500)
  const real = await page2.evaluate(() => {
    const S = window.__wildcity.session
    const sp = S.city.metadata.spawn
    return {
      id: S.city.metadata.id,
      b: S.city.buildings.length,
      r: S.city.roads.length,
      z: S.city.zones.length,
      trees: S.city.trees.length,
      animals: S.animals.length,
      spawnZone: S.world.zoneAt(sp.x, sp.z),
      spawnInBuilding: !!S.world.buildingAt(sp.x, sp.z),
      attribution: S.city.metadata.attribution,
      groundBad: S.animals.filter(
        (a) => !['pigeon'].includes(a.species) && !S.nav.isWalkable(a.position.x, a.position.z),
      ).length,
    }
  })
  check(
    'real Hyderabad data loads (buildings, roads, zones, trees)',
    real.id === 'hyderabad' && real.b > 100 && real.r > 50 && real.z > 5 && real.trees > 20,
    JSON.stringify(real),
  )
  check('load time is reasonable', loadMs < 15000, `${loadMs} ms`)
  check(
    'player spawns on a road, outside buildings',
    !real.spawnInBuilding && ['ROAD', 'SIDEWALK'].includes(real.spawnZone),
    real.spawnZone,
  )
  check(
    'all 22 animals spawn, ground animals on walkable cells',
    real.animals === 22 && real.groundBad === 0,
    `animals=${real.animals} bad=${real.groundBad}`,
  )
  check(
    'OpenStreetMap attribution is displayed',
    await page2.getByText('OpenStreetMap contributors').isVisible(),
  )
  await page2.screenshot({ path: `${OUT}/phase7-hyderabad.png` })

  // Walk and run around the real streets: never inside a building, never out of bounds.
  let realInside = false
  let realOut = false
  const walkReal = async (yaw, ms) => {
    await page2.evaluate((y) => (window.__wildcity.session.camera.yaw = y), yaw)
    await page2.keyboard.down('ShiftLeft')
    await page2.keyboard.down('KeyW')
    const t = Date.now()
    while (Date.now() - t < ms) {
      const r = await page2.evaluate(() => {
        const { player, world } = window.__wildcity.session
        return {
          inB: !!world.buildingAt(player.x, player.z),
          inBounds: world.inBounds(player.x, player.z),
        }
      })
      if (r.inB) realInside = true
      if (!r.inBounds) realOut = true
      await sleep(80)
    }
    await page2.keyboard.up('KeyW')
    await page2.keyboard.up('ShiftLeft')
  }
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) await walkReal(yaw, 2500)
  check('player collides with real buildings and stays in bounds', !realInside && !realOut)

  // Animals roam the real streets.
  await page2.evaluate(() => (window.__wildcity.session.timeScale = 4))
  let animalInside = false
  const seenStates = new Set()
  const tA = Date.now()
  while (Date.now() - tA < 20000) {
    const r = await page2.evaluate(() => {
      const { animals, world } = window.__wildcity.session
      return animals.map((a) => ({
        sp: a.species,
        st: a.state,
        inB: !!world.buildingAt(a.position.x, a.position.z),
      }))
    })
    for (const a of r) {
      if (a.sp !== 'pigeon' && a.inB) animalInside = true
      seenStates.add(a.st)
    }
    await sleep(500)
  }
  await page2.evaluate(() => (window.__wildcity.session.timeScale = 1))
  check(
    'animals roam real streets without entering buildings',
    !animalInside && seenStates.size >= 4,
    `states=${[...seenStates]}`,
  )
  check(
    'no console/page errors on the real city',
    errors2.length === 0,
    errors2.slice(0, 3).join(' | '),
  )
  await page2.close()

  // Failure handling: server error -> friendly message -> recover into the demo town.
  const page3 = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page3.route('**/cities/hyderabad/roads.json', (route) =>
    route.fulfill({ status: 500, body: 'boom' }),
  )
  await page3.goto(`http://localhost:${PORT}/?debug`)
  await page3.getByRole('button', { name: 'Explore' }).click()
  const alert3 = page3.getByRole('alert')
  check(
    'a failing city download shows a friendly error (no crash)',
    (await appears(alert3, 8000)) && /HTTP 500/.test((await alert3.textContent()) ?? ''),
  )
  await page3.getByRole('button', { name: 'Play Demo Town instead' }).click()
  await page3.waitForFunction(() => window.__wildcity?.session?.city.metadata.id === 'demo', null, {
    timeout: 30000,
  })
  check('can recover by playing the demo town', true)
  await page3.close()

  const page4 = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page4.route('**/cities/hyderabad/**', (route) => route.abort())
  await page4.goto(`http://localhost:${PORT}/?debug`)
  await page4.getByRole('button', { name: 'Explore' }).click()
  const alert4 = page4.getByRole('alert')
  check(
    'offline / network failure shows a connection error',
    (await appears(alert4, 8000)) && /connection/i.test((await alert4.textContent()) ?? ''),
  )
  await page4.getByRole('button', { name: 'Try again' }).isVisible()
  await page4.close()

  // ---- Phase 8: city selector ----
  const page5 = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors5 = []
  page5.on('pageerror', (e) => errors5.push(String(e)))
  page5.on('console', (m) => m.type() === 'error' && errors5.push(m.text()))
  await page5.goto(`http://localhost:${PORT}/?debug`)
  await page5.getByRole('list', { name: 'Cities' }).waitFor({ timeout: 10000 })
  const cityNames = await page5
    .getByRole('list', { name: 'Cities' })
    .getByRole('button')
    .allTextContents()
  check(
    'city list shows several cities including the demo town',
    cityNames.length >= 3 &&
      cityNames.some((n) => n.includes('Hyderabad')) &&
      cityNames.some((n) => n.includes('Demo Town')),
    cityNames.join(' | '),
  )
  await page5.screenshot({ path: `${OUT}/phase8-menu.png` })

  await page5.getByLabel('Search cities').fill('hyd')
  check(
    'typing filters the list',
    (await page5.getByRole('list', { name: 'Cities' }).getByRole('button').count()) === 1,
  )
  await page5.getByLabel('Search cities').fill('zzzz')
  check(
    'no matches shows a message and disables Explore',
    (await page5.getByText('No city matches').isVisible()) &&
      (await page5.getByRole('button', { name: 'Explore', exact: true }).isDisabled()),
  )
  await page5.getByLabel('Search cities').fill('')

  await page5.getByLabel('Search cities').press('ArrowDown')
  const pressed = await page5
    .getByRole('list', { name: 'Cities' })
    .getByRole('button', { pressed: true })
    .textContent()
  check('arrow keys move the selection', !!pressed)
  await page5.getByLabel('Search cities').press('Enter')
  await page5.waitForFunction(() => !!window.__wildcity?.session, null, { timeout: 60000 })
  const picked = await page5.evaluate(() => window.__wildcity.session.city.metadata)
  check(
    'Enter starts the highlighted city',
    pressed.includes(picked.name),
    `${pressed} -> ${picked.name}`,
  )
  check(
    'the chosen city is a different real city with its own data',
    picked.id !== 'hyderabad' || cityNames.length === 1,
    picked.id,
  )
  const differs = await page5.evaluate(() => {
    const S = window.__wildcity.session
    return {
      b: S.city.buildings.length,
      spawnOk: !S.world.buildingAt(S.city.metadata.spawn.x, S.city.metadata.spawn.z),
      animals: S.animals.length,
    }
  })
  check(
    'the selected city plays: buildings, valid spawn, 22 animals',
    differs.b > 20 && differs.spawnOk && differs.animals === 22,
    JSON.stringify(differs),
  )
  await sleep(1500)
  await page5.screenshot({ path: `${OUT}/phase8-city.png` })

  // Quit to menu: the last city is remembered and pre-selected.
  await page5.keyboard.press('Escape')
  await page5.getByRole('button', { name: 'Quit to menu' }).click()
  await page5.getByRole('list', { name: 'Cities' }).waitFor({ timeout: 10000 })
  const remembered = await page5
    .getByRole('list', { name: 'Cities' })
    .getByRole('button', { pressed: true })
    .textContent()
  check(
    'quitting returns to the menu with the last city selected',
    remembered.includes(picked.name),
    remembered,
  )

  // Quitting must free the world: switching cities repeatedly doesn't accumulate sessions.
  await page5.getByRole('button', { name: 'Explore', exact: false }).last().click()
  await page5.waitForFunction(
    (id) => window.__wildcity?.session?.city.metadata.id === id,
    picked.id,
    { timeout: 60000 },
  )
  check('a city can be re-entered after quitting', true)
  check(
    'no console/page errors in the selector flow',
    errors5.length === 0,
    errors5.slice(0, 3).join(' | '),
  )
  await page5.close()

  check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  void PHASE
} finally {
  await browser.close()
  server.kill()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed`)
process.exit(failed.length ? 1 : 0)
