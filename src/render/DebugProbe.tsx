import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

// Exposes read-only render stats for smoke tests and manual profiling (`window.__wildcity`).
export interface WildcityDebug {
  renderInfo: () => { calls: number; triangles: number; geometries: number; textures: number }
  [key: string]: unknown
}

declare global {
  interface Window {
    __wildcity?: WildcityDebug
  }
}

export function DebugProbe() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    window.__wildcity = {
      ...window.__wildcity,
      renderInfo: () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      }),
    }
  }, [gl])
  return null
}
