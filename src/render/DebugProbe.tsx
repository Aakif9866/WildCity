import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { GameSession } from '@/game/session'

// Exposes render stats and the live session for smoke tests and manual profiling (`window.__wildcity`).
export interface WildcityDebug {
  renderInfo: () => { calls: number; triangles: number; geometries: number; textures: number }
  session: GameSession
}

declare global {
  interface Window {
    __wildcity?: WildcityDebug
  }
}

export function DebugProbe({ session }: { session: GameSession }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    window.__wildcity = {
      session,
      renderInfo: () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      }),
    }
    return () => {
      delete window.__wildcity
    }
  }, [gl, session])
  return null
}
