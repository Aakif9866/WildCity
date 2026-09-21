// Build-time pipeline: OpenStreetMap (Overpass) -> local-metre CityData -> static JSON in public/cities.
// The game never talks to Overpass at runtime.
//
// Usage: npm run city -- --id hyderabad --name Hyderabad --country India \
//          --lat 17.413 --lon 78.472 --half 350 [--desc "..."] [--refresh]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { convertOverpass } from '../src/cities/osm/convert'
import type { CityMetadata } from '../src/cities/types'
import { boundingBox } from '../src/game/world/geo'

const arg = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  const v = i >= 0 ? process.argv[i + 1] : fallback
  if (v === undefined) throw new Error(`missing --${name}`)
  return v
}
const id = arg('id')
const name = arg('name')
const country = arg('country')
const center = { lat: Number(arg('lat')), lon: Number(arg('lon')) }
const halfSize = Number(arg('half', '350'))
const description = arg('desc', '')
const refresh = process.argv.includes('--refresh')

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

function query(bbox: [number, number, number, number]): string {
  const b = bbox.map((n) => n.toFixed(6)).join(',')
  return `[out:json][timeout:90];
(
  way["building"](${b});
  relation["building"](${b});
  way["highway"](${b});
  way["leisure"~"^(park|garden|playground|recreation_ground|pitch|golf_course|nature_reserve)$"](${b});
  relation["leisure"~"^(park|garden|recreation_ground)$"](${b});
  way["landuse"~"^(grass|recreation_ground|forest|meadow|village_green|cemetery|orchard|residential|commercial|retail|industrial|reservoir|basin)$"](${b});
  way["natural"~"^(water|wood|scrub|grassland|heath)$"](${b});
  relation["natural"~"^(water|wood)$"](${b});
  way["waterway"="riverbank"](${b});
  node["natural"="tree"](${b});
);
out geom;`
}

async function fetchOverpass(bbox: [number, number, number, number]): Promise<unknown> {
  let lastError: unknown
  for (const url of MIRRORS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Overpass: ${url} (attempt ${attempt})`)
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'WildCity/0.1 (build-city script)',
          },
          body: `data=${encodeURIComponent(query(bbox))}`,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
      } catch (e) {
        lastError = e
        console.warn(`  failed: ${String(e)}`)
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }
  throw new Error(`All Overpass mirrors failed: ${String(lastError)}`)
}

const rawPath = `data/raw/${id}.json`
mkdirSync('data/raw', { recursive: true })
let raw: unknown
if (!refresh && existsSync(rawPath)) {
  console.log(`Using cached ${rawPath} (pass --refresh to re-download)`)
  raw = JSON.parse(readFileSync(rawPath, 'utf8'))
} else {
  raw = await fetchOverpass(boundingBox(center, halfSize + 30)) // small margin so edge features clip cleanly
  writeFileSync(rawPath, JSON.stringify(raw))
}

const { city, report } = convertOverpass(raw, {
  id,
  name,
  country,
  center,
  halfSize,
  description,
  attribution: '© OpenStreetMap contributors (ODbL)',
})
console.log('Converted:', JSON.stringify(report, null, 2))
if (city.buildings.length === 0 && city.roads.length === 0)
  throw new Error('No usable data: check the coordinates')

// Round to centimetres: keeps files small without visible change.
const round = (_k: string, v: unknown): unknown =>
  typeof v === 'number' ? Math.round(v * 100) / 100 : v
const dir = `public/cities/${id}`
mkdirSync(dir, { recursive: true })
// Only local-metre geometry is rounded: metadata holds real lat/lon that must keep full precision.
const write = (file: string, data: unknown, rounded = true): void =>
  writeFileSync(`${dir}/${file}`, JSON.stringify(data, rounded ? round : undefined))
write('metadata.json', city.metadata, false)
write('roads.json', city.roads)
write('buildings.json', city.buildings)
write('zones.json', { areas: city.zones, trees: city.trees })

// Keep the city index (used by the selector) in sync.
const indexPath = 'public/cities/index.json'
const index: Pick<CityMetadata, 'id' | 'name' | 'country' | 'center' | 'description'>[] =
  existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : []
const entry = { id, name, country, center, description }
const at = index.findIndex((c) => c.id === id)
if (at >= 0) index[at] = entry
else index.push(entry)
writeFileSync(indexPath, JSON.stringify(index, null, 2))
console.log(`Wrote ${dir}/ and updated ${indexPath}`)
