import { Canvas } from '@react-three/fiber'
import type { GameSession } from '@/game/session'
import { Atmosphere } from '@/render/Atmosphere'
import { TimeSystem } from '@/render/TimeSystem'
import { AnimalMarker } from '@/render/animals/AnimalMarker'
import { Animals } from '@/render/animals/Animals'
import { DebugProbe } from '@/render/DebugProbe'
import { PlayerAvatar } from '@/render/PlayerAvatar'
import { PlayerController } from '@/render/PlayerController'
import { Boundary } from '@/render/world/Boundary'
import { CityScene } from '@/render/world/CityScene'
import { useAppStore } from '@/state/appStore'
import { ClockDisplay } from '@/ui/ClockDisplay'
import { AnimalPanel } from '@/ui/AnimalPanel'
import { FollowBanner } from '@/ui/FollowBanner'
import { Hud } from '@/ui/Hud'
import { InteractPrompt } from '@/ui/InteractPrompt'
import { PauseMenu } from '@/ui/PauseMenu'

export function GameCanvas({ session, onQuit }: { session: GameSession; onQuit: () => void }) {
  const phase = useAppStore((s) => s.phase)

  return (
    <>
      <Canvas camera={{ position: [0, 5, 27], fov: 60, near: 0.3, far: 1500 }} dpr={[1, 2]}>
        <Atmosphere session={session} />
        <TimeSystem session={session} />
        <CityScene city={session.city} />
        <Boundary halfSize={session.city.metadata.halfSize} />
        <PlayerAvatar session={session} />
        <Animals session={session} />
        <AnimalMarker session={session} kind="prompt" />
        <AnimalMarker session={session} kind="observed" />
        <PlayerController session={session} />
        <DebugProbe session={session} />
      </Canvas>
      <Hud session={session} />
      <ClockDisplay session={session} />
      <InteractPrompt session={session} />
      <FollowBanner session={session} />
      <AnimalPanel session={session} />
      {phase === 'paused' && <PauseMenu session={session} onQuit={onQuit} />}
    </>
  )
}
