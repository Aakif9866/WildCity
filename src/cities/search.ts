import type { CityIndexEntry } from './loader'

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') // "Bengalúru" matches "bengaluru"

/** Lower = better match. Infinity = no match. */
function score(city: CityIndexEntry, query: string): number {
  const name = norm(city.name)
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.split(/\s+/).some((w) => w.startsWith(query))) return 2
  if (name.includes(query)) return 3
  if (norm(city.country).startsWith(query)) return 4
  if (norm(city.country).includes(query) || norm(city.description ?? '').includes(query)) return 5
  return Infinity
}

/**
 * Filter cities for the search box: every whitespace-separated term must match, ranked by how
 * well the city name matches; ties keep the original order. Empty query = everything.
 */
export function filterCities(cities: readonly CityIndexEntry[], query: string): CityIndexEntry[] {
  const terms = norm(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return [...cities]
  return cities
    .map((city, i) => ({ city, i, s: terms.map((t) => score(city, t)) }))
    .filter(({ s }) => s.every(Number.isFinite))
    .sort((a, b) => Math.max(...a.s) - Math.max(...b.s) || a.i - b.i)
    .map(({ city }) => city)
}

export function formatCoordinates(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(3)}° ${ns}, ${Math.abs(lon).toFixed(3)}° ${ew}`
}
