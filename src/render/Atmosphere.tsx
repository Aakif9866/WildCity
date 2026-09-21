import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  HemisphereLight,
  Mesh,
  Points,
  type PointsMaterial,
  SRGBColorSpace,
} from 'three'
import { recordAtmosphere, type GameSession } from '@/game/session'
import { lightingAt } from '@/game/time/lighting'
import { mulberry32 } from '@/utils/random'

// Reused every frame so the sky costs no allocations.
const SCRATCH = new Color()
const SKY_DISTANCE = 900
const STAR_COUNT = 450

/** Random points on the upper hemisphere: the stars. Seeded so the sky is the same every night. */
function makeStars(): BufferGeometry {
  const rng = mulberry32(2024)
  const pos: number[] = []
  while (pos.length < STAR_COUNT * 3) {
    const x = rng() * 2 - 1
    const y = rng()
    const z = rng() * 2 - 1
    const len = Math.hypot(x, y, z)
    if (len > 1 || len < 0.2 || y / len < 0.03) continue
    pos.push((x / len) * 1000, (y / len) * 1000, (z / len) * 1000)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  return g
}

/**
 * Sky, fog, sun/moon lighting and the celestial bodies, all driven by the game clock through
 * the pure `lightingAt` model. Mutates three objects directly each frame (no React state).
 */
export function Atmosphere({ session }: { session: GameSession }) {
  const hemi = useRef<HemisphereLight>(null)
  const dir = useRef<DirectionalLight>(null)
  const sun = useRef<Mesh>(null)
  const moon = useRef<Mesh>(null)
  const stars = useRef<Points>(null)
  const starGeo = useMemo(() => makeStars(), [])
  const starMat = useRef<PointsMaterial>(null)

  useFrame(({ scene, camera }) => {
    const l = lightingAt(session.clock.hour)
    SCRATCH.setRGB(l.sky[0], l.sky[1], l.sky[2], SRGBColorSpace)
    if (scene.background instanceof Color) scene.background.copy(SCRATCH)
    scene.fog?.color.copy(SCRATCH)

    const h = hemi.current
    if (h) {
      h.color.setRGB(l.hemiSky[0], l.hemiSky[1], l.hemiSky[2], SRGBColorSpace)
      h.groundColor.setRGB(l.hemiGround[0], l.hemiGround[1], l.hemiGround[2], SRGBColorSpace)
      h.intensity = l.hemiIntensity
    }
    const d = dir.current
    if (d) {
      d.color.setRGB(l.lightColor[0], l.lightColor[1], l.lightColor[2], SRGBColorSpace)
      d.intensity = l.lightIntensity
      d.position.set(
        l.lightDirection[0] * 200,
        l.lightDirection[1] * 200,
        l.lightDirection[2] * 200,
      )
    }
    // Sun, moon and stars ride with the camera so they sit at infinity.
    const place = (m: Mesh | null, p: [number, number, number]): void => {
      if (!m) return
      m.visible = p[1] > -0.06
      m.position.set(
        camera.position.x + p[0] * SKY_DISTANCE,
        camera.position.y + p[1] * SKY_DISTANCE,
        camera.position.z + p[2] * SKY_DISTANCE,
      )
    }
    place(sun.current, l.sunPosition)
    place(moon.current, l.moonPosition)
    const s = stars.current
    if (s) {
      s.position.copy(camera.position)
      s.visible = l.stars > 0.01
      if (starMat.current) starMat.current.opacity = l.stars
    }

    recordAtmosphere(session, {
      lightIntensity: l.lightIntensity,
      hemiIntensity: l.hemiIntensity,
      sky: `#${SCRATCH.getHexString(SRGBColorSpace)}`,
      stars: l.stars,
    })
  })

  return (
    <>
      <color attach="background" args={['#9ccbee']} />
      <fog attach="fog" args={['#9ccbee', 200, 800]} />
      <hemisphereLight ref={hemi} />
      <directionalLight ref={dir} />
      <mesh ref={sun}>
        <sphereGeometry args={[34, 16, 12]} />
        <meshBasicMaterial color="#fff2c2" fog={false} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={moon}>
        <sphereGeometry args={[24, 16, 12]} />
        <meshBasicMaterial color="#dfe7ff" fog={false} toneMapped={false} depthWrite={false} />
      </mesh>
      <points ref={stars} geometry={starGeo} frustumCulled={false}>
        <pointsMaterial
          ref={starMat}
          color="#ffffff"
          size={2}
          sizeAttenuation={false}
          transparent
          depthWrite={false}
          fog={false}
        />
      </points>
    </>
  )
}
