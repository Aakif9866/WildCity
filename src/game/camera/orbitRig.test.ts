import { describe, expect, it } from 'vitest'
import type { CityData } from '@/cities/types'
import { World } from '@/game/world/World'
import { CAMERA, createCameraRig, updateCameraRig } from './orbitRig'

const city: CityData = {
  metadata: {
    id: 't',
    name: 't',
    country: 't',
    center: { lat: 0, lon: 0 },
    halfSize: 100,
    spawn: { x: 0, z: 0, yaw: 0 },
  },
  roads: [],
  buildings: [
    {
      id: 'b',
      footprint: [
        [-20, 4],
        [20, 4],
        [20, 14],
        [-20, 14],
      ],
      height: 30,
    },
  ],
  zones: [],
  trees: [],
}
const world = new World(city)
const player = { x: 0, y: 0, z: 0 }

describe('camera rig', () => {
  it('sits behind the player (+z) at yaw 0', () => {
    const rig = createCameraRig(0, 0, 0)
    updateCameraRig(rig, 0, 0, 0, player, 1 / 60, world, true)
    expect(rig.pz).toBeGreaterThan(rig.tz)
    expect(rig.py).toBeGreaterThan(rig.ty)
  })

  it('clamps pitch and zoom', () => {
    const rig = createCameraRig(0, 0, 0)
    updateCameraRig(rig, 0, 100000, 100000, player, 1 / 60, world, true)
    expect(rig.pitch).toBe(CAMERA.maxPitch)
    expect(rig.distance).toBe(CAMERA.maxDistance)
    updateCameraRig(rig, 0, -100000, -100000, player, 1 / 60, world, true)
    expect(rig.pitch).toBe(CAMERA.minPitch)
    expect(rig.distance).toBe(CAMERA.minDistance)
  })

  it('pulls in instead of clipping through a wall', () => {
    const rig = createCameraRig(0, 0, 0)
    rig.distance = 12
    updateCameraRig(rig, 0, 0, 0, player, 1 / 60, world, true)
    expect(rig.actualDistance).toBeLessThan(6)
    expect(world.isSolidAt(rig.px, rig.py, rig.pz)).toBe(false)
  })

  it('never puts the camera underground', () => {
    const rig = createCameraRig(0, 0, 0)
    rig.pitch = CAMERA.minPitch
    updateCameraRig(rig, 0, 0, 0, { x: 50, y: 0, z: 50 }, 1 / 60, world, true)
    expect(rig.py).toBeGreaterThan(0.2)
  })
})
