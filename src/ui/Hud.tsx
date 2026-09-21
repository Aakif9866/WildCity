import type { GameSession } from '@/game/session'

export function Hud({ session }: { session: GameSession }) {
  const { name, country, attribution } = session.city.metadata
  return (
    <>
      <div className="pointer-events-none absolute top-3 left-3 rounded bg-black/40 px-3 py-1 text-sm font-semibold text-white/90">
        {name}
        {country ? <span className="font-normal text-white/60">, {country}</span> : null}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/40 px-3 py-2 text-xs text-white/90">
        <div>
          <b>WASD</b> move · <b>Shift</b> run · <b>Space</b> jump · <b>E</b> interact · <b>Esc</b>{' '}
          pause
        </div>
        <div className="text-white/60">Click the game to capture the mouse · scroll to zoom</div>
      </div>
      {attribution && (
        <div className="pointer-events-none absolute right-3 bottom-1 text-[10px] text-white/70">
          {attribution}
        </div>
      )}
    </>
  )
}
