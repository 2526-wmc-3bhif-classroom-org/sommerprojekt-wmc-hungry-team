<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSmarthubApi } from '../composables/use-smarthub-api.js'

const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
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

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'login') {
      await login(email.value, password.value)
    } else {
      await register(name.value, email.value, password.value)
    }
    await router.push('/dashboard')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login fehlgeschlagen'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-card">
    <h1 class="auth-title">SmartHub</h1>
    <p class="auth-subtitle">
      {{ mode === 'login' ? 'Bitte anmelden' : 'Konto erstellen' }}
    </p>

    <form class="auth-form" @submit.prevent="submit">
      <input
        v-if="mode === 'register'"
        v-model.trim="name"
        type="text"
        placeholder="Name"
        autocomplete="name"
        required
      />
      <input
        v-model.trim="email"
        type="email"
        placeholder="E-Mail"
        autocomplete="email"
        required
      />
      <input
        v-model="password"
        type="password"
        placeholder="Passwort"
        autocomplete="current-password"
        required
      />

      <button type="submit" :disabled="loading">
        {{ loading ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Registrieren' }}
      </button>
    </form>

    <p v-if="error" class="auth-error">{{ error }}</p>

    <button class="auth-toggle" type="button" @click="mode = mode === 'login' ? 'register' : 'login'">
      {{ mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden' }}
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

.auth-form input {
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
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
