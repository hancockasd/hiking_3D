/**
 * Auth composable — 全局响应式认证状态，基于 Cloudflare Pages Functions 后端。
 * Token 存储在 localStorage，每次请求通过 Authorization header 发送。
 */
import { ref, computed } from 'vue'
import { apiLogin, apiRegister, apiLogout, isLoggedIn } from './api'
import type { LcUser } from './api'

const currentUser = ref<LcUser | null>(null)
const authReady = ref(false)
const authError = ref('')

export function useAuth() {
  const loggedIn = computed(() => currentUser.value !== null)

  /** 应用启动时调用：检查 localStorage 中是否有 token */
  async function initAuth(): Promise<void> {
    authError.value = ''
    // Token-based auth: we can't verify token validity without calling the API,
    // but the first API call will return 401 if token is expired.
    // For now, just check if token exists.
    if (isLoggedIn()) {
      // Token exists, but we don't have user info without calling an API.
      // UI will show logged-in state; first API call may redirect to login.
      currentUser.value = { id: 'restored' }
    }
    authReady.value = true
  }

  async function login(email: string, password: string): Promise<boolean> {
    authError.value = ''
    const result = await apiLogin(email, password)
    if (result.ok && result.user) {
      currentUser.value = result.user
      return true
    }
    authError.value = result.error || '登录失败'
    return false
  }

  async function register(email: string, username: string, password: string): Promise<boolean> {
    authError.value = ''
    const result = await apiRegister(email, username, password)
    if (result.ok && result.user) {
      currentUser.value = result.user
      return true
    }
    authError.value = result.error || '注册失败'
    return false
  }

  function logout(): void {
    apiLogout()
    currentUser.value = null
    authError.value = ''
  }

  return {
    currentUser,
    loggedIn,
    authReady,
    authError,
    initAuth,
    login,
    register,
    logout,
  }
}
