import { useEffect, useState, type KeyboardEvent } from 'react'
import { DEMO_CITY_ID, loadCityIndex, type CityIndexEntry } from '@/cities/loader'
import { filterCities, formatCoordinates } from '@/cities/search'
import { useAppStore } from '@/state/appStore'

function CityDetails({ city }: { city: CityIndexEntry }) {
  const isDemo = city.id === DEMO_CITY_ID
  return (
    <div className="rounded bg-white/5 p-4">
      <h3 className="text-xl font-semibold">{city.name}</h3>
      <p className="text-sm text-white/60">
        {city.country}
        {!isDemo && ` · ${formatCoordinates(city.center.lat, city.center.lon)}`}
      </p>
      {city.description && <p className="mt-2 text-sm text-white/80">{city.description}</p>}
      {!isDemo && (
        <p className="mt-2 text-xs text-white/50">A ~700 m square of real OpenStreetMap data.</p>
      )}
    </div>
  )
}

export function MainMenu() {
  const startLoading = useAppStore((s) => s.startLoading)
  const selectCity = useAppStore((s) => s.selectCity)
  const cityId = useAppStore((s) => s.cityId)
  const loadError = useAppStore((s) => s.loadError)
  const [cities, setCities] = useState<CityIndexEntry[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void loadCityIndex().then((list) => {
      if (!cancelled) setCities(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = cities ? filterCities(cities, query) : []
  // The chosen city if it is still in the filtered list, otherwise the best search match.
  const active = visible.find((c) => c.id === cityId) ?? visible[0] ?? null

  const move = (delta: number): void => {
    if (visible.length === 0) return
    const i = active ? visible.indexOf(active) : -1
    const next = visible[(i + delta + visible.length) % visible.length]
    if (next) selectCity(next.id)
  }
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter' && active) startLoading(active.id)
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-white">
      <h1 className="text-5xl font-bold tracking-widest">WILDCITY</h1>
      <p className="text-center text-slate-300">
        Explore a real city and observe a living ecosystem inside it.
      </p>

      {loadError && (
        <div
          role="alert"
          className="w-full max-w-md rounded border border-red-400/50 bg-red-950/60 p-4 text-sm"
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

      <div className="w-full max-w-md space-y-3">
        <input
          autoFocus
          type="search"
          aria-label="Search cities"
          placeholder="Search for a city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full rounded bg-white/10 px-3 py-2 placeholder-white/40 outline-none focus:ring-2 focus:ring-emerald-400"
        />

        {cities === null ? (
          <p className="text-sm text-white/60">Loading cities…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-white/60">No city matches “{query}”.</p>
        ) : (
          <ul aria-label="Cities" className="max-h-56 space-y-1 overflow-y-auto">
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  aria-pressed={c.id === active?.id}
                  className={`flex w-full items-baseline justify-between rounded px-3 py-2 text-left ${
                    c.id === active?.id
                      ? 'bg-emerald-500/25 ring-1 ring-emerald-400'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => selectCity(c.id)}
                  onDoubleClick={() => startLoading(c.id)}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-white/50">{c.country}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {active && <CityDetails city={active} />}

        <button
          disabled={!active}
          className="w-full rounded bg-emerald-500 px-6 py-2 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
          onClick={() => active && startLoading(active.id)}
        >
          {active ? `Explore ${active.name}` : 'Explore'}
        </button>
      </div>
    </div>
  )
}
