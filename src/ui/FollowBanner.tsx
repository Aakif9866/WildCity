import type { GameSession } from '@/game/session'
import { SPECIES } from '@/game/animals/species'
import { useAppStore } from '@/state/appStore'

export function FollowBanner({ session }: { session: GameSession }) {
  const id = useAppStore((s) => s.followAnimalId)
  const stop = useAppStore((s) => s.stopFollow)
  const animal = id ? session.animals.find((a) => a.id === id) : null
  if (!animal) return null
  return (
    <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded bg-black/60 px-4 py-2 text-sm text-white">
      <span>
        Following the {SPECIES[animal.species].name} — press <b>F</b> or move to stop
      </span>
      <button className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30" onClick={stop}>
        Stop
      </button>
    </div>
  )
}
