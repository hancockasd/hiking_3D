/**
 * API 封装：调用 Cloudflare Pages Functions 后端 API。
 *
 * 后端路由：
 *   POST /api/auth/register   { email, username, password } → { ok, token, user }
 *   POST /api/auth/login      { email, password }           → { ok, token, user }
 *   POST /api/auth/logout     (Authorization header)        → { ok }
 *   GET  /api/tracks          (Authorization header)        → { ok, data }
 *   POST /api/tracks          (Authorization header)        → { ok }
 *   GET  /api/tracks/:id      (Authorization header)        → { ok, data }
 *   DELETE /api/tracks/:id    (Authorization header)        → { ok }
 */
import type { StoredTrack } from './storage'

// ── Types ──────────────────────────────────────────

export interface LcUser {
  id: string
  email?: string
  username?: string
  avatar?: string
}

export interface CloudTrackData {
  trackId: string
  name: string
  importedAt: number
  workoutDate?: number
  rawGpxText: string
  stats: StoredTrack['stats']
}

// ── Token management ─────────────────────────────

const TOKEN_KEY = 'cf_token'

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// ── HTTP helpers ─────────────────────────────────

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  // Attach auth token to all endpoints except the ones that don't need it
  const noAuthPaths = ['/api/auth/register', '/api/auth/login', '/api/auth/logout']
  if (!noAuthPaths.some(p => url.includes(p))) {
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  // If 401, clear token
  if (res.status === 401) {
    clearToken()
  }

  return res.json()
}

// ── Auth ──────────────────────────────────────────

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ ok: boolean; token?: string; user?: LcUser; error?: string }> {
  const result = await request<{
    ok: boolean
    token?: string
    user?: LcUser
    error?: string
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (result.ok && result.token) {
    saveToken(result.token)
  }
  return result
}

export async function apiRegister(
  email: string,
  username: string,
  password: string,
): Promise<{ ok: boolean; token?: string; user?: LcUser; error?: string }> {
  const result = await request<{
    ok: boolean
    token?: string
    user?: LcUser
    error?: string
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  })

  if (result.ok && result.token) {
    saveToken(result.token)
  }
  return result
}

export async function apiLogout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } catch {
    // ignore
  }
  clearToken()
}

export async function apiMe(): Promise<{ ok: boolean; user?: LcUser; error?: string }> {
  return request('/api/auth/me')
}

export async function apiUpdateAvatar(avatar: string): Promise<{ ok: boolean; error?: string }> {
  return request('/api/auth/avatar', {
    method: 'POST',
    body: JSON.stringify({ avatar }),
  })
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

// ── Tracks ────────────────────────────────────────

export async function apiSaveTrack(track: {
  id: string
  name: string
  importedAt: number
  workoutDate?: number
  rawGpxText: string
  stats: StoredTrack['stats']
}): Promise<{ ok: boolean; error?: string }> {
  return request('/api/tracks', {
    method: 'POST',
    body: JSON.stringify(track),
  })
}

export async function apiListTracks(): Promise<{
  ok: boolean
  data?: CloudTrackData[]
  error?: string
}> {
  return request('/api/tracks')
}

export async function apiGetTrack(
  trackId: string,
): Promise<{ ok: boolean; data?: CloudTrackData; error?: string }> {
  return request(`/api/tracks/${encodeURIComponent(trackId)}`)
}

export async function apiDeleteTrack(
  trackId: string,
): Promise<{ ok: boolean; error?: string }> {
  return request(`/api/tracks/${encodeURIComponent(trackId)}`, {
    method: 'DELETE',
  })
}
