import {
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Building, Road, Vec2 } from '@/cities/types'

// Muted, stylized palette: recognizable blocks rather than realism.
const WALL_COLORS = ['#d9c7a3', '#c9a98a', '#b9c4cf', '#e0d6c8', '#c4a99a', '#a9b8a3'].map(
  (c) => new Color(c),
)

const hashString = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function shapeFromPolygon(poly: readonly Vec2[]): Shape {
  // Shape lives in (x, -z) so that rotateX(-PI/2) maps it back onto (x, z) with +y extrusion.
  const shape = new Shape()
  poly.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)))
  return shape
}

/** All buildings merged into one geometry = one draw call regardless of building count. */
export function buildBuildingsGeometry(buildings: readonly Building[]): BufferGeometry | null {
  const parts: BufferGeometry[] = []
  for (const b of buildings) {
    if (b.footprint.length < 3) continue
    const geo = new ExtrudeGeometry(shapeFromPolygon(b.footprint), {
      depth: b.height,
      bevelEnabled: false,
    })
    geo.rotateX(-Math.PI / 2)
    const wall = WALL_COLORS[hashString(b.id) % WALL_COLORS.length] as Color
    const roof = wall.clone().multiplyScalar(0.72)
    const normals = geo.getAttribute('normal')
    const colors = new Float32Array(normals.count * 3)
    for (let i = 0; i < normals.count; i++) {
      const c = normals.getY(i) > 0.5 ? roof : wall
      colors.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
    geo.deleteAttribute('uv')
    parts.push(geo)
  }
  if (parts.length === 0) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

/** Flat polygon fills (parks, water, land use) merged into one draw call per material. */
export function buildAreaGeometry(
  polygons: readonly (readonly Vec2[])[],
  y: number,
): BufferGeometry | null {
  const parts: BufferGeometry[] = []
  for (const poly of polygons) {
    if (poly.length < 3) continue
    const geo = new ShapeGeometry(shapeFromPolygon(poly))
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, y, 0)
    geo.deleteAttribute('uv')
    parts.push(geo)
  }
  if (parts.length === 0) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

/**
 * Ribbon mesh along road centerlines. `extra` widens the ribbon (used for the sidewalk layer
 * under the road). Round joints hide wedge gaps where OSM polylines bend.
 */
export function buildRoadGeometry(
  roads: readonly Road[],
  extra: number,
  y: number,
): BufferGeometry | null {
  const pos: number[] = []
  const tri = (a: Vec2, b: Vec2, c: Vec2): void => {
    // Ensure counter-clockwise from above (+y normal) so faces aren't culled.
    const cross = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])
    const [p, q] = cross > 0 ? [b, c] : [c, b]
    pos.push(a[0], y, a[1], p[0], y, p[1], q[0], y, q[1])
  }
  for (const road of roads) {
    const half = road.width / 2 + extra
    const pts = road.points
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i] as Vec2
      const [bx, bz] = pts[i + 1] as Vec2
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 1e-6) continue
      const nx = (-(bz - az) / len) * half
      const nz = ((bx - ax) / len) * half
      const a1: Vec2 = [ax + nx, az + nz]
      const a2: Vec2 = [ax - nx, az - nz]
      const b1: Vec2 = [bx + nx, bz + nz]
      const b2: Vec2 = [bx - nx, bz - nz]
      tri(a1, a2, b1)
      tri(a2, b2, b1)
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const [cx, cz] = pts[i] as Vec2
      const seg = 8
      for (let k = 0; k < seg; k++) {
        const t0 = (k / seg) * Math.PI * 2
        const t1 = ((k + 1) / seg) * Math.PI * 2
        tri(
          [cx, cz],
          [cx + Math.cos(t0) * half, cz + Math.sin(t0) * half],
          [cx + Math.cos(t1) * half, cz + Math.sin(t1) * half],
        )
      }
    }
  }
  if (pos.length === 0) return null
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return geo
}
