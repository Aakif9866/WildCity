import { useEffect, useState } from 'react'
import { interactWithAnimal } from '@/game/ai/fsm'
import { moodOf } from '@/game/ai/needs'
import { SPECIES } from '@/game/animals/species'
import type { Animal } from '@/game/animals/types'
import { describeState } from '@/game/interaction'
import { aiContextOf, aimCameraAt, type GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'

interface Snapshot {
  name: string
  state: string
  mood: string
  energy: number
  hunger: number
}

const snapshotOf = (a: Animal): Snapshot => ({
  name: SPECIES[a.species].name,
  state: describeState(a),
  mood: moodOf(a),
  energy: a.energy,
  hunger: a.hunger,
})

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-white/70">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-white/15">
        <div className="h-full" style={{ width: `${Math.round(value)}%`, background: color }} />
      </div>
      <span className="w-8 text-right tabular-nums">{Math.round(value)}</span>
    </div>
  )
}

/** Live values are sampled at 4 Hz instead of every frame: the sim never drives React renders. */
function PanelBody({ animal, session }: { animal: Animal; session: GameSession }) {
  const close = useAppStore((s) => s.closePanel)
  const observe = useAppStore((s) => s.observe)
  const startFollow = useAppStore((s) => s.startFollow)
  const [snap, setSnap] = useState(() => snapshotOf(animal))
  const [message, setMessage] = useState('')

  useEffect(() => {
    const t = window.setInterval(() => setSnap(snapshotOf(animal)), 250)
    return () => window.clearInterval(t)
  }, [animal])

  return (
    <div className="absolute right-4 bottom-4 w-72 rounded-lg bg-slate-900/90 p-4 text-sm text-white shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-bold tracking-wide uppercase">{snap.name}</h3>
        <button aria-label="Close" className="text-white/60 hover:text-white" onClick={close}>
          ✕
        </button>
      </div>
      <div className="space-y-1">
        <Bar label="Energy" value={snap.energy} color="#4ade80" />
        <Bar label="Hunger" value={snap.hunger} color="#fb923c" />
      </div>
      <div className="mt-2 text-white/80">
        <div>
          Mood: <b>{snap.mood}</b>
        </div>
        <div>
          State: <b>{snap.state}</b>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 rounded bg-white/15 py-1.5 hover:bg-white/25"
          onClick={() => {
            aimCameraAt(session, animal.position.x, animal.position.z)
            observe(animal.id)
            setMessage('Observing quietly…')
          }}
        >
          Observe
        </button>
        <button
          className="flex-1 rounded bg-white/15 py-1.5 hover:bg-white/25"
          onClick={() => startFollow(animal.id)}
        >
          Follow
        </button>
        <button
          className="flex-1 rounded bg-emerald-500 py-1.5 font-semibold text-slate-950 hover:bg-emerald-400"
          onClick={() => setMessage(interactWithAnimal(animal, aiContextOf(session)).message)}
        >
          Interact
        </button>
      </div>
      {message && <p className="mt-2 text-white/80 italic">{message}</p>}
    </div>
  )
}

export function AnimalPanel({ session }: { session: GameSession }) {
  const id = useAppStore((s) => s.panelAnimalId)
  const animal = id ? session.animals.find((a) => a.id === id) : null
  // Keyed by id so message/snapshot state resets when a different animal is opened.
  return animal ? <PanelBody key={animal.id} animal={animal} session={session} /> : null
}
