import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { RigDef, RigGroup } from '@/game/animals/rig'
import { newPose, poseFor } from '@/game/animals/rigPose'
import { SPECIES } from '@/game/animals/species'
import type { Animal } from '@/game/animals/types'
import type { AnimalVisual } from './AnimalVisual'

const material = new MeshLambertMaterial({ vertexColors: true })
const geometryCache = new Map<string, BufferGeometry>()

function resolveColor(token: string, coat: { coat: string; accent: string }): Color {
  return new Color(token === '$coat' ? coat.coat : token === '$accent' ? coat.accent : token)
}

/** One merged geometry per (species, coat, group): the whole animal costs a few draw calls. */
function groupGeometry(
  speciesId: string,
  coatIdx: number,
  group: RigGroup,
  rig: RigDef,
): BufferGeometry {
  const key = `${speciesId}:${coatIdx}:${group.name}`
  const hit = geometryCache.get(key)
  if (hit) return hit
  const palette = rig.coats[coatIdx % rig.coats.length] as { coat: string; accent: string }
  const parts = group.parts.map((p) => {
    const g = new BoxGeometry(p.size[0], p.size[1], p.size[2])
    g.translate(p.pos[0], p.pos[1], p.pos[2])
    const c = resolveColor(p.color, palette)
    const count = g.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3)
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    g.deleteAttribute('uv')
    return g
  })
  const merged = mergeGeometries(parts, false) ?? new BufferGeometry()
  parts.forEach((p) => p.dispose())
  geometryCache.set(key, merged)
  return merged
}

interface AnimatedNode {
  node: Group
  group: RigGroup
}

export class ProceduralAnimal implements AnimalVisual {
  readonly root = new Group()
  private readonly nodes: AnimatedNode[] = []
  private readonly pose = newPose()
  private phase = 0
  private sleep = 0

  constructor(speciesId: keyof typeof SPECIES, coat: number) {
    const rig = SPECIES[speciesId].rig
    for (const group of rig.groups) {
      const node = new Group()
      node.position.set(...group.pivot)
      // The node sits at the pivot; part positions in the rig are already relative to it.
      const geo = groupGeometry(speciesId, coat, group, rig)
      const mesh = new Mesh(geo, material)
      node.add(mesh)
      this.root.add(node)
      this.nodes.push({ node, group })
    }
  }

  update(a: Animal, time: number, dt: number): void {
    this.root.position.set(a.position.x, a.position.y, a.position.z)
    this.root.rotation.y = a.yaw

    const walk = SPECIES[a.species as keyof typeof SPECIES].walkSpeed
    const move = Math.min(1.4, a.speed / walk)
    this.phase += a.speed * dt * 4.2
    this.sleep += ((a.animation === 'sleep' ? 1 : 0) - this.sleep) * Math.min(1, dt * 4)
    this.root.scale.y = 1 - 0.4 * this.sleep

    for (const { node, group } of this.nodes) {
      const p = poseFor(group.anim, a.animation, move, this.phase, time, this.pose)
      node.position.set(group.pivot[0] + p.x, group.pivot[1] + p.y, group.pivot[2] + p.z)
      node.rotation.set(p.rx, p.ry, p.rz)
    }
  }

  dispose(): void {
    // Geometry and material are shared through the cache; nothing per-instance to free.
  }
}
