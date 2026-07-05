<template>
  <div class="user-menu">
    <!-- Not logged in -->
    <button v-if="!auth.loggedIn.value" class="login-btn" @click="showLogin = true">
      登录
    </button>

    <!-- Logged in -->
    <div v-else class="user-info">
      <span class="avatar">{{ avatarLetter }}</span>
      <span class="email-text" :title="auth.currentUser.value?.email">
        {{ displayName }}
      </span>
      <button class="logout-btn" @click="handleLogout" title="退出登录">⏻</button>
    </div>

    <LoginDialog v-model:visible="showLogin" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '@/lib/auth'
import LoginDialog from './LoginDialog.vue'

const auth = useAuth()
const showLogin = ref(false)

const avatarLetter = computed(() => {
  const u = auth.currentUser.value
  if (!u) return '?'
  return (u.username || u.email || '?')[0].toUpperCase()
})

const displayName = computed(() => {
  const u = auth.currentUser.value
  if (!u) return ''
  return u.username || u.email?.split('@')[0] || '用户'
})

function handleLogout() {
  auth.logout()
}
</script>

<style scoped>
.user-menu {
  display: flex;
  align-items: center;
}

.login-btn {
  padding: 5px 14px;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.login-btn:hover {
  background: #2563eb;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.email-text {
  font-size: 12px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.logout-btn {
  background: none;
  border: 1px solid #374151;
  border-radius: 4px;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
  transition: color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.logout-btn:hover {
  color: #f87171;
  border-color: #f87171;
}
</style>
