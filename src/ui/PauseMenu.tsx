import type { GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'

export function PauseMenu({ session }: { session: GameSession }) {
  const resume = useAppStore((s) => s.resume)
  const setPhase = useAppStore((s) => s.setPhase)

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/70 text-white">
      <h2 className="text-3xl font-bold tracking-widest">PAUSED</h2>
      <button
        className="rounded bg-emerald-500 px-6 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
        onClick={() => {
          resume()
          session.input?.requestLock()
        }}
      >
        Resume
      </button>
      <button
        className="rounded bg-white/15 px-6 py-2 hover:bg-white/25"
        onClick={() => setPhase('menu')}
      >
        Quit to menu
      </button>
    </div>
  )
}
