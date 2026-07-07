/**
 * POST /api/auth/change-password
 * Headers: Authorization: Bearer <token>
 * Body: { oldPassword: string, newPassword: string }
 * Returns: { ok: boolean, error?: string }
 */
import { hashPassword, requireAuth } from '../../_utils/auth'
import { json, handleOptions } from '../../_utils/response'

export async function onRequest(context: any): Promise<Response> {
  if (context.request.method === 'OPTIONS') return handleOptions()
  if (context.request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const db: D1Database = context.env.DB
    const userId = await requireAuth(context.request, db)

    const { oldPassword, newPassword }: {
      oldPassword?: string
      newPassword?: string
    } = await context.request.json()

    if (!oldPassword || !newPassword) {
      return json({ ok: false, error: '请填写当前密码和新密码' })
    }
    if (newPassword.length < 6) {
      return json({ ok: false, error: '新密码至少 6 位' })
    }

    const user = await db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(userId)
      .first<{ password_hash: string }>()

    if (!user) {
      return json({ ok: false, error: '用户不存在' }, 404)
    }

    const oldHash = await hashPassword(oldPassword)
    if (oldHash !== user.password_hash) {
      return json({ ok: false, error: '当前密码不正确' })
    }

    const newHash = await hashPassword(newPassword)
    await db
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(newHash, userId)
      .run()

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e.message || '修改失败' }, 500)
  }
}
