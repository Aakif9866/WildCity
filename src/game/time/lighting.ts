import { normalizeHour } from './clock'

export type Rgb = [number, number, number]

/** Everything the renderer needs to light the world at a given hour. Colours are sRGB 0..1. */
export interface LightingState {
  /** Where the sun really is (unit vector, may be below the horizon). */
  sunPosition: [number, number, number]
  /** Where the moon is: opposite the sun. */
  moonPosition: [number, number, number]
  /** Direction the main directional light comes from: the sun by day, the moon by night (always above the horizon). */
  lightDirection: [number, number, number]
  lightColor: Rgb
  lightIntensity: number
  hemiSky: Rgb
  hemiGround: Rgb
  hemiIntensity: number
  /** Sky background and fog colour. */
  sky: Rgb
  /** 0..1 star visibility. */
  stars: number
}

const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb

interface Keyframe {
  hour: number
  sky: Rgb
  light: Rgb
  lightIntensity: number
  hemiSky: Rgb
  hemiGround: Rgb
  hemiIntensity: number
  stars: number
}
const key = (
  hour: number,
  sky: string,
  light: string,
  lightIntensity: number,
  hemiSky: string,
  hemiGround: string,
  hemiIntensity: number,
  stars: number,
): Keyframe => ({
  hour,
  sky: hex(sky),
  light: hex(light),
  lightIntensity,
  hemiSky: hex(hemiSky),
  hemiGround: hex(hemiGround),
  hemiIntensity,
  stars,
})

// The day, keyframed. Night keeps enough (moonlit-blue) light that streets, animals and the player stay readable: lighting is
// multiplied in linear space, so 'dark blue' ambient values look far darker on screen than they read as hex.
const KEYFRAMES: Keyframe[] = [
  key(0, '#0b1230', '#a9bdf5', 0.7, '#8ea3df', '#33405f', 1.1, 1),
  key(4.5, '#0b1230', '#a9bdf5', 0.7, '#8ea3df', '#33405f', 1.1, 1),
  key(5.75, '#e8956b', '#ffb27a', 0.7, '#b3b8dc', '#5c5966', 1.15, 0.35),
  key(7.5, '#a9cfee', '#fff0d4', 1.0, '#dbeeff', '#7a8f66', 1.25, 0),
  key(12, '#8fc3ee', '#ffffff', 1.1, '#e6f2ff', '#7a8f66', 1.5, 0),
  key(16.5, '#a3cbee', '#ffe8c4', 1.0, '#e2eefc', '#7a8f66', 1.3, 0),
  key(18.5, '#f0895c', '#ff9c5b', 0.8, '#d9b6c4', '#66596a', 1.3, 0.1),
  key(20, '#333a6e', '#93a6e6', 0.55, '#6f80c0', '#2c3550', 1.05, 0.7),
  key(21.25, '#0b1230', '#a9bdf5', 0.7, '#8ea3df', '#33405f', 1.1, 1),
  key(24, '#0b1230', '#a9bdf5', 0.7, '#8ea3df', '#33405f', 1.1, 1),
]

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const mixN = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Lighting for an hour of the day. Pure: weather (later) can wrap this by scaling intensities
 * and desaturating colours without touching the renderer.
 */
export function lightingAt(hourIn: number): LightingState {
  const hour = normalizeHour(hourIn)
  let i = 0
  while (i < KEYFRAMES.length - 2 && (KEYFRAMES[i + 1] as Keyframe).hour <= hour) i++
  const a = KEYFRAMES[i] as Keyframe
  const b = KEYFRAMES[i + 1] as Keyframe
  const t = (hour - a.hour) / (b.hour - a.hour)

  // Sun rises in the east (+x) at 06:00, is overhead at 12:00 and sets in the west at 18:00.
  const angle = ((hour - 6) / 12) * Math.PI
  const norm = (v: [number, number, number]): [number, number, number] => {
    const len = Math.hypot(v[0], v[1], v[2])
    return [v[0] / len, v[1] / len, v[2] / len]
  }
  const sun = norm([Math.cos(angle), Math.sin(angle), 0.35])
  const moon: [number, number, number] = [-sun[0], -sun[1], -sun[2]]
  const lightDir = sun[1] > 0.05 ? sun : moon[1] > 0.05 ? moon : norm([sun[0], 0.05, sun[2]])

  return {
    sunPosition: sun,
    moonPosition: moon,
    lightDirection: lightDir,
    lightColor: mix(a.light, b.light, t),
    lightIntensity: mixN(a.lightIntensity, b.lightIntensity, t),
    hemiSky: mix(a.hemiSky, b.hemiSky, t),
    hemiGround: mix(a.hemiGround, b.hemiGround, t),
    hemiIntensity: mixN(a.hemiIntensity, b.hemiIntensity, t),
    sky: mix(a.sky, b.sky, t),
    stars: mixN(a.stars, b.stars, t),
  }
}
