<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="close">
      <div class="dialog">
        <h2>账号设置</h2>
        <button class="close-btn" @click="close">×</button>

        <!-- Avatar section -->
        <div class="section">
          <div class="section-title">头像</div>
          <div class="avatar-row">
            <div class="avatar-wrap" @click="avatarInput?.click()">
              <img v-if="currentAvatar" :src="currentAvatar" class="avatar-img" />
              <span v-else class="avatar-letter">{{ avatarLetter }}</span>
              <div class="avatar-overlay">更换</div>
              <input ref="avatarInput" type="file" accept="image/*" style="display:none" @change="onAvatarChange" />
            </div>
            <div class="avatar-hint">点击头像更换图片</div>
          </div>
          <div v-if="avatarMsg" :class="['msg', avatarMsg.ok ? 'ok' : 'err']">{{ avatarMsg.text }}</div>
        </div>

        <!-- Change password section -->
        <div class="section">
          <div class="section-title">修改密码</div>
          <div v-if="pwdMsg" :class="['msg', pwdMsg.ok ? 'ok' : 'err']">{{ pwdMsg.text }}</div>
          <form @submit.prevent="changePassword">
            <label class="field">
              <span>当前密码</span>
              <input v-model="oldPwd" type="password" placeholder="当前密码" autocomplete="current-password" />
            </label>
            <label class="field">
              <span>新密码</span>
              <input v-model="newPwd" type="password" placeholder="至少 6 位" autocomplete="new-password" />
            </label>
            <label class="field">
              <span>确认新密码</span>
              <input v-model="confirmPwd" type="password" placeholder="再输入一次" autocomplete="new-password" />
            </label>
            <button type="submit" class="btn-primary" :disabled="pwdLoading">
              {{ pwdLoading ? '修改中…' : '修改密码' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuth } from '@/lib/auth'
import { apiUpdateAvatar } from '@/lib/api'

const visible = defineModel<boolean>('visible', { default: false })

const auth = useAuth()

const avatarInput = ref<HTMLInputElement>()
const currentAvatar = ref(localStorage.getItem('user_avatar') || '')
const avatarMsg = ref<{ ok: boolean; text: string } | null>(null)

const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const pwdLoading = ref(false)
const pwdMsg = ref<{ ok: boolean; text: string } | null>(null)

const avatarLetter = computed(() => {
  const u = auth.currentUser.value
  if (!u) return '?'
  return (u.username || u.email || '?')[0].toUpperCase()
})

watch(visible, (v) => {
  if (v) {
    currentAvatar.value = localStorage.getItem('user_avatar') || ''
    avatarMsg.value = null
    pwdMsg.value = null
    oldPwd.value = ''
    newPwd.value = ''
    confirmPwd.value = ''
  }
})

function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (ev) => {
    const data = ev.target?.result as string
    localStorage.setItem('user_avatar', data)
    currentAvatar.value = data
    window.dispatchEvent(new Event('avatar-updated'))

    // Sync to cloud if logged in
    try {
      const result = await apiUpdateAvatar(data)
      avatarMsg.value = result.ok
        ? { ok: true, text: '头像已更新并同步到云端' }
        : { ok: false, text: result.error || '本地已保存，云端同步失败' }
    } catch {
      avatarMsg.value = { ok: false, text: '本地已保存，云端同步失败' }
    }
  }
  reader.readAsDataURL(file)
}

async function changePassword() {
  pwdMsg.value = null
  if (!oldPwd.value || !newPwd.value || !confirmPwd.value) {
    pwdMsg.value = { ok: false, text: '请填写所有密码字段' }
    return
  }
  if (newPwd.value.length < 6) {
    pwdMsg.value = { ok: false, text: '新密码至少 6 位' }
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    pwdMsg.value = { ok: false, text: '两次新密码不一致' }
    return
  }

  pwdLoading.value = true
  try {
    const token = localStorage.getItem('cf_token')
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ oldPassword: oldPwd.value, newPassword: newPwd.value }),
    })
    const data = await res.json()
    if (data.ok) {
      pwdMsg.value = { ok: true, text: '密码修改成功' }
      oldPwd.value = ''
      newPwd.value = ''
      confirmPwd.value = ''
    } else {
      pwdMsg.value = { ok: false, text: data.error || '修改失败' }
    }
  } catch {
    pwdMsg.value = { ok: false, text: '网络错误，请稍后重试' }
  } finally {
    pwdLoading.value = false
  }
}

function close() {
  visible.value = false
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}
.dialog {
  position: relative;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 28px 24px 24px;
  width: 380px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: var(--shadow-sm);
}
h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}
.close-btn {
  position: absolute;
  top: 14px;
  right: 16px;
  background: none;
  border: none;
  color: var(--ink4);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--ink); }

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.avatar-wrap {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--row-active);
  border: 1px solid var(--border);
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-letter {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  color: var(--ink2);
}
.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: white;
  opacity: 0;
  transition: opacity 0.15s;
}
.avatar-wrap:hover .avatar-overlay { opacity: 1; }
.avatar-hint { font-size: 13px; color: var(--ink3); }

form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field span {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink2);
}
.field input {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r);
  color: var(--ink);
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.field input:focus { border-color: var(--blue); outline: 2px solid var(--blue-lt); }
.field input::placeholder { color: var(--ink4); }

.btn-primary {
  padding: 8px 16px;
  background: var(--blue);
  border: none;
  border-radius: var(--r);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 2px;
}
.btn-primary:hover { background: var(--blue2); }
.btn-primary:disabled {
  background: var(--border2);
  color: var(--ink4);
  cursor: not-allowed;
}

.msg {
  font-size: 13px;
  padding: 7px 10px;
  border: 1px solid;
  border-radius: var(--r);
}
.msg.ok  { background: var(--green-lt); border-color: #bbf7d0; color: var(--green); }
.msg.err { background: var(--danger-lt); border-color: #fecaca; color: var(--danger); }
</style>
