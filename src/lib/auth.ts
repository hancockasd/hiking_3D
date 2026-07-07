import { ref, computed } from 'vue'
import { apiLogin, apiRegister, apiLogout, apiMe, isLoggedIn } from './api'
import type { LcUser } from './api'

const currentUser = ref<LcUser | null>(null)
const authReady = ref(false)
const authError = ref('')

export function useAuth() {
  const loggedIn = computed(() => currentUser.value !== null)

  async function initAuth(): Promise<void> {
    authError.value = ''
    if (!isLoggedIn()) {
      authReady.value = true
      return
    }
    // Restore real user info (including avatar) from server
    try {
      const result = await apiMe()
      if (result.ok && result.user) {
        currentUser.value = result.user
        // Sync avatar to localStorage so markers and UserMenu pick it up instantly
        if (result.user.avatar) {
          localStorage.setItem('user_avatar', result.user.avatar)
          window.dispatchEvent(new Event('avatar-updated'))
        }
      } else {
        // Token invalid — clear it
        localStorage.removeItem('cf_token')
      }
    } catch {
      // Network error — still mark as ready, sync will fail gracefully later
      currentUser.value = { id: 'restored' }
    }
    authReady.value = true
  }

  async function login(email: string, password: string): Promise<boolean> {
    authError.value = ''
    const result = await apiLogin(email, password)
    if (result.ok && result.user) {
      currentUser.value = result.user
      if (result.user.avatar) {
        localStorage.setItem('user_avatar', result.user.avatar)
        window.dispatchEvent(new Event('avatar-updated'))
      }
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
    localStorage.removeItem('user_avatar')
    window.dispatchEvent(new Event('avatar-updated'))
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
