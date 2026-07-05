import type { Map as MaplibreMap } from 'maplibre-gl'
import type { Feature, LineString } from 'geojson'

export interface FlyoverSample {
  lon: number
  lat: number
  ele: number
  cumDistKm: number
}

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Build densified samples by linear interpolation — avoids turf.lineChunk which drops z coords.
// Target spacing ~10m; preserves original ele values.
export function buildSamples(geojson: Feature<LineString>): FlyoverSample[] {
  const coords = geojson.geometry.coordinates
  if (coords.length < 2) return []

  const TARGET_KM = 0.01 // ~10m spacing
  const samples: FlyoverSample[] = []
  let cumDistKm = 0

  samples.push({ lon: coords[0][0], lat: coords[0][1], ele: coords[0][2] ?? 0, cumDistKm: 0 })

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]
    const cur = coords[i]
    const segKm = haversineKm(prev[0], prev[1], cur[0], cur[1])

    if (segKm < 0.0001) continue // duplicate point, skip

    const steps = Math.max(1, Math.ceil(segKm / TARGET_KM))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const lon = prev[0] + (cur[0] - prev[0]) * t
      const lat = prev[1] + (cur[1] - prev[1]) * t
      const ele = (prev[2] ?? 0) + ((cur[2] ?? 0) - (prev[2] ?? 0)) * t
      cumDistKm += segKm / steps
      samples.push({ lon, lat, ele, cumDistKm })
    }
  }

  return samples
}

export class FlyoverEngine {
  private samples: FlyoverSample[] = []
  private rafId: number | null = null
  private lastTimestamp: number | null = null

  playing = false
  progress = 0 // 0..1
  speedMultiplier = 1
  onProgress: ((p: number) => void) | null = null
  // Called each frame with the current WGS84 position — caller handles marker update and coord transform
  onPositionUpdate: ((lon: number, lat: number) => void) | null = null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private map: MaplibreMap | null = null

  init(map: MaplibreMap, samples: FlyoverSample[]) {
    this.map = map
    this.samples = samples
    this.progress = 0
    this.playing = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  play() {
    if (!this.map || this.samples.length < 2) return
    if (this.progress >= 1) this.progress = 0
    this.playing = true
    this.lastTimestamp = null
    this._loop()
  }

  pause() {
    this.playing = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  seek(progress: number) {
    this.progress = Math.max(0, Math.min(1, progress))
    this._emitPosition(this.progress)
    this.onProgress?.(this.progress)
  }

  private _loop() {
    this.rafId = requestAnimationFrame((ts) => {
      if (!this.playing) return

      if (this.lastTimestamp !== null) {
        const dtSec = Math.min((ts - this.lastTimestamp) / 1000, 0.1)
        const baseProgressPerSec = 1 / 120
        this.progress += dtSec * baseProgressPerSec * this.speedMultiplier
        if (this.progress >= 1) {
          this.progress = 1
          this.playing = false
          this._emitPosition(1)
          this.onProgress?.(1)
          return
        }
        this._emitPosition(this.progress)
        this.onProgress?.(this.progress)
      }
      this.lastTimestamp = ts
      this._loop()
    })
  }

  private _emitPosition(progress: number) {
    if (this.samples.length < 2) return
    const lastIdx = this.samples.length - 1
    const idx = Math.min(Math.floor(progress * lastIdx), lastIdx)
    const cur = this.samples[idx]
    if (!isFinite(cur.lon) || !isFinite(cur.lat)) return
    this.onPositionUpdate?.(cur.lon, cur.lat)
  }

  destroy() {
    this.pause()
  }
}

export const flyoverEngine = new FlyoverEngine()
