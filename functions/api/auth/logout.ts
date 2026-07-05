/**
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 * Returns: { ok: boolean }
 */
import { json, handleOptions } from '../../_utils/response'

export async function onRequest(context: any): Promise<Response> {
  if (context.request.method === 'OPTIONS') return handleOptions()
  if (context.request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const db: D1Database = context.env.DB
    const authHeader = context.request.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (token) {
      await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
    }

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e.message || '退出失败' }, 500)
  }
}
