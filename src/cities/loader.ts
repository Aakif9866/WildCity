import { generateDemoCity } from './demo'
import { CityDataError, parseCityData } from './parse'
import type { CityData, CityMetadata } from './types'

export type CityIndexEntry = Pick<
  CityMetadata,
  'id' | 'name' | 'country' | 'center' | 'description'
>

/** Always available, works offline: also the fallback if a real city can't be loaded. */
export const DEMO_CITY_ID = 'demo'
export const DEMO_ENTRY: CityIndexEntry = {
  id: DEMO_CITY_ID,
  name: 'Demo Town',
  country: 'Test data',
  center: { lat: 0, lon: 0 },
  description: 'A small made-up town that works offline.',
}

const FETCH_TIMEOUT_MS = 20_000

export class CityLoadError extends Error {}

async function fetchJson(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new CityLoadError(`${url} returned HTTP ${res.status}`)
    try {
      return await res.json()
    } catch {
      // A dev/SPA server answers missing files with index.html: not JSON.
      throw new CityLoadError(`${url} is not valid JSON`)
    }
  } catch (e) {
    if (e instanceof CityLoadError) throw e
    if (e instanceof DOMException && e.name === 'AbortError')
      throw new CityLoadError(`${url} timed out (slow network?)`)
    throw new CityLoadError(`Could not reach ${url}: check your connection`)
  } finally {
    clearTimeout(timer)
  }
}

/** Cities the game can offer. A broken/missing index degrades to just the demo town. */
export async function loadCityIndex(): Promise<CityIndexEntry[]> {
  try {
    const raw = await fetchJson('/cities/index.json', 8000)
    const entries = (Array.isArray(raw) ? raw : []).filter(
      (c): c is CityIndexEntry =>
        !!c && typeof c.id === 'string' && typeof c.name === 'string' && c.id !== DEMO_CITY_ID,
    )
    return [...entries, DEMO_ENTRY]
  } catch {
    return [DEMO_ENTRY]
  }
}

/** Fetch and validate a city. `onProgress` feeds the loading screen. Throws CityLoadError/CityDataError. */
export async function loadCity(
  id: string,
  onProgress: (message: string) => void = () => {},
): Promise<CityData> {
  if (id === DEMO_CITY_ID) return generateDemoCity()
  if (!/^[a-z0-9-]+$/.test(id)) throw new CityLoadError(`Invalid city id "${id}"`)
  const base = `/cities/${id}`
  onProgress('Loading city…')
  const meta = await fetchJson(`${base}/metadata.json`)
  onProgress('Loading roads…')
  const roads = await fetchJson(`${base}/roads.json`)
  onProgress('Loading buildings…')
  const buildings = await fetchJson(`${base}/buildings.json`)
  const zones = await fetchJson(`${base}/zones.json`)
  const { city, warnings } = parseCityData(meta, roads, buildings, zones)
  if (warnings.length > 0) console.warn(`[wildcity] ${id}: ${warnings.join('; ')}`)
  return city
}

export const describeLoadError = (e: unknown): string =>
  e instanceof CityLoadError || e instanceof CityDataError
    ? e.message
    : 'Something went wrong while loading the city.'
