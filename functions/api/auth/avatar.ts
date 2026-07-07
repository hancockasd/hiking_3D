/**
 * POST /api/auth/avatar
 * Headers: Authorization: Bearer <token>
 * Body: { avatar: string }  — base64 data URL
 * Returns: { ok: boolean, error?: string }
 */
import { requireAuth } from '../../_utils/auth'
import { json, handleOptions } from '../../_utils/response'

export async function onRequest(context: any): Promise<Response> {
  if (context.request.method === 'OPTIONS') return handleOptions()
  if (context.request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const db: D1Database = context.env.DB
    const userId = await requireAuth(context.request, db)

    const { avatar }: { avatar?: string } = await context.request.json()
    if (!avatar) {
      return json({ ok: false, error: '缺少头像数据' }, 400)
    }

    // Limit size: base64 of a reasonable avatar should be < 500KB
    if (avatar.length > 700_000) {
      return json({ ok: false, error: '头像文件过大，请使用较小的图片' }, 400)
    }

    await db
      .prepare("UPDATE users SET avatar = ? WHERE id = ?")
      .bind(avatar, userId)
      .run()

    return json({ ok: true })
  } catch (e: any) {
    if (e.message === '请先登录' || e.message === '登录已过期') {
      return json({ ok: false, error: e.message }, 401)
    }
    return json({ ok: false, error: e.message || '保存失败' }, 500)
  }
}
