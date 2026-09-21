import { useFrame } from '@react-three/fiber'
import { aiContextOf, type GameSession } from '@/game/session'
import { updateAnimal } from '@/game/ai/fsm'
import { useAppStore } from '@/state/appStore'
import { AnimalView } from './AnimalView'

export function Animals({ session }: { session: GameSession }) {
  useFrame((_, delta) => {
    if (useAppStore.getState().phase !== 'playing') return
    const dt = Math.min(delta, 0.05)
    const ctx = aiContextOf(session)
    // Sub-step (not a bigger dt) when sped up so movement and A* stay stable.
    const steps = Math.max(1, Math.round(session.timeScale))
    for (let i = 0; i < steps; i++) for (const a of session.animals) updateAnimal(a, ctx, dt)
  })

  return (
    <>
      {session.animals.map((a) => (
        <AnimalView key={a.id} animal={a} />
      ))}
    </>
  )
}
