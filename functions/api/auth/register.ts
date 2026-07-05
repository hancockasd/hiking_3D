/**
 * POST /api/auth/register
 * Body: { email: string, username: string, password: string }
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
    const { email, username, password }: {
      email?: string
      username?: string
      password?: string
    } = await context.request.json()

    if (!email || !password) {
      return json({ ok: false, error: '请输入邮箱和密码' })
    }
    if (password.length < 6) {
      return json({ ok: false, error: '密码至少 6 位' })
    }

    const db: D1Database = context.env.DB

    // Check if email already exists
    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first()
    if (existing) {
      return json({ ok: false, error: '该邮箱已被注册' })
    }

    // Create user
    const userId = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    const displayName = username || email.split('@')[0]

    await db
      .prepare(
        'INSERT INTO users (id, email, password_hash, username) VALUES (?, ?, ?, ?)',
      )
      .bind(userId, email, passwordHash, displayName)
      .run()

    // Create session
    const token = generateToken()
    await db
      .prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)')
      .bind(token, userId)
      .run()

    return json({
      ok: true,
      token,
      user: { id: userId, email, username: displayName },
    })
  } catch (e: any) {
    return json({ ok: false, error: e.message || '注册失败' }, 500)
  }
}
