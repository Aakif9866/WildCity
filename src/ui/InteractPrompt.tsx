import type { GameSession } from '@/game/session'
import { SPECIES } from '@/game/animals/species'
import { useAppStore } from '@/state/appStore'

/** "[E] Inspect Dog" when an animal is close enough. */
export function InteractPrompt({ session }: { session: GameSession }) {
  const id = useAppStore((s) => s.promptAnimalId)
  const panelOpen = useAppStore((s) => s.panelAnimalId !== null)
  const animal = id ? session.animals.find((a) => a.id === id) : null
  if (!animal || panelOpen) return null
  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded bg-black/55 px-4 py-2 text-sm text-white">
      <kbd className="rounded bg-white/25 px-1.5 font-bold">E</kbd> Inspect{' '}
      {SPECIES[animal.species].name}
    </div>
  )
}
