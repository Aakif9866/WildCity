// Bakes each species' rig JSON (src/game/animals/rigs/*.json) into a GLB with idle/walk/run clips.
// The stride/wag math mirrors src/game/animals/rigPose.ts; keep them in sync.
// Usage: npm run models
import { readdirSync, readFileSync, mkdirSync } from 'node:fs'
import { Document, NodeIO } from '@gltf-transform/core'

const RIGS = 'src/game/animals/rigs'
const OUT = 'public/models'
mkdirSync(OUT, { recursive: true })

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const hex = (h) => [1, 3, 5].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255))

function box([w, h, d], [px, py, pz], color, out) {
  const [x, y, z] = [w / 2, h / 2, d / 2]
  const faces = [
    [
      [1, 0, 0],
      [
        [x, -y, z],
        [x, -y, -z],
        [x, y, -z],
        [x, y, z],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [-x, -y, -z],
        [-x, -y, z],
        [-x, y, z],
        [-x, y, -z],
      ],
    ],
    [
      [0, 1, 0],
      [
        [-x, y, z],
        [x, y, z],
        [x, y, -z],
        [-x, y, -z],
      ],
    ],
    [
      [0, -1, 0],
      [
        [-x, -y, -z],
        [x, -y, -z],
        [x, -y, z],
        [-x, -y, z],
      ],
    ],
    [
      [0, 0, 1],
      [
        [-x, -y, z],
        [x, -y, z],
        [x, y, z],
        [-x, y, z],
      ],
    ],
    [
      [0, 0, -1],
      [
        [x, -y, -z],
        [-x, -y, -z],
        [-x, y, -z],
        [x, y, -z],
      ],
    ],
  ]
  for (const [n, corners] of faces) {
    const base = out.pos.length / 3
    for (const [cx, cy, cz] of corners) {
      out.pos.push(cx + px, cy + py, cz + pz)
      out.nrm.push(...n)
      out.col.push(...color, 1)
    }
    out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
}

const quatY = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)]
const quatX = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)]

// [duration s, stride amplitude 0..1, wag rate]
const CLIPS = {
  idle: [2, 0, 4],
  walk: [0.8, 1, 8],
  run: [0.45, 1.4, 12],
  eat: [1, 0, 4],
  sleep: [2, 0, 0],
}

function writeSpecies(file) {
  const id = file.replace('.json', '')
  const rig = JSON.parse(readFileSync(`${RIGS}/${file}`, 'utf8'))
  const palette = rig.coats[0]
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene(id)
  const root = doc.createNode(id)
  scene.addChild(root)
  const nodes = new Map()

  for (const g of rig.groups) {
    const out = { pos: [], nrm: [], col: [], idx: [] }
    for (const p of g.parts) {
      const token =
        p.color === '$coat' ? palette.coat : p.color === '$accent' ? palette.accent : p.color
      box(p.size, p.pos, hex(token), out)
    }
    const prim = doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(out.pos)).setBuffer(buffer),
      )
      .setAttribute(
        'NORMAL',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(out.nrm)).setBuffer(buffer),
      )
      .setAttribute(
        'COLOR_0',
        doc.createAccessor().setType('VEC4').setArray(new Float32Array(out.col)).setBuffer(buffer),
      )
      .setIndices(
        doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(out.idx)).setBuffer(buffer),
      )
      .setMaterial(doc.createMaterial(`${g.name}-mat`).setRoughnessFactor(1).setMetallicFactor(0))
    const mesh = doc.createMesh(g.name).addPrimitive(prim)
    const node = doc.createNode(g.name).setTranslation(g.pivot).setMesh(mesh)
    root.addChild(node)
    nodes.set(g.name, { node, group: g })
  }

  for (const [name, [dur, amp, wagRate]] of Object.entries(CLIPS)) {
    const anim = doc.createAnimation(name)
    const steps = 16
    const times = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * dur)
    for (const { node, group } of nodes.values()) {
      const trans = []
      const rot = []
      for (let i = 0; i <= steps; i++) {
        const phase = (i / steps) * Math.PI * 2
        let dx = 0,
          dy = 0,
          dz = 0,
          q = [0, 0, 0, 1]
        if (group.anim === 'strideA' || group.anim === 'strideB') {
          const p = group.anim === 'strideA' ? phase : phase + Math.PI
          dz = Math.sin(p) * 0.13 * amp
          dy = Math.max(0, Math.cos(p)) * 0.07 * amp
        } else if (group.anim === 'wag') {
          // Whole number of wag cycles per clip so it loops seamlessly.
          const cycles = Math.max(1, Math.round((wagRate * dur) / (Math.PI * 2)))
          q = name === 'sleep' ? q : quatY(Math.sin((i / steps) * cycles * Math.PI * 2) * 0.45)
        } else if (group.anim === 'head' && name === 'eat') {
          q = quatX(0.5 + Math.sin((i / steps) * 6 * Math.PI * 2) * 0.2)
        }
        trans.push(group.pivot[0] + dx, group.pivot[1] + dy, group.pivot[2] + dz)
        rot.push(...q)
      }
      const input = doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Float32Array(times))
        .setBuffer(buffer)
      const tOut = doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array(trans))
        .setBuffer(buffer)
      const rOut = doc
        .createAccessor()
        .setType('VEC4')
        .setArray(new Float32Array(rot))
        .setBuffer(buffer)
      for (const [path, output] of [
        ['translation', tOut],
        ['rotation', rOut],
      ]) {
        // Samplers must be registered on the animation, or channels point at nothing.
        const sampler = doc
          .createAnimationSampler()
          .setInput(input)
          .setOutput(output)
          .setInterpolation('LINEAR')
        anim.addSampler(sampler)
        anim.addChannel(
          doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler),
        )
      }
    }
  }
  return new NodeIO()
    .write(`${OUT}/${id}.glb`, doc)
    .then(() => console.log(`wrote ${OUT}/${id}.glb`))
}

for (const f of readdirSync(RIGS).filter((f) => f.endsWith('.json'))) await writeSpecies(f)
