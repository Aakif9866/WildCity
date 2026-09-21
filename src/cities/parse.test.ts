import { describe, expect, it } from 'vitest'
import { CityDataError, parseCityData } from './parse'

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
const building = {
  id: 'b1',
  height: 10,
  footprint: [
    [0, 0],
    [5, 0],
    [5, 5],
  ],
}
const area = {
  kind: 'PARK',
  polygon: [
    [0, 0],
    [5, 0],
    [5, 5],
  ],
}

describe('parseCityData', () => {
  it('accepts well-formed data unchanged', () => {
    const { city, warnings } = parseCityData(meta, [road], [building], {
      areas: [area],
      trees: [[1, 1]],
    })
    expect(warnings).toEqual([])
    expect(city.roads).toHaveLength(1)
    expect(city.buildings[0]!.height).toBe(10)
    expect(city.zones[0]!.kind).toBe('PARK')
    expect(city.trees).toEqual([[1, 1]])
    expect(city.metadata.spawn.yaw).toBe(0)
  })

  it('skips malformed features with warnings instead of failing', () => {
    const { city, warnings } = parseCityData(
      meta,
      [
        road,
        { ...road, id: 'bad1', points: [[0, 0]] },
        { ...road, id: 'bad2', kind: 'spaceway' },
        null,
      ],
      [
        building,
        {
          ...building,
          id: 'b2',
          footprint: [
            [0, 0],
            [1, NaN],
            [2, 2],
          ],
        },
        { ...building, id: 'b3', height: -4 },
      ],
      { areas: [area, { kind: 'LAVA', polygon: area.polygon }], trees: [[1, 1], [NaN, 2], 'x'] },
    )
    expect(city.roads).toHaveLength(1)
    expect(city.buildings).toHaveLength(1)
    expect(city.zones).toHaveLength(1)
    expect(city.trees).toHaveLength(1)
    expect(warnings.join(' ')).toMatch(/roads/)
    expect(warnings.join(' ')).toMatch(/buildings/)
    expect(warnings.join(' ')).toMatch(/zones/)
  })

  it('rejects broken metadata', () => {
    expect(() => parseCityData(null, [road], [], {})).toThrow(CityDataError)
    expect(() => parseCityData({ ...meta, halfSize: -5 }, [road], [], {})).toThrow(CityDataError)
    expect(() => parseCityData({ ...meta, center: { lat: 'a' } }, [road], [], {})).toThrow(
      CityDataError,
    )
    expect(() => parseCityData({ ...meta, id: '' }, [road], [], {})).toThrow(CityDataError)
  })

  it('rejects a city with no usable geometry at all', () => {
    expect(() => parseCityData(meta, [], [], { areas: [], trees: [] })).toThrow(
      /no usable geometry/,
    )
    expect(() => parseCityData(meta, 'nonsense', undefined, 42)).toThrow(CityDataError)
  })

  it('tolerates missing optional fields', () => {
    const { city } = parseCityData(
      { ...meta, country: undefined, spawn: { x: 1, z: 2 } },
      [road],
      [],
      undefined,
    )
    expect(city.metadata.country).toBe('')
    expect(city.metadata.spawn.yaw).toBe(0)
    expect(city.trees).toEqual([])
  })
})
