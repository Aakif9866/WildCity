import { create } from 'zustand'

// Top-level app flow and coarse UI selection only. Per-frame simulation state (player, animals)
// must NOT live here — it belongs in game/ modules to avoid React re-renders on every tick.
export type AppPhase = 'menu' | 'loading' | 'playing' | 'paused'

export const DEFAULT_CITY_ID = 'hyderabad'

/** `?city=<id>` deep link, restricted to the same charset the loader accepts. */
function initialCityId(): string {
  try {
    const id = new URLSearchParams(window.location.search).get('city')
    return id && /^[a-z0-9-]+$/.test(id) ? id : DEFAULT_CITY_ID
  } catch {
    return DEFAULT_CITY_ID
  }
}

interface AppState {
  phase: AppPhase
  /** City the player asked to explore. */
  cityId: string
  /** Why the last load failed (shown on the menu with recovery options). */
  loadError: string | null
  /** Animal close enough to inspect with E (drives the on-screen prompt). */
  promptAnimalId: string | null
  /** Animal whose info panel is open. */
  panelAnimalId: string | null
  /** Animal the camera is following. */
  followAnimalId: string | null
  /** Animal being observed (highlight ring). */
  observedId: string | null
  setPhase: (phase: AppPhase) => void
  startLoading: (cityId: string) => void
  failLoading: (message: string) => void
  pause: () => void
  resume: () => void
  setPrompt: (id: string | null) => void
  openPanel: (id: string) => void
  closePanel: () => void
  observe: (id: string) => void
  startFollow: (id: string) => void
  stopFollow: () => void
  resetInteraction: () => void
}

const NO_INTERACTION = {
  promptAnimalId: null,
  panelAnimalId: null,
  followAnimalId: null,
  observedId: null,
} as const

export const useAppStore = create<AppState>((set, get) => ({
  phase: 'menu',
  cityId: initialCityId(),
  loadError: null,
  ...NO_INTERACTION,
  setPhase: (phase) => set(phase === 'menu' ? { phase, ...NO_INTERACTION } : { phase }),
  startLoading: (cityId) => set({ phase: 'loading', cityId, loadError: null, ...NO_INTERACTION }),
  failLoading: (message) => set({ phase: 'menu', loadError: message }),
  pause: () => get().phase === 'playing' && set({ phase: 'paused' }),
  resume: () => get().phase === 'paused' && set({ phase: 'playing' }),
  setPrompt: (id) => set({ promptAnimalId: id }),
  openPanel: (id) => set({ panelAnimalId: id }),
  closePanel: () => set({ panelAnimalId: null, observedId: null }),
  observe: (id) => set({ observedId: id }),
  // Following replaces the panel with a small banner so the view isn't blocked.
  startFollow: (id) => set({ followAnimalId: id, panelAnimalId: null, observedId: null }),
  stopFollow: () => set({ followAnimalId: null }),
  resetInteraction: () => set({ ...NO_INTERACTION }),
}))
