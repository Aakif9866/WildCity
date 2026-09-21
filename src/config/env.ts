// Single access point for build-time config so components never read import.meta.env directly.
export const env = {
  overpassUrl: import.meta.env.VITE_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
  debugStats: import.meta.env.VITE_DEBUG_STATS === 'true',
} as const
