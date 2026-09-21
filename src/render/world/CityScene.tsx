import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Color, InstancedMesh, Object3D } from 'three'
import { SIDEWALK_WIDTH, type AreaZoneKind, type CityData } from '@/cities/types'
import { mulberry32, randRange } from '@/utils/random'
import { buildAreaGeometry, buildBuildingsGeometry, buildRoadGeometry } from './builders'

// Shared, module-level materials props: one material per look, reused everywhere.
const AREA_STYLE: Record<AreaZoneKind, { color: string; y: number }> = {
  RESIDENTIAL: { color: '#7fa66a', y: 0.02 },
  COMMERCIAL: { color: '#9aa389', y: 0.02 },
  PARK: { color: '#4f9a4a', y: 0.04 },
  WATER: { color: '#3f86c4', y: 0.06 },
}

function useDispose(geo: BufferGeometry | null): BufferGeometry | null {
  useEffect(() => () => geo?.dispose(), [geo])
  return geo
}

function Areas({ city }: { city: CityData }) {
  const kinds = Object.keys(AREA_STYLE) as AreaZoneKind[]
  return (
    <>
      {kinds.map((kind) => (
        <AreaLayer key={kind} city={city} kind={kind} />
      ))}
    </>
  )
}

function AreaLayer({ city, kind }: { city: CityData; kind: AreaZoneKind }) {
  const geo = useDispose(
    useMemo(
      () =>
        buildAreaGeometry(
          city.zones.filter((z) => z.kind === kind).map((z) => z.polygon),
          AREA_STYLE[kind].y,
        ),
      [city, kind],
    ),
  )
  if (!geo) return null
  return (
    <mesh geometry={geo}>
      <meshLambertMaterial color={AREA_STYLE[kind].color} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  )
}

function Roads({ city }: { city: CityData }) {
  const sidewalks = useDispose(
    useMemo(() => buildRoadGeometry(city.roads, SIDEWALK_WIDTH, 0.08), [city]),
  )
  const asphalt = useDispose(useMemo(() => buildRoadGeometry(city.roads, 0, 0.1), [city]))
  return (
    <>
      {sidewalks && (
        <mesh geometry={sidewalks}>
          <meshLambertMaterial color="#b9b7ae" polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      {asphalt && (
        <mesh geometry={asphalt}>
          <meshLambertMaterial color="#5d646e" polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      )}
    </>
  )
}

function Buildings({ city }: { city: CityData }) {
  const geo = useDispose(useMemo(() => buildBuildingsGeometry(city.buildings), [city]))
  if (!geo) return null
  return (
    <mesh geometry={geo}>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}

const dummy = new Object3D()

function Trees({ city }: { city: CityData }) {
  const trunks = useRef<InstancedMesh>(null)
  const crowns = useRef<InstancedMesh>(null)
  const count = city.trees.length

  useLayoutEffect(() => {
    const t = trunks.current
    const c = crowns.current
    if (!t || !c) return
    const rng = mulberry32(99)
    const color = new Color()
    city.trees.forEach(([x, z], i) => {
      const s = randRange(rng, 0.8, 1.35)
      dummy.rotation.set(0, rng() * Math.PI, 0)
      dummy.scale.set(s, s, s)
      dummy.position.set(x, 1 * s, z)
      dummy.updateMatrix()
      t.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, 3.2 * s, z)
      dummy.updateMatrix()
      c.setMatrixAt(i, dummy.matrix)
      c.setColorAt(i, color.setHSL(randRange(rng, 0.27, 0.36), 0.5, randRange(rng, 0.28, 0.4)))
    })
    t.instanceMatrix.needsUpdate = true
    c.instanceMatrix.needsUpdate = true
    if (c.instanceColor) c.instanceColor.needsUpdate = true
  }, [city])

  if (count === 0) return null
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, count]}>
        {/* Open-ended: the caps are never visible (top hidden in the crown, bottom on the ground) and
            trees are ~80% of a dense city's triangles. */}
        <cylinderGeometry args={[0.2, 0.3, 2, 5, 1, true]} />
        <meshLambertMaterial color="#6b4a2f" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, count]}>
        <icosahedronGeometry args={[1.8, 0]} />
        <meshLambertMaterial />
      </instancedMesh>
    </>
  )
}

export function CityScene({ city }: { city: CityData }) {
  const size = city.metadata.halfSize * 2 + 400
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[size, size]} />
        <meshLambertMaterial color="#6f9b5a" />
      </mesh>
      <Areas city={city} />
      <Roads city={city} />
      <Buildings city={city} />
      <Trees city={city} />
    </group>
  )
}
