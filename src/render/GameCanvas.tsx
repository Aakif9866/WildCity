import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import { generateDemoCity } from '@/cities/demo'
import { createSession } from '@/game/session'
import { DebugProbe } from '@/render/DebugProbe'
import { PlayerAvatar } from '@/render/PlayerAvatar'
import { PlayerController } from '@/render/PlayerController'
import { Boundary } from '@/render/world/Boundary'
import { CityScene } from '@/render/world/CityScene'
import { useAppStore } from '@/state/appStore'
import { Hud } from '@/ui/Hud'
import { PauseMenu } from '@/ui/PauseMenu'

export function GameCanvas() {
  const session = useMemo(() => createSession(generateDemoCity()), [])
  const phase = useAppStore((s) => s.phase)

  return (
    <>
      <Canvas camera={{ position: [0, 5, 27], fov: 60, near: 0.3, far: 1500 }} dpr={[1, 2]}>
        <color attach="background" args={['#9ccbee']} />
        <fog attach="fog" args={['#9ccbee', 200, 800]} />
        <hemisphereLight args={['#e6f2ff', '#7a8f66', 1.5]} />
        <directionalLight position={[120, 200, 80]} intensity={1.1} />
        <CityScene city={session.city} />
        <Boundary halfSize={session.city.metadata.halfSize} />
        <PlayerAvatar session={session} />
        <PlayerController session={session} />
        <DebugProbe session={session} />
      </Canvas>
      <Hud />
      {phase === 'paused' && <PauseMenu session={session} />}
    </>
  )
}
