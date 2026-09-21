import { describe, expect, it } from 'vitest'
import { boundingBox, latLonToLocal, localToLatLon } from './geo'

const hyderabad = { lat: 17.385, lon: 78.4867 }

describe('geo conversion', () => {
  it('maps the centre to the origin', () => {
    const [x, z] = latLonToLocal(hyderabad, hyderabad.lat, hyderabad.lon)
    expect(x).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)
  })

  it('north is -z, east is +x', () => {
    const [, zNorth] = latLonToLocal(hyderabad, hyderabad.lat + 0.001, hyderabad.lon)
    const [xEast] = latLonToLocal(hyderabad, hyderabad.lat, hyderabad.lon + 0.001)
    expect(zNorth).toBeLessThan(0)
    expect(xEast).toBeGreaterThan(0)
  })

  it('one degree of latitude is ~111.3 km; longitude shrinks with cos(latitude)', () => {
    const [, z] = latLonToLocal(hyderabad, hyderabad.lat + 1, hyderabad.lon)
    expect(Math.abs(z)).toBeGreaterThan(111000)
    expect(Math.abs(z)).toBeLessThan(111600)
    const [x] = latLonToLocal(hyderabad, hyderabad.lat, hyderabad.lon + 1)
    expect(x / Math.abs(z)).toBeCloseTo(Math.cos((hyderabad.lat * Math.PI) / 180), 3)
  })

  it('round-trips through the inverse', () => {
    const [x, z] = latLonToLocal(hyderabad, 17.3921, 78.4801)
    const back = localToLatLon(hyderabad, x, z)
    expect(back.lat).toBeCloseTo(17.3921, 9)
    expect(back.lon).toBeCloseTo(78.4801, 9)
  })

  it('a 400 m half-size box spans ~800 m each way', () => {
    const [s, w, n, e] = boundingBox(hyderabad, 400)
    const [, zs] = latLonToLocal(hyderabad, s, hyderabad.lon)
    const [, zn] = latLonToLocal(hyderabad, n, hyderabad.lon)
    const [xw] = latLonToLocal(hyderabad, hyderabad.lat, w)
    const [xe] = latLonToLocal(hyderabad, hyderabad.lat, e)
    expect(zs - zn).toBeCloseTo(800, 3)
    expect(xe - xw).toBeCloseTo(800, 3)
  })
})
