import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { decideDpr } from '@/game/quality'
import { useAppStore } from '@/state/appStore'

const WINDOW_S = 1
const COOLDOWN_S = 3

const deviceMaxDpr = (): number => Math.min(window.devicePixelRatio || 1, 2)

/** `?quality=fixed` turns this off (used for reproducible measurements and screenshots). */
const adaptiveEnabled = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('quality') !== 'fixed'
  } catch {
    return true
  }
}

/** Watches average frame time and lowers/raises the pixel ratio through `decideDpr`. */
export function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr)
  const enabled = useRef(adaptiveEnabled())
  const maxDpr = useRef(deviceMaxDpr())
  const dpr = useRef(deviceMaxDpr())
  // Start with a cooldown so shader compilation and first-frame hitches don't trigger a downgrade.
  const acc = useRef({ time: 0, frames: 0, cooldown: 4 })

  useFrame((_, delta) => {
    if (!enabled.current || useAppStore.getState().phase !== 'playing') return
    const a = acc.current
    if (delta > 0.25) return // a stall (tab in the background, GC): not representative
    a.time += delta
    a.frames++
    a.cooldown -= delta
    if (a.time < WINDOW_S) return
    const avgMs = (a.time / a.frames) * 1000
    a.time = 0
    a.frames = 0
    if (a.cooldown > 0) return
    const next = decideDpr(dpr.current, avgMs, maxDpr.current)
    if (next !== dpr.current) {
      dpr.current = next
      setDpr(next)
      a.cooldown = COOLDOWN_S
    }
  })
  return null
}
