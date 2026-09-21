import { PHASE_START_HOUR, phaseLabel } from '@/game/time/clock'
import { DAY_PHASES } from '@/game/time/dayPhase'
import { setHour, type GameSession } from '@/game/session'
import { useAppStore } from '@/state/appStore'

export function PauseMenu({ session, onQuit }: { session: GameSession; onQuit: () => void }) {
  const resume = useAppStore((s) => s.resume)

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

      <div className="text-center">
        <p className="mb-1 text-xs tracking-wide text-white/60 uppercase">Skip to</p>
        <div className="flex gap-2">
          {DAY_PHASES.map((p) => (
            <button
              key={p}
              className="rounded bg-white/15 px-3 py-1 text-sm hover:bg-white/25"
              onClick={() => setHour(session, PHASE_START_HOUR[p])}
            >
              {phaseLabel(PHASE_START_HOUR[p])}
            </button>
          ))}
        </div>
      </div>

      <button className="rounded bg-white/15 px-6 py-2 hover:bg-white/25" onClick={onQuit}>
        Quit to menu
      </button>
    </div>
  )
}
