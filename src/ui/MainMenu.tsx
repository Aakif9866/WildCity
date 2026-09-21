import { DEMO_CITY_ID } from '@/cities/loader'
import { DEFAULT_CITY_ID, useAppStore } from '@/state/appStore'

export function MainMenu() {
  const startLoading = useAppStore((s) => s.startLoading)
  const cityId = useAppStore((s) => s.cityId)
  const loadError = useAppStore((s) => s.loadError)

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <h1 className="text-5xl font-bold tracking-widest">WILDCITY</h1>
      <p className="text-slate-300">
        Explore a real city and observe a living ecosystem inside it.
      </p>

      {loadError && (
        <div
          role="alert"
          className="max-w-md rounded border border-red-400/50 bg-red-950/60 p-4 text-sm"
        >
          <p className="mb-3">{loadError}</p>
          <div className="flex gap-2">
            <button
              className="rounded bg-white/15 px-3 py-1 hover:bg-white/25"
              onClick={() => startLoading(cityId)}
            >
              Try again
            </button>
            {cityId !== DEMO_CITY_ID && (
              <button
                className="rounded bg-emerald-500 px-3 py-1 font-semibold text-slate-950 hover:bg-emerald-400"
                onClick={() => startLoading(DEMO_CITY_ID)}
              >
                Play Demo Town instead
              </button>
            )}
          </div>
        </div>
      )}

      <button
        className="rounded bg-emerald-500 px-6 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
        onClick={() => startLoading(cityId || DEFAULT_CITY_ID)}
      >
        Explore
      </button>
    </div>
  )
}
