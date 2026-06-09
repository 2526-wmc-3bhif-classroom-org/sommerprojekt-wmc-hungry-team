<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSmarthubApi } from '../composables/use-smarthub-api.js'

const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const errors = reactive<{ name: string; email: string; password: string; general: string }>({
  name: '',
  email: '',
  password: '',
  general: '',
})
const loading = ref(false)

definePageMeta({
  layout: 'landing'
})

const { login, register, fetchMe } = useSmarthubApi()

onMounted(async () => {
  try {
    await fetchMe()
    await router.push('/dashboard')
  } catch {
    // stay on login
  }
})

const ERROR_TRANSLATIONS: Record<string, string> = {
  'Invalid credentials': 'Email or password incorrect',
  'Email already registered': 'This email is already registered',
  'Password must be at least 8 characters': 'Password must be at least 8 characters long',
  'Invalid email format': 'Invalid email format',
  'Internal server error': 'Server error — please try again later',
}

function translateError(msg: string): string {
  if (ERROR_TRANSLATIONS[msg]) return ERROR_TRANSLATIONS[msg]
  if (msg.startsWith('Missing required parameter')) return 'Please fill in all fields'
  return msg
}

function clearErrors() {
  errors.name = ''
  errors.email = ''
  errors.password = ''
  errors.general = ''
}

function validateFields(): boolean {
  let valid = true

  if (mode.value === 'register' && name.value.trim().length === 0) {
    errors.name = 'Name is required'
    valid = false
  }

  if (email.value.trim().length === 0) {
    errors.email = 'Email is required'
    valid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    errors.email = 'Invalid email format'
    valid = false
  }

  if (password.value.length === 0) {
    errors.password = 'Password is required'
    valid = false
  } else if (mode.value === 'register' && password.value.length < 8) {
    errors.password = 'Password must be at least 8 characters long'
    valid = false
  }

  return valid
}

const submit = async () => {
  clearErrors()

  if (!validateFields()) return

  loading.value = true
  try {
    if (mode.value === 'login') {
      await login(email.value, password.value)
    } else {
      await register(name.value, email.value, password.value)
    }
    await router.push('/dashboard')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    const translated = translateError(msg)

    // Route specific backend errors to the relevant field
    if (msg === 'Invalid email format' || msg === 'Missing required parameter: email') {
      errors.email = translated
    } else if (msg === 'Password must be at least 8 characters' || msg === 'Missing required parameter: password') {
      errors.password = translated
    } else if (msg === 'Missing required parameter: name') {
      errors.name = 'Name is required'
    } else {
      errors.general = translated
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-card">
    <h1 class="auth-title">SmartHub</h1>
    <p class="auth-subtitle">
      {{ mode === 'login' ? 'Please log in' : 'Create an account' }}
    </p>

    <form class="auth-form" @submit.prevent="submit" novalidate>
      <div v-if="mode === 'register'" class="auth-field">
        <input
          v-model.trim="name"
          type="text"
          placeholder="Name"
          autocomplete="name"
          :class="{ 'input-error': errors.name }"
        />
        <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
      </div>
      <div class="auth-field">
        <input
          v-model.trim="email"
          type="email"
          placeholder="Email"
          autocomplete="email"
          :class="{ 'input-error': errors.email }"
        />
        <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
      </div>
      <div class="auth-field">
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
          :class="{ 'input-error': errors.password }"
        />
        <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
      </div>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Register' }}
      </button>
    </form>

    <p v-if="errors.general" class="auth-error">{{ errors.general }}</p>

    <button class="auth-toggle" type="button" @click="mode = mode === 'login' ? 'register' : 'login'; clearErrors()">
      {{ mode === 'login' ? 'No account yet? Register' : 'Already have an account? Log in' }}
    </button>
  </div>
</template>

<style scoped>
.auth-card {
  background: white;
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(420px, 90vw);
  text-align: center;
}

.auth-title {
  font-size: 2rem;
  margin: 0;
}

.auth-subtitle {
  color: #6b7280;
  margin: 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.auth-form input {
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.auth-form input:focus {
  outline: none;
  border-color: #3b82f6;
}

.auth-form input.input-error {
  border-color: #dc2626;
}

.field-error {
  color: #dc2626;
  font-size: 0.8rem;
  margin: 4px 0 0 4px;
}

.auth-form button {
  padding: 12px 16px;
  border-radius: 10px;
  border: none;
  background: #3b82f6;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.auth-form button:disabled {
  opacity: 0.7;
  cursor: default;
}

.auth-error {
  color: #b91c1c;
  margin: 0;
}

.auth-toggle {
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
}
</style>

