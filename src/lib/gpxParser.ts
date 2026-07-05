import { gpx } from '@tmcw/togeojson'

export interface TrackPoint {
  lon: number
  lat: number
  ele: number
  time: number // unix ms, 0 if missing
}

export interface ParsedTrack {
  name: string
  points: TrackPoint[]
  geojson: GeoJSON.Feature<GeoJSON.LineString>
}

const MAX_SEG_KM = 5 // discard GPS spike segments longer than this

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function parseGpx(xmlText: string): ParsedTrack {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const fc = gpx(doc)

  const feature = fc.features.find(
    (f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString',
  )
  if (!feature) throw new Error('GPX 中未找到轨迹线段')

  const name: string =
    (feature.properties as Record<string, unknown>)?.name as string || '未命名轨迹'

  // Flatten MultiLineString segments, preserving z (ele) — use flat(1) on the segments array
  let coords: number[][]
  if (feature.geometry.type === 'MultiLineString') {
    const segments = (feature.geometry as GeoJSON.MultiLineString).coordinates
    coords = []
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s]
      for (let i = 0; i < seg.length; i++) {
        // skip duplicate junction point at segment start (except first segment)
        if (s > 0 && i === 0) continue
        coords.push(seg[i])
      }
    }
  } else {
    coords = (feature.geometry as GeoJSON.LineString).coordinates
  }

  const times: number[] = (() => {
    const props = feature.properties as Record<string, unknown>
    const raw = (props?.coordinateProperties as Record<string, unknown>)?.times
      ?? props?.coordTimes
    if (Array.isArray(raw)) {
      const flat = feature.geometry.type === 'MultiLineString'
        ? (raw as string[][]).flat()
        : (raw as string[])
      return flat.map((t: string) => t ? new Date(t).getTime() : 0)
    }
    return coords.map(() => 0)
  })()

  // Build raw points
  const rawPoints: TrackPoint[] = coords.map((c, i) => ({
    lon: c[0],
    lat: c[1],
    ele: typeof c[2] === 'number' && isFinite(c[2]) ? c[2] : 0,
    time: times[i] ?? 0,
  }))

  // Filter out GPS spike points: skip any point where the jump from the
  // previous *accepted* point exceeds MAX_SEG_KM
  const points: TrackPoint[] = []
  for (const pt of rawPoints) {
    if (!isFinite(pt.lon) || !isFinite(pt.lat)) continue
    if (points.length === 0) {
      points.push(pt)
      continue
    }
    const prev = points[points.length - 1]
    const dist = haversineKm(prev.lon, prev.lat, pt.lon, pt.lat)
    if (dist <= MAX_SEG_KM) {
      points.push(pt)
    }
    // else: silently drop the spike point
  }

  if (points.length < 2) throw new Error('轨迹有效点不足，可能数据损坏')

  const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: { name },
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.lon, p.lat, p.ele]),
    },
  }

  return { name, points, geojson }
}

export async function sha1(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const hashBuf = await crypto.subtle.digest('SHA-1', buf)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
