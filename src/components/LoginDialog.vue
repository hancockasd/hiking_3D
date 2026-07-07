<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="close">
      <div class="dialog">
        <h2>{{ isRegister ? '注册账号' : '登录' }}</h2>
        <p class="hint">
          {{ isRegister ? '创建账号后，你的轨迹数据将同步到云端' : '登录后可查看和管理云端轨迹' }}
        </p>

        <!-- Error -->
        <div v-if="error" class="err-msg">{{ error }}</div>

        <form @submit.prevent="submit">
          <!-- Email -->
          <label class="field">
            <span>邮箱</span>
            <input
              v-model="email"
              type="text"
              inputmode="email"
              placeholder="your@email.com"
              autocomplete="email"
            />
          </label>

          <!-- Username (register only) -->
          <label v-if="isRegister" class="field">
            <span>用户名</span>
            <input
              v-model="username"
              type="text"
              placeholder="你的昵称"
              autocomplete="username"
            />
          </label>

          <!-- Password -->
          <label class="field">
            <span>密码</span>
            <input
              v-model="password"
              type="password"
              placeholder="至少 6 位"
              autocomplete="current-password"
            />
          </label>

          <!-- Avatar upload (register only) -->
          <div v-if="isRegister" class="field">
            <span>头像（可选）</span>
            <div class="avatar-upload" @click="avatarInput?.click()">
              <img v-if="avatarPreview" :src="avatarPreview" class="avatar-preview" />
              <span v-else class="avatar-placeholder">点击上传头像</span>
              <input ref="avatarInput" type="file" accept="image/*" style="display:none" @change="onAvatarChange" />
            </div>
          </div>

          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? '处理中…' : isRegister ? '注册' : '登录' }}
          </button>
        </form>

        <!-- Toggle -->
        <p class="toggle">
          {{ isRegister ? '已有账号？' : '没有账号？' }}
          <a href="#" @click.prevent="toggleMode">{{ isRegister ? '去登录' : '去注册' }}</a>
        </p>

        <!-- Close -->
        <button class="close-btn" @click="close">×</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/lib/auth'

const emit = defineEmits<{ close: [] }>()

const { login, register } = useAuth()

const visible = defineModel<boolean>('visible', { default: false })

const isRegister = ref(false)
const loading = ref(false)
const error = ref('')

const email = ref('')
const username = ref('')
const password = ref('')
const avatarPreview = ref('')
const avatarInput = ref<HTMLInputElement>()

function toggleMode() {
  isRegister.value = !isRegister.value
  error.value = ''
}

function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    avatarPreview.value = ev.target?.result as string
  }
  reader.readAsDataURL(file)
}

async function submit() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = '请填写邮箱和密码'
    return
  }
  if (isRegister.value && !username.value) {
    error.value = '请填写用户名'
    return
  }
  if (password.value.length < 6) {
    error.value = '密码至少 6 位'
    return
  }

  loading.value = true
  try {
    const ok = isRegister.value
      ? await register(email.value, username.value, password.value)
      : await login(email.value, password.value)

    if (ok) {
      if (isRegister.value && avatarPreview.value) {
        localStorage.setItem('user_avatar', avatarPreview.value)
      }
      close()
    }
  } catch (e: any) {
    error.value = e.message || '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

function close() {
  visible.value = false
  error.value = ''
  email.value = ''
  username.value = ''
  password.value = ''
  avatarPreview.value = ''
  isRegister.value = false
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
  padding: 28px 24px 22px;
  width: 380px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: var(--shadow-sm);
}

h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.hint {
  font-size: 13px;
  color: var(--ink3);
  line-height: 1.5;
  margin: 0;
}

.err-msg {
  font-size: 13px;
  color: var(--danger);
  background: var(--danger-lt);
  border: 1px solid #fecaca;
  border-radius: var(--r);
  padding: 8px 10px;
  margin: 0;
}

form {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.avatar-upload {
  cursor: pointer;
  border: 1px dashed var(--border2);
  border-radius: var(--r);
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s;
  background: var(--bg);
}
.avatar-upload:hover { border-color: var(--blue); }
.avatar-preview {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-placeholder {
  font-size: 13px;
  color: var(--ink3);
}

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
  margin-top: 4px;
}
.btn-primary:hover { background: var(--blue2); }
.btn-primary:disabled {
  background: var(--border2);
  color: var(--ink4);
  cursor: not-allowed;
}

.toggle {
  font-size: 13px;
  color: var(--ink3);
  text-align: center;
  margin: 0;
}
.toggle a {
  color: var(--blue);
  text-decoration: none;
  font-weight: 500;
}
.toggle a:hover { text-decoration: underline; }

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
</style>
