import { useCallback, useRef, useState } from 'react'
import type { GameSession } from '@/game/session'
import { GameCanvas } from '@/render/GameCanvas'
import { useAppStore } from '@/state/appStore'
import { LoadingScreen } from '@/ui/LoadingScreen'
import { MainMenu } from '@/ui/MainMenu'

export default function App() {
  const phase = useAppStore((s) => s.phase)
  const setPhase = useAppStore((s) => s.setPhase)
  const [session, setSession] = useState<GameSession | null>(null)
  // Keep the latest session reachable without re-creating callbacks.
  const sessionRef = useRef<GameSession | null>(null)

  const onLoaded = useCallback(
    (s: GameSession) => {
      sessionRef.current = s
      setSession(s)
      setPhase('playing')
    },
    [setPhase],
  )
  const onQuit = useCallback(() => {
    sessionRef.current = null
    setSession(null) // drop the world so its memory can be reclaimed
    setPhase('menu')
  }, [setPhase])

  return (
    <div className="relative h-full w-full">
      {phase === 'menu' && <MainMenu />}
      {phase === 'loading' && <LoadingScreen onLoaded={onLoaded} />}
      {(phase === 'playing' || phase === 'paused') && session && (
        <GameCanvas session={session} onQuit={onQuit} />
      )}
    </div>
  )
}
