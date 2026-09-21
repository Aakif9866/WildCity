import { afterEach, describe, expect, it, vi } from 'vitest'
import { CityLoadError, DEMO_CITY_ID, loadCity, loadCityIndex } from './loader'

const meta = {
  id: 'x',
  name: 'X',
  country: 'Y',
  center: { lat: 1, lon: 2 },
  halfSize: 300,
  spawn: { x: 0, z: 0, yaw: 0 },
}
const road = {
  id: 'r1',
  kind: 'secondary',
  width: 8,
  points: [
    [0, 0],
    [10, 0],
  ],
}

function stubFetch(routes: Record<string, unknown | (() => Response)>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const hit = routes[url]
      if (hit === undefined) return new Response('not found', { status: 404 })
      if (typeof hit === 'function') return (hit as () => Response)()
      return new Response(JSON.stringify(hit), { status: 200 })
    }),
  )
}
afterEach(() => vi.unstubAllGlobals())

describe('loadCity', () => {
  it('loads and validates a city, reporting progress in order', async () => {
    stubFetch({
      '/cities/x/metadata.json': meta,
      '/cities/x/roads.json': [road],
      '/cities/x/buildings.json': [],
      '/cities/x/zones.json': { areas: [], trees: [] },
    })
    const steps: string[] = []
    const city = await loadCity('x', (m) => steps.push(m))
    expect(city.metadata.name).toBe('X')
    expect(steps).toEqual(['Loading city…', 'Loading roads…', 'Loading buildings…'])
  })

  it('the demo city needs no network at all', async () => {
    stubFetch({})
    expect((await loadCity(DEMO_CITY_ID)).buildings.length).toBeGreaterThan(10)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports HTTP errors, non-JSON responses and network failures clearly', async () => {
    stubFetch({})
    await expect(loadCity('missing')).rejects.toThrow(/HTTP 404/)
    stubFetch({
      '/cities/html/metadata.json': () => new Response('<!doctype html>', { status: 200 }),
    })
    await expect(loadCity('html')).rejects.toThrow(/not valid JSON/)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    )
    await expect(loadCity('x')).rejects.toThrow(/connection/)
  })

  it('rejects unsafe city ids before touching the network', async () => {
    stubFetch({})
    await expect(loadCity('../etc/passwd')).rejects.toBeInstanceOf(CityLoadError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces invalid city data as an error', async () => {
    stubFetch({
      '/cities/x/metadata.json': { nope: true },
      '/cities/x/roads.json': [],
      '/cities/x/buildings.json': [],
      '/cities/x/zones.json': {},
    })
    await expect(loadCity('x')).rejects.toThrow(/metadata/)
  })
})

describe('loadCityIndex', () => {
  it('lists real cities and always appends the demo town', async () => {
    stubFetch({
      '/cities/index.json': [
        { id: 'hyderabad', name: 'Hyderabad', country: 'India', center: { lat: 1, lon: 2 } },
        { junk: 1 },
      ],
    })
    const idx = await loadCityIndex()
    expect(idx.map((c) => c.id)).toEqual(['hyderabad', DEMO_CITY_ID])
  })
  it('degrades to just the demo town when the index is missing or broken', async () => {
    stubFetch({})
    expect((await loadCityIndex()).map((c) => c.id)).toEqual([DEMO_CITY_ID])
    stubFetch({ '/cities/index.json': 'not-an-array' })
    expect((await loadCityIndex()).map((c) => c.id)).toEqual([DEMO_CITY_ID])
  })
})
