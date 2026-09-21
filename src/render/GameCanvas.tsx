import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import { generateDemoCity } from '@/cities/demo'
import { DebugProbe } from '@/render/DebugProbe'
import { CityScene } from '@/render/world/CityScene'

export function GameCanvas() {
  const city = useMemo(() => generateDemoCity(), [])
  return (
    <Canvas camera={{ position: [140, 110, 190], fov: 55, near: 0.5, far: 1500 }} dpr={[1, 2]}>
      <color attach="background" args={['#9ccbee']} />
      <fog attach="fog" args={['#9ccbee', 250, 900]} />
      <hemisphereLight args={['#dbeeff', '#5b7a4a', 0.9]} />
      <directionalLight position={[120, 200, 80]} intensity={1.6} />
      <CityScene city={city} />
      <DebugProbe />
      {/* Temporary free camera; Phase 2 replaces it with the third-person rig. */}
      <OrbitControls target={[0, 0, 0]} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  )
}
