import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { GameSession } from '@/game/session'

// Stylized placeholder person; four meshes total. Swap for a GLB later without touching gameplay.
export function PlayerAvatar({ session }: { session: GameSession }) {
  const root = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const body = useRef<Group>(null)
  const phase = useRef(0)

  useFrame((_, delta) => {
    const { player } = session
    const g = root.current
    if (!g) return
    g.position.set(player.x, player.y, player.z)
    g.rotation.y = player.yaw
    const moving = Math.min(1, player.speed / 4.5)
    phase.current += delta * (4 + player.speed * 1.3)
    const swing = Math.sin(phase.current) * 0.7 * moving * (player.grounded ? 1 : 0.3)
    if (legL.current) legL.current.rotation.x = swing
    if (legR.current) legR.current.rotation.x = -swing
    if (body.current) body.current.position.y = Math.abs(Math.sin(phase.current)) * 0.06 * moving
  })

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[0.55, 0.7, 0.32]} />
          <meshLambertMaterial color="#e0533d" />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <boxGeometry args={[0.32, 0.32, 0.32]} />
          <meshLambertMaterial color="#f0c9a0" />
        </mesh>
        <mesh position={[0, 1.7, -0.17]}>
          <boxGeometry args={[0.32, 0.1, 0.02]} />
          <meshLambertMaterial color="#3a2a1a" />
        </mesh>
      </group>
      <group ref={legL} position={[-0.15, 0.8, 0]}>
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[0.2, 0.8, 0.22]} />
          <meshLambertMaterial color="#2f4f8f" />
        </mesh>
      </group>
      <group ref={legR} position={[0.15, 0.8, 0]}>
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[0.2, 0.8, 0.22]} />
          <meshLambertMaterial color="#2f4f8f" />
        </mesh>
      </group>
    </group>
  )
}
