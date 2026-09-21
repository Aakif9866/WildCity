import { useFrame, useLoader } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SPECIES } from '@/game/animals/species'
import type { Animal } from '@/game/animals/types'
import { AnimalErrorBoundary } from './AnimalErrorBoundary'
import type { AnimalVisual } from './AnimalVisual'
import { GlbAnimal } from './GlbAnimal'
import { ProceduralAnimal } from './ProceduralAnimal'

function VisualHost({ animal, visual }: { animal: Animal; visual: AnimalVisual }) {
  useEffect(() => () => visual.dispose(), [visual])
  useFrame((state, delta) => visual.update(animal, state.clock.elapsedTime, Math.min(delta, 0.05)))
  return <primitive object={visual.root} />
}

function ProceduralView({ animal }: { animal: Animal }) {
  const visual = useMemo(
    () => new ProceduralAnimal(animal.species as keyof typeof SPECIES, animal.coat),
    [animal.species, animal.coat],
  )
  return <VisualHost animal={animal} visual={visual} />
}

function GlbView({ animal, url }: { animal: Animal; url: string }) {
  // Plain GLTFLoader (cached + suspending via R3F). Our models are tens of KB, so Draco/Meshopt decoders
  // would cost more than they save; add them to the loader here if models ever get large.
  const gltf = useLoader(GLTFLoader, url)
  const visual = useMemo(() => new GlbAnimal(gltf.scene, gltf.animations), [gltf])
  return <VisualHost animal={animal} visual={visual} />
}

export function AnimalView({ animal }: { animal: Animal }) {
  const species = SPECIES[animal.species as keyof typeof SPECIES]
  const fallback = <ProceduralView animal={animal} />
  if (!species.modelUrl) return fallback
  return (
    <AnimalErrorBoundary fallback={fallback} label={animal.id}>
      <Suspense fallback={fallback}>
        <GlbView animal={animal} url={species.modelUrl} />
      </Suspense>
    </AnimalErrorBoundary>
  )
}
