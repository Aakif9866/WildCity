// City data format. Coordinates are local metres: x = east, z = south (three.js convention),
// origin = city centre. Engine code consumes only these types, never city-specific logic.
export type Vec2 = [x: number, z: number]

export type ZoneKind =
  | 'ROAD'
  | 'SIDEWALK'
  | 'BUILDING'
  | 'PARK'
  | 'WATER'
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  // Derived (not authored): ground near a tree. Lets species prefer "trees" via plain config.
  | 'TREE'

export type AreaZoneKind = 'PARK' | 'WATER' | 'RESIDENTIAL' | 'COMMERCIAL'

export interface CityMetadata {
  id: string
  name: string
  country: string
  center: { lat: number; lon: number }
  /** Playable area is a square of side 2 * halfSize metres. */
  halfSize: number
  spawn: { x: number; z: number; yaw: number }
  /** Data licence credit that must be shown to players (OSM's ODbL requires it). */
  attribution?: string
  description?: string
}

export interface Building {
  id: string
  footprint: Vec2[]
  height: number
}

export type RoadKind = 'primary' | 'secondary' | 'residential' | 'footway'

export interface Road {
  id: string
  kind: RoadKind
  width: number
  points: Vec2[]
}

export interface AreaZone {
  kind: AreaZoneKind
  polygon: Vec2[]
}

export interface CityData {
  metadata: CityMetadata
  roads: Road[]
  buildings: Building[]
  zones: AreaZone[]
  trees: Vec2[]
}

export const SIDEWALK_WIDTH = 3
