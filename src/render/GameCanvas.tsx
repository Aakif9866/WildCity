import { Canvas } from '@react-three/fiber'

// Foundation placeholder: proves the R3F pipeline works. Phase 1 replaces this with the real scene.
export function GameCanvas() {
  return (
    <Canvas camera={{ position: [4, 3, 6], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={['#87b8e8']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#5b8c4a" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry />
        <meshStandardMaterial color="#d9a066" />
      </mesh>
    </Canvas>
  )
}
