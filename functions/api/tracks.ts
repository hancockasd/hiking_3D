/**
 * GET  /api/tracks  → list user's tracks
 * POST /api/tracks  → save a track (upsert)
 */
import { requireAuth } from '../_utils/auth'
import { json, handleOptions } from '../_utils/response'

export async function onRequest(context: any): Promise<Response> {
  if (context.request.method === 'OPTIONS') return handleOptions()

  try {
    const db: D1Database = context.env.DB
    const userId = await requireAuth(context.request, db)

    if (context.request.method === 'GET') {
      return listTracks(db, userId)
    }

    if (context.request.method === 'POST') {
      return saveTrack(context.request, db, userId)
    }

    return json({ ok: false, error: 'Method not allowed' }, 405)
  } catch (e: any) {
    if (e.message === '请先登录' || e.message === '登录已过期') {
      return json({ ok: false, error: e.message }, 401)
    }
    return json({ ok: false, error: e.message || '服务器错误' }, 500)
  }
}

async function listTracks(db: D1Database, userId: string): Promise<Response> {
  const rows = await db
    .prepare(
      'SELECT track_id, name, imported_at, workout_date, raw_gpx_text, stats FROM tracks WHERE user_id = ? ORDER BY imported_at DESC LIMIT 1000',
    )
    .bind(userId)
    .all<{
      track_id: string
      name: string
      imported_at: number
      workout_date: number | null
      raw_gpx_text: string
      stats: string
    }>()

  const data = rows.results.map((r) => ({
    trackId: r.track_id,
    name: r.name,
    importedAt: r.imported_at,
    workoutDate: r.workout_date || undefined,
    rawGpxText: r.raw_gpx_text,
    stats: typeof r.stats === 'string' ? JSON.parse(r.stats) : r.stats,
  }))

  return json({ ok: true, data })
}

async function saveTrack(
  request: Request,
  db: D1Database,
  userId: string,
): Promise<Response> {
  const body: {
    id?: string
    name?: string
    importedAt?: number
    workoutDate?: number
    rawGpxText?: string
    stats?: any
  } = await request.json()

  const trackId = body.id
  if (!trackId || !body.rawGpxText) {
    return json({ ok: false, error: '缺少必要参数' }, 400)
  }

  const statsJson = JSON.stringify(body.stats || {})

  // Upsert
  const existing = await db
    .prepare('SELECT id FROM tracks WHERE user_id = ? AND track_id = ?')
    .bind(userId, trackId)
    .first<{ id: number }>()

  if (existing) {
    await db
      .prepare(
        `UPDATE tracks SET name = ?, raw_gpx_text = ?, stats = ?, imported_at = ?, workout_date = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .bind(
        body.name || '未命名轨迹',
        body.rawGpxText,
        statsJson,
        body.importedAt || Date.now(),
        body.workoutDate || null,
        existing.id,
      )
      .run()
  } else {
    await db
      .prepare(
        `INSERT INTO tracks (track_id, user_id, name, raw_gpx_text, stats, imported_at, workout_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        trackId,
        userId,
        body.name || '未命名轨迹',
        body.rawGpxText,
        statsJson,
        body.importedAt || Date.now(),
        body.workoutDate || null,
      )
      .run()
  }

  return json({ ok: true })
}
