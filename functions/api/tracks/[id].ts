/**
 * GET    /api/tracks/:id  → get one track with rawGpxText
 * DELETE /api/tracks/:id  → delete a track
 */
import { requireAuth } from '../../_utils/auth'
import { json, handleOptions } from '../../_utils/response'

export async function onRequest(context: any): Promise<Response> {
  if (context.request.method === 'OPTIONS') return handleOptions()

  try {
    const db: D1Database = context.env.DB
    const userId = await requireAuth(context.request, db)
    const trackId = context.params.id as string

    if (!trackId) {
      return json({ ok: false, error: '缺少 trackId' }, 400)
    }

    if (context.request.method === 'GET') {
      const row = await db
        .prepare(
          'SELECT track_id, name, imported_at, workout_date, raw_gpx_text, stats FROM tracks WHERE user_id = ? AND track_id = ?',
        )
        .bind(userId, trackId)
        .first<{
          track_id: string
          name: string
          imported_at: number
          workout_date: number | null
          raw_gpx_text: string
          stats: string
        }>()

      if (!row) {
        return json({ ok: false, error: '轨迹不存在' }, 404)
      }

      return json({
        ok: true,
        data: {
          trackId: row.track_id,
          name: row.name,
          importedAt: row.imported_at,
          workoutDate: row.workout_date || undefined,
          rawGpxText: row.raw_gpx_text,
          stats: typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats,
        },
      })
    }

    if (context.request.method === 'DELETE') {
      const result = await db
        .prepare('DELETE FROM tracks WHERE user_id = ? AND track_id = ?')
        .bind(userId, trackId)
        .run()

      if (result.changes === 0) {
        return json({ ok: false, error: '轨迹不存在' }, 404)
      }

      return json({ ok: true })
    }

    return json({ ok: false, error: 'Method not allowed' }, 405)
  } catch (e: any) {
    if (e.message === '请先登录' || e.message === '登录已过期') {
      return json({ ok: false, error: e.message }, 401)
    }
    return json({ ok: false, error: e.message || '服务器错误' }, 500)
  }
}
