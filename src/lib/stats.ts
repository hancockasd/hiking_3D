import { length } from '@turf/length'
import type { Feature, LineString } from 'geojson'
import type { TrackPoint } from './gpxParser'

export interface TrackStats {
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  maxEleM: number
  minEleM: number
  durationMs: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  elevationProfile: { cumDistKm: number; ele: number }[]
}

function rollingMedian(arr: number[], window: number): number[] {
  return arr.map((_, i) => {
    const half = Math.floor(window / 2)
    const start = Math.max(0, i - half)
    const end = Math.min(arr.length, i + half + 1)
    const slice = arr.slice(start, end).sort((a, b) => a - b)
    return slice[Math.floor(slice.length / 2)]
  })
}

function ema(arr: number[], alpha: number): number[] {
  const out: number[] = [arr[0]]
  for (let i = 1; i < arr.length; i++) {
    out.push(alpha * arr[i] + (1 - alpha) * out[i - 1])
  }
  return out
}

export function calcStats(points: TrackPoint[], _geojson: Feature<LineString>): TrackStats {
  if (points.length < 2) {
    return {
      distanceKm: 0, elevationGainM: 0, elevationLossM: 0,
      maxEleM: 0, minEleM: 0, durationMs: 0,
      avgSpeedKmh: 0, maxSpeedKmh: 0, elevationProfile: [],
    }
  }

  // Distance is computed as sum of per-segment lengths (same loop below),
  // so initialise here and assign after the loop
  let distanceKm = 0

  // Elevation gain/loss.
  // Apple Health samples at ~1Hz, so per-sample deltas are tiny (a few cm).
  // A per-step delta threshold (e.g. > 3m) would zero out real climbs.
  // Strategy: strong low-pass (rolling median then EMA) to kill barometric noise,
  // then sum all positive/negative deltas of the smoothed series.
  const rawEles = points.map((p) => p.ele)
  const medianEles = rollingMedian(rawEles, 15)
  const smoothedEles = ema(medianEles, 0.1)
  let gain = 0, loss = 0
  for (let i = 1; i < smoothedEles.length; i++) {
    const delta = smoothedEles[i] - smoothedEles[i - 1]
    if (delta > 0) gain += delta
    else loss += -delta
  }

  const maxEleM = Math.max(...rawEles)
  const minEleM = Math.min(...rawEles)

  // Duration
  const validTimes = points.filter((p) => p.time > 0)
  const durationMs = validTimes.length >= 2
    ? validTimes[validTimes.length - 1].time - validTimes[0].time
    : 0

  // Speed per segment
  const speeds: number[] = []
  let cumDistKm = 0
  const profile: { cumDistKm: number; ele: number }[] = [{ cumDistKm: 0, ele: rawEles[0] }]

  for (let i = 1; i < points.length; i++) {
    const segGeo: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [points[i - 1].lon, points[i - 1].lat],
          [points[i].lon, points[i].lat],
        ],
      },
    }
    const segKm = length(segGeo, { units: 'kilometers' })
    // skip obviously bad GPS segments (> 2km between consecutive points)
    if (segKm > 2) {
      profile.push({ cumDistKm, ele: rawEles[i] })
      continue
    }
    cumDistKm += segKm
    distanceKm += segKm
    profile.push({ cumDistKm, ele: rawEles[i] })

    if (points[i - 1].time > 0 && points[i].time > 0) {
      const dtH = (points[i].time - points[i - 1].time) / 3_600_000
      if (dtH > 0) speeds.push(segKm / dtH)
    }
  }

  const smoothedSpeeds = speeds.length > 0 ? ema(speeds, 0.3) : []
  const movingSpeeds = smoothedSpeeds.filter((s) => s > 0.3)
  const avgSpeedKmh = movingSpeeds.length > 0
    ? movingSpeeds.reduce((a, b) => a + b, 0) / movingSpeeds.length
    : 0
  const maxSpeedKmh = smoothedSpeeds.length > 0 ? Math.max(...smoothedSpeeds) : 0

  return {
    distanceKm,
    elevationGainM: Math.round(gain),
    elevationLossM: Math.round(loss),
    maxEleM: Math.round(maxEleM),
    minEleM: Math.round(minEleM),
    durationMs,
    avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
    maxSpeedKmh: Math.round(maxSpeedKmh * 10) / 10,
    elevationProfile: profile,
  }
}
