// Faint walls at the map edge so the player understands why they can't go further.
export function Boundary({ halfSize }: { halfSize: number }) {
  const h = 30
  const len = halfSize * 2
  const sides: { pos: [number, number, number]; rotY: number }[] = [
    { pos: [0, h / 2, -halfSize], rotY: 0 },
    { pos: [0, h / 2, halfSize], rotY: 0 },
    { pos: [-halfSize, h / 2, 0], rotY: Math.PI / 2 },
    { pos: [halfSize, h / 2, 0], rotY: Math.PI / 2 },
  ]
  return (
    <group>
      {sides.map((s, i) => (
        <mesh key={i} position={s.pos} rotation-y={s.rotY}>
          <planeGeometry args={[len, h]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.08}
            depthWrite={false}
            side={2}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}
