/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Returns: { ok: boolean, token?: string, user?: object, error?: string }
 */
import { hashPassword, generateToken } from '../../_utils/auth'
import { json, handleOptions } from '../../_utils/response'

export async function onRequest(context: any): Promise<Response> {
  if (context.request.method === 'OPTIONS') return handleOptions()
  if (context.request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const { email, password }: { email?: string; password?: string } =
      await context.request.json()

    if (!email || !password) {
      return json({ ok: false, error: '请输入邮箱和密码' })
    }

    const db: D1Database = context.env.DB

    // Find user
    const user = await db
      .prepare('SELECT id, email, username, password_hash FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; username: string; password_hash: string }>()

    if (!user) {
      return json({ ok: false, error: '邮箱未注册' })
    }

    // Verify password
    const hash = await hashPassword(password)
    if (hash !== user.password_hash) {
      return json({ ok: false, error: '密码错误' })
    }

    // Create session
    const token = generateToken()
    await db
      .prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)')
      .bind(token, user.id)
      .run()

    return json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, username: user.username },
    })
  } catch (e: any) {
    return json({ ok: false, error: e.message || '登录失败' }, 500)
  }
}
