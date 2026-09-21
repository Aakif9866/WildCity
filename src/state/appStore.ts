import { create } from 'zustand'

// Top-level app flow and coarse UI selection only. Per-frame simulation state (player, animals)
// must NOT live here — it belongs in game/ modules to avoid React re-renders on every tick.
export type AppPhase = 'menu' | 'loading' | 'playing' | 'paused'

interface AppState {
  phase: AppPhase
  /** Animal close enough to inspect with E (drives the on-screen prompt). */
  promptAnimalId: string | null
  /** Animal whose info panel is open. */
  panelAnimalId: string | null
  /** Animal the camera is following. */
  followAnimalId: string | null
  /** Animal being observed (highlight ring). */
  observedId: string | null
  setPhase: (phase: AppPhase) => void
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
  ...NO_INTERACTION,
  setPhase: (phase) => set(phase === 'menu' ? { phase, ...NO_INTERACTION } : { phase }),
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
