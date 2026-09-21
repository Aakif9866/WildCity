import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { env } from '@/config/env'

interface ChromeMemory {
  usedJSHeapSize: number
}

const wantedFromUrl = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).has('stats')
  } catch {
    return false
  }
}

/**
 * Tiny FPS / draw-call / memory readout for measuring on real devices. Off by default; enable with
 * `?stats`, `VITE_DEBUG_STATS=true`, or toggle with F3. It is a plain DOM node updated twice a
 * second, so it costs nothing per frame and never touches React state.
 */
export function StatsOverlay() {
  const gl = useThree((s) => s.gl)
  const el = useRef<HTMLDivElement | null>(null)
  const frames = useRef({ time: 0, count: 0, worst: 0 })

  useEffect(() => {
    const div = document.createElement('div')
    div.setAttribute('data-testid', 'stats')
    div.className =
      'pointer-events-none fixed top-12 left-3 z-50 rounded bg-black/60 px-2 py-1 font-mono text-[11px] text-emerald-300'
    div.style.display = env.debugStats || wantedFromUrl() ? 'block' : 'none'
    document.body.appendChild(div)
    el.current = div

    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'F3') {
        e.preventDefault()
        div.style.display = div.style.display === 'none' ? 'block' : 'none'
      }
    }
    window.addEventListener('keydown', onKey)
    const timer = window.setInterval(() => {
      const f = frames.current
      if (div.style.display === 'none' || f.count === 0) return
      const avg = (f.time / f.count) * 1000
      const info = gl.info
      const mem = (performance as Performance & { memory?: ChromeMemory }).memory
      div.textContent = [
        `${(f.count / f.time).toFixed(0)} fps`,
        `${avg.toFixed(1)} ms (worst ${(f.worst * 1000).toFixed(0)})`,
        `${info.render.calls} calls`,
        `${(info.render.triangles / 1000).toFixed(1)}k tris`,
        `dpr ${gl.getPixelRatio().toFixed(2)}`,
        mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      f.time = f.count = f.worst = 0
    }, 500)

    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(timer)
      div.remove()
    }
  }, [gl])

  useFrame((_, delta) => {
    const f = frames.current
    f.time += delta
    f.count++
    if (delta > f.worst) f.worst = delta
  })
  return null
}
