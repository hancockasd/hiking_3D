<template>
  <div class="user-menu">
    <button v-if="!auth.loggedIn.value" class="login-btn" @click="showLogin = true">
      Sign in
    </button>
    <div v-else class="user-info">
      <button class="avatar-btn" @click="showProfile = true" title="Account settings">
        <img v-if="avatarSrc" :src="avatarSrc" class="avatar-img" />
        <span v-else class="avatar-letter">{{ avatarLetter }}</span>
      </button>
      <span class="display-name" :title="auth.currentUser.value?.email">{{ displayName }}</span>
      <button class="logout-btn" @click="handleLogout">Sign out</button>
    </div>
    <LoginDialog v-model:visible="showLogin" />
    <ProfileDialog v-model:visible="showProfile" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/lib/auth'
import LoginDialog from './LoginDialog.vue'
import ProfileDialog from './ProfileDialog.vue'

const auth = useAuth()
const showLogin = ref(false)
const showProfile = ref(false)
const avatarSrc = ref(localStorage.getItem('user_avatar') || '')

function refreshAvatar() {
  avatarSrc.value = localStorage.getItem('user_avatar') || ''
}

onMounted(() => window.addEventListener('avatar-updated', refreshAvatar))
onUnmounted(() => window.removeEventListener('avatar-updated', refreshAvatar))

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
  avatarSrc.value = ''
}
</script>

<style scoped>
.user-menu { display: flex; align-items: center; }

.login-btn {
  padding: 5px 14px;
  background: var(--sb-blue);
  border: none;
  border-radius: var(--r);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.login-btn:hover { background: #3a7ef0; }

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.avatar-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--sb-border);
  padding: 0;
  cursor: pointer;
  background: var(--sb-active);
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-btn:hover { border-color: var(--sb-ink3); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-letter { font-size: 11px; font-weight: 600; color: var(--sb-ink2); }

.display-name {
  font-size: 13px;
  color: var(--sb-ink2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.logout-btn {
  background: none;
  border: 1px solid var(--sb-border);
  border-radius: var(--r);
  color: var(--sb-ink3);
  font-size: 12px;
  cursor: pointer;
  padding: 3px 9px;
  transition: all 0.15s;
  flex-shrink: 0;
}
.logout-btn:hover { border-color: var(--sb-ink3); color: var(--sb-ink); }
</style>
