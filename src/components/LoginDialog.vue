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

function toggleMode() {
  isRegister.value = !isRegister.value
  error.value = ''
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
  isRegister.value = false
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.dialog {
  position: relative;
  background: #1f2937;
  border-radius: 12px;
  padding: 28px 24px 20px;
  width: 380px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

h2 {
  font-size: 18px;
  font-weight: 700;
  color: #f9fafb;
  margin: 0;
}

.hint {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.err-msg {
  font-size: 12px;
  color: #f87171;
  background: #7f1d1d30;
  border-radius: 6px;
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
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
}
.field input {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #f9fafb;
  padding: 9px 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.field input:focus {
  border-color: #3b82f6;
}

.btn-primary {
  padding: 10px;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 4px;
}
.btn-primary:hover {
  background: #2563eb;
}
.btn-primary:disabled {
  background: #1e3a5f;
  color: #6b7280;
  cursor: not-allowed;
}

.toggle {
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  margin: 0;
}
.toggle a {
  color: #3b82f6;
  text-decoration: none;
}
.toggle a:hover {
  text-decoration: underline;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  color: #6b7280;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}
.close-btn:hover {
  color: #f9fafb;
}
</style>
