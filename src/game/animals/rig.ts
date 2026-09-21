// A rig is a list of animated groups of coloured boxes. It is plain JSON so the same data drives
// the fast procedural renderer at runtime and the offline GLB generator script.
export type RigAnim = 'none' | 'strideA' | 'strideB' | 'flapL' | 'flapR' | 'wag' | 'head'

export interface RigPart {
  size: [number, number, number]
  /** Position relative to the group pivot. */
  pos: [number, number, number]
  /** Hex colour, or "$coat" / "$accent" to use the individual's coat palette. */
  color: string
}

export interface RigGroup {
  name: string
  pivot: [number, number, number]
  anim: RigAnim
  parts: RigPart[]
}

export interface CoatPalette {
  coat: string
  accent: string
}

export interface RigDef {
  coats: CoatPalette[]
  groups: RigGroup[]
}

const isVec3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

const ANIMS: readonly string[] = ['none', 'strideA', 'strideB', 'flapL', 'flapR', 'wag', 'head']

/** Validate untrusted/JSON rig data so a malformed rig degrades instead of crashing the scene. */
export function parseRig(data: unknown): RigDef {
  const groups = (data as { groups?: unknown })?.groups
  if (!Array.isArray(groups) || groups.length === 0) throw new Error('rig: missing groups')
  const rawCoats = (data as { coats?: unknown }).coats
  const coats: CoatPalette[] =
    Array.isArray(rawCoats) && rawCoats.length > 0
      ? rawCoats.map((c: Record<string, unknown>) => ({
          coat: String(c.coat),
          accent: String(c.accent),
        }))
      : [{ coat: '#999999', accent: '#555555' }]
  return {
    coats,
    groups: groups.map((g: Record<string, unknown>, gi) => {
      if (!isVec3(g.pivot) || !Array.isArray(g.parts)) throw new Error(`rig: bad group ${gi}`)
      const anim =
        typeof g.anim === 'string' && ANIMS.includes(g.anim) ? (g.anim as RigAnim) : 'none'
      return {
        name: String(g.name ?? `g${gi}`),
        pivot: g.pivot,
        anim,
        parts: (g.parts as Record<string, unknown>[]).map((p, pi) => {
          if (!isVec3(p.size) || !isVec3(p.pos) || typeof p.color !== 'string')
            throw new Error(`rig: bad part ${gi}.${pi}`)
          return { size: p.size, pos: p.pos, color: p.color }
        }),
      }
    }),
  }
}
