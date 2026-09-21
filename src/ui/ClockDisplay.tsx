import { useEffect, useState } from 'react'
import { formatClock, phaseLabel } from '@/game/time/clock'
import type { GameSession } from '@/game/session'

const read = (s: GameSession): string =>
  `${formatClock(s.clock.hour)} · ${phaseLabel(s.clock.hour)}`

/** Top-right clock. Sampled twice a second: the clock itself ticks every frame outside React. */
export function ClockDisplay({ session }: { session: GameSession }) {
  const [text, setText] = useState(() => read(session))
  useEffect(() => {
    const t = window.setInterval(() => setText(read(session)), 500)
    return () => window.clearInterval(t)
  }, [session])
  return (
    <div
      aria-label="Time of day"
      className="pointer-events-none absolute top-3 right-3 rounded bg-black/40 px-3 py-1 text-sm font-semibold text-white/90 tabular-nums"
    >
      {text}
    </div>
  )
}
