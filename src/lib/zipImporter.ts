import JSZip from 'jszip'
import { parseGpx } from './gpxParser'

export interface TrackMeta {
  filename: string   // original path inside zip
  name: string       // workout name from GPX
  date: Date         // workout start date
  durationMin: number
  distanceKm: number // rough estimate from point count (fast pass)
  gpxText: string    // full raw GPX content
}

// Apple Health exports routes into: workout-routes/*.gpx
// Filenames look like: Route_2024-07-15_8.04am.gpx
const ROUTE_PATH_RE = /workout-routes\/(.+\.gpx)$/i

function parseDateFromFilename(filename: string): Date | null {
  // Pattern: Route_YYYY-MM-DD_H.MMam|pm.gpx
  const m = filename.match(/(\d{4}-\d{2}-\d{2})_(\d+)\.(\d+)(am|pm)/i)
  if (!m) return null
  const [, datePart, hours, minutes, ampm] = m
  let h = parseInt(hours, 10)
  const min = parseInt(minutes, 10)
  if (ampm.toLowerCase() === 'pm' && h !== 12) h += 12
  if (ampm.toLowerCase() === 'am' && h === 12) h = 0
  const d = new Date(`${datePart}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`)
  return isNaN(d.getTime()) ? null : d
}

function parseDateFromGpx(xml: string): Date | null {
  // Apple Health GPX structure:
  //   <metadata><time>2026-07-04T...</time></metadata>  ← export timestamp, NOT workout time
  //   <trkseg><trkpt ...><time>2024-08-15T...</time>    ← actual workout start time
  // We must skip <metadata> and find the first <trkpt> time.
  const trkptMatch = xml.match(/<trkpt[^>]*>[\s\S]*?<time>([^<]+)<\/time>/)
  if (trkptMatch) {
    const d = new Date(trkptMatch[1])
    if (!isNaN(d.getTime())) return d
  }
  // Fallback: any <time> tag (for plain GPX files without metadata block)
  const m = xml.match(/<time>([^<]+)<\/time>/)
  if (!m) return null
  const d = new Date(m[1])
  return isNaN(d.getTime()) ? null : d
}

function estimateDuration(xml: string): number {
  // collect only trkpt times, skip metadata time
  const times = [...xml.matchAll(/<trkpt[^>]*>[\s\S]*?<time>([^<]+)<\/time>/g)]
  if (times.length < 2) return 0
  const start = new Date(times[0][1])
  const end = new Date(times[times.length - 1][1])
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

function estimateDistanceKm(xml: string): number {
  // Extract lat/lon from trkpt tags — handle either attribute order
  const tagMatches = [...xml.matchAll(/<trkpt\s([^>]+)>/g)]
  if (tagMatches.length < 2) return 0

  const points: { lat: number; lon: number }[] = []
  for (const m of tagMatches) {
    const attrs = m[1]
    const latM = attrs.match(/lat="([^"]+)"/)
    const lonM = attrs.match(/lon="([^"]+)"/)
    if (!latM || !lonM) continue
    const lat = parseFloat(latM[1]), lon = parseFloat(lonM[1])
    if (isFinite(lat) && isFinite(lon)) points.push({ lat, lon })
  }

  if (points.length < 2) return 0
  const R = 6371
  let dist = 0
  for (let i = 1; i < points.length; i++) {
    const { lat: lat1, lon: lon1 } = points[i - 1]
    const { lat: lat2, lon: lon2 } = points[i]
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
    dist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return Math.round(dist * 10) / 10
}

export async function parseHealthZip(file: File): Promise<TrackMeta[]> {
  const zip = await JSZip.loadAsync(file)
  const results: TrackMeta[] = []

  const gpxFiles = Object.entries(zip.files).filter(([path]) => ROUTE_PATH_RE.test(path))

  await Promise.all(
    gpxFiles.map(async ([path, entry]) => {
      if (entry.dir) return
      const gpxText = await entry.async('string')

      const shortName = path.split('/').pop() ?? path
      const date =
        parseDateFromGpx(gpxText) ??
        parseDateFromFilename(shortName) ??
        new Date(0)

      let name = shortName.replace(/\.gpx$/i, '')
      try {
        const parsed = parseGpx(gpxText)
        if (parsed.name && parsed.name !== '未命名轨迹') name = parsed.name
      } catch {
        // name stays as filename
      }

      results.push({
        filename: path,
        name,
        date,
        durationMin: estimateDuration(gpxText),
        distanceKm: estimateDistanceKm(gpxText),
        gpxText,
      })
    }),
  )

  // sort newest first
  return results.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function filterByYearMonth(tracks: TrackMeta[], year: number, month: number | null): TrackMeta[] {
  return tracks.filter((t) => {
    if (t.date.getFullYear() !== year) return false
    if (month !== null && t.date.getMonth() + 1 !== month) return false
    return true
  })
}

// week number within year (ISO-ish: Mon start)
export function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime()
  return Math.ceil((diff / 86_400_000 + start.getDay() + 1) / 7)
}

export function filterByWeek(tracks: TrackMeta[], year: number, week: number): TrackMeta[] {
  return tracks.filter(
    (t) => t.date.getFullYear() === year && getWeekNumber(t.date) === week,
  )
}

export function getAvailableYears(tracks: TrackMeta[]): number[] {
  return [...new Set(tracks.map((t) => t.date.getFullYear()))].sort((a, b) => b - a)
}

export function getAvailableMonths(tracks: TrackMeta[], year: number): number[] {
  return [
    ...new Set(
      tracks.filter((t) => t.date.getFullYear() === year).map((t) => t.date.getMonth() + 1),
    ),
  ].sort((a, b) => a - b)
}

export function getAvailableWeeks(tracks: TrackMeta[], year: number): number[] {
  return [
    ...new Set(
      tracks.filter((t) => t.date.getFullYear() === year).map((t) => getWeekNumber(t.date)),
    ),
  ].sort((a, b) => a - b)
}
