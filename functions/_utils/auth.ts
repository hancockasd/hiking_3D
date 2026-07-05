/**
 * Password hashing and session management.
 * Uses Web Crypto API (available in Cloudflare Workers runtime).
 */

/** SHA-256 hash password — adequate for personal app */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Generate a random session token */
export function generateToken(): string {
  return crypto.randomUUID()
}

/**
 * Verify request auth and return userId.
 * Throws with an error message if not authenticated.
 */
export async function requireAuth(
  request: Request,
  db: D1Database,
): Promise<string> {
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    throw new Error('请先登录')
  }

  const session = await db
    .prepare('SELECT user_id FROM sessions WHERE token = ?')
    .bind(token)
    .first<{ user_id: string }>()

  if (!session) {
    throw new Error('登录已过期')
  }

  return session.user_id
}
