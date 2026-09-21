export function Hud() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/40 px-3 py-2 text-xs text-white/90">
      <div>
        <b>WASD</b> move · <b>Shift</b> run · <b>Space</b> jump · <b>E</b> interact · <b>Esc</b>{' '}
        pause
      </div>
      <div className="text-white/60">Click the game to capture the mouse · scroll to zoom</div>
    </div>
  )
}
