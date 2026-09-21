import { create } from 'zustand'

// Top-level app flow only. Per-frame simulation state (player, animals) must NOT live here —
// it belongs in game/ modules to avoid React re-renders on every tick.
export type AppPhase = 'menu' | 'loading' | 'playing' | 'paused'

interface AppState {
  phase: AppPhase
  setPhase: (phase: AppPhase) => void
}

export const useAppStore = create<AppState>((set) => ({
  phase: 'menu',
  setPhase: (phase) => set({ phase }),
}))
