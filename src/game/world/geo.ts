import type { Vec2 } from '@/cities/types'

const EARTH_RADIUS = 6378137
const DEG = Math.PI / 180

export interface LatLon {
  lat: number
  lon: number
}

/**
 * Equirectangular projection around `center`: accurate to well under a metre over the
 * 1 km areas the game uses. x = east, z = south (three.js convention), origin = center.
 */
export function latLonToLocal(center: LatLon, lat: number, lon: number): Vec2 {
  const x = (lon - center.lon) * DEG * Math.cos(center.lat * DEG) * EARTH_RADIUS
  const z = -(lat - center.lat) * DEG * EARTH_RADIUS
  return [x, z]
}

export function localToLatLon(center: LatLon, x: number, z: number): LatLon {
  return {
    lat: center.lat - z / (DEG * EARTH_RADIUS),
    lon: center.lon + x / (DEG * EARTH_RADIUS * Math.cos(center.lat * DEG)),
  }
}

/** Bounding box (south, west, north, east) of a square of half-side `halfSize` metres. */
export function boundingBox(center: LatLon, halfSize: number): [number, number, number, number] {
  const north = localToLatLon(center, 0, -halfSize).lat
  const south = localToLatLon(center, 0, halfSize).lat
  const east = localToLatLon(center, halfSize, 0).lon
  const west = localToLatLon(center, -halfSize, 0).lon
  return [south, west, north, east]
}
