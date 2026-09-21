import { useFrame } from '@react-three/fiber'
import type { GameSession } from '@/game/session'
import { updateAnimal } from '@/game/ai/fsm'
import { useAppStore } from '@/state/appStore'
import { AnimalView } from './AnimalView'

export function Animals({ session }: { session: GameSession }) {
  useFrame((_, delta) => {
    if (useAppStore.getState().phase !== 'playing') return
    const dt = Math.min(delta, 0.05)
    const ctx = { world: session.world, nav: session.nav, rng: session.rng }
    for (const a of session.animals) updateAnimal(a, ctx, dt)
  })

  return (
    <>
      {session.animals.map((a) => (
        <AnimalView key={a.id} animal={a} />
      ))}
    </>
  )
}
