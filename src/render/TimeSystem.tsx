import { useFrame } from '@react-three/fiber'
import { tickClock, type GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'

/** Advances the game clock while playing. Mounted before the animals so they see the new phase. */
export function TimeSystem({ session }: { session: GameSession }) {
  useFrame((_, delta) => {
    if (useAppStore.getState().phase === 'playing') tickClock(session, Math.min(delta, 0.05))
  })
  return null
}
