import { describe, expect, it } from 'vitest'
import type { CityIndexEntry } from './loader'
import { filterCities, formatCoordinates } from './search'

const c = (id: string, name: string, country: string, description = ''): CityIndexEntry => ({
  id,
  name,
  country,
  description,
  center: { lat: 0, lon: 0 },
})
const cities = [
  c('hyderabad', 'Hyderabad', 'India', 'Necklace Road lakeshore'),
  c('bengaluru', 'Bengaluru', 'India', 'Cubbon Park'),
  c('london', 'London', 'United Kingdom', "St James's Park"),
  c('new-york', 'New York', 'United States'),
  c('demo', 'Demo Town', 'Test data'),
]
const ids = (q: string) => filterCities(cities, q).map((x) => x.id)

describe('filterCities', () => {
  it('returns everything, in order, for an empty or blank query', () => {
    expect(ids('')).toEqual(cities.map((x) => x.id))
    expect(ids('   ')).toEqual(cities.map((x) => x.id))
  })
  it('matches prefixes case-insensitively', () => {
    expect(ids('hyd')).toEqual(['hyderabad'])
    expect(ids('LON')).toEqual(['london'])
  })
  it('matches any word of a multi-word name and ignores accents', () => {
    expect(ids('york')).toEqual(['new-york'])
    expect(filterCities([c('b', 'Bengalúru', 'India')], 'bengaluru')).toHaveLength(1)
  })
  it('matches country and description, ranked after name matches', () => {
    expect(ids('india')).toEqual(['hyderabad', 'bengaluru'])
    expect(ids('cubbon')).toEqual(['bengaluru'])
    // "park": no city is *named* park; description hits only
    expect(ids('park')).toEqual(['bengaluru', 'london'])
  })
  it('ranks name matches above country matches', () => {
    const list = [c('a', 'Aland', 'Demoland'), c('b', 'Demopolis', 'Zed')]
    expect(filterCities(list, 'demo').map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('requires all terms to match and returns nothing for no match', () => {
    expect(ids('london india')).toEqual([])
    expect(ids('zzz')).toEqual([])
    expect(ids('new york')).toEqual(['new-york'])
  })
})

describe('formatCoordinates', () => {
  it('formats hemispheres', () => {
    expect(formatCoordinates(17.423, 78.464)).toBe('17.423° N, 78.464° E')
    expect(formatCoordinates(-33.87, -70.5)).toBe('33.870° S, 70.500° W')
  })
})
