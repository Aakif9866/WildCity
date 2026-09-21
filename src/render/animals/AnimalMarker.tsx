import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'
import type { GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'

// Road surfaces sit at y=0.10 (see CityScene); the ring must be above them or it is buried.
const MARKER_LIFT = 0.16

/** A flat ring on the ground under an animal: white = can inspect, yellow = observing. */
export function AnimalMarker({
  session,
  kind,
}: {
  session: GameSession
  kind: 'prompt' | 'observed'
}) {
  const id = useAppStore((s) => (kind === 'prompt' ? s.promptAnimalId : s.observedId))
  const ref = useRef<Mesh>(null)

  useFrame(() => {
    const a = id ? session.animals.find((x) => x.id === id) : null
    const m = ref.current
    if (!m) return
    m.visible = !!a
    if (a) m.position.set(a.position.x, (a.airborne ? 0 : a.position.y) + MARKER_LIFT, a.position.z)
  })

  if (!id) return null
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={5}>
      <ringGeometry args={[0.55, 0.7, 24]} />
      <meshBasicMaterial
        color={kind === 'observed' ? '#ffd34d' : '#ffffff'}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  )
}
