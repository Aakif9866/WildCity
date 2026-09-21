import { useAppStore } from '@/state/appStore'

export function MainMenu() {
  const setPhase = useAppStore((s) => s.setPhase)

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950/70 text-white">
      <h1 className="text-5xl font-bold tracking-widest">WILDCITY</h1>
      <p className="text-slate-300">
        Explore a real city and observe a living ecosystem inside it.
      </p>
      <button
        className="rounded bg-emerald-500 px-6 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
        onClick={() => setPhase('playing')}
      >
        Explore
      </button>
    </div>
  )
}
