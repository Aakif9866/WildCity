import { useCallback, useState, type ComponentType } from 'react'
import { CityLoadError } from '@/cities/loader'
import type { GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'
import { LoadingScreen } from '@/ui/LoadingScreen'
import { MainMenu } from '@/ui/MainMenu'

interface GameProps {
  session: GameSession
  onQuit: () => void
}

export default function App() {
  const phase = useAppStore((s) => s.phase)
  const setPhase = useAppStore((s) => s.setPhase)
  const [session, setSession] = useState<GameSession | null>(null)
  // The 3D stack (three.js, R3F, rendering code) is ~60% of the download, so it is loaded on demand
  // (MainMenu prefetches it) rather than in the entry chunk. It is imported here, while the loading
  // screen is still up, and mounted directly: React.lazy + <Suspense> would commit a fallback first,
  // and React then throttles the reveal by ~300 ms (measured) even when the module is already cached.
  const [Game, setGame] = useState<ComponentType<GameProps> | null>(null)

  const onLoaded = useCallback(
    async (s: GameSession) => {
      let mod: typeof import('@/render/GameCanvas')
      try {
        mod = await import('@/render/GameCanvas')
      } catch {
        throw new CityLoadError(
          'Could not load the 3D engine. Check your connection and try again.',
        )
      }
      setGame(() => mod.GameCanvas)
      setSession(s)
      setPhase('playing')
    },
    [setPhase],
  )
  const onQuit = useCallback(() => {
    setSession(null) // drop the world so its memory can be reclaimed
    setPhase('menu')
  }, [setPhase])

  return (
    <div className="relative h-full w-full">
      {phase === 'menu' && <MainMenu />}
      {phase === 'loading' && <LoadingScreen onLoaded={onLoaded} />}
      {(phase === 'playing' || phase === 'paused') && session && Game && (
        <Game session={session} onQuit={onQuit} />
      )}
    </div>
  )
}
