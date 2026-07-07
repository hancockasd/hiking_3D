/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 * Returns: { ok: boolean, user?: { id, email, username, avatar? }, error?: string }
 */
import { requireAuth } from '../../_utils/auth'
import { json, handleOptions } from '../../_utils/response'

export async function onRequest(context: any): Promise<Response> {
  if (context.request.method === 'OPTIONS') return handleOptions()
  if (context.request.method !== 'GET') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const db: D1Database = context.env.DB
    const userId = await requireAuth(context.request, db)

    const user = await db
      .prepare('SELECT id, email, username, avatar FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; username: string; avatar: string | null }>()

    if (!user) {
      return json({ ok: false, error: '用户不存在' }, 404)
    }

    return json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar || undefined,
      },
    })
  } catch (e: any) {
    if (e.message === '请先登录' || e.message === '登录已过期') {
      return json({ ok: false, error: e.message }, 401)
    }
    return json({ ok: false, error: e.message || '服务器错误' }, 500)
  }
}
