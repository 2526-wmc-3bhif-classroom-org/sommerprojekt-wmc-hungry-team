<script setup lang="ts">
const { fetchMe, logout } = useSmarthubApi()
const googleConnected = ref(false)
const googleEmail = ref<string | null>(null)
const statusMessage = ref('')
const loading = ref(true)

const config = useRuntimeConfig()
const apiBase = String(config.public.apiBaseUrl || '').replace(/\/$/, '')
const route = useRoute()

const refreshStatus = async () => {
  loading.value = true
  try {
    const me = await fetchMe()
    googleConnected.value = me.googleConnected
    googleEmail.value = me.googleEmail
  } catch {
    statusMessage.value = 'Status konnte nicht geladen werden'
  } finally {
    loading.value = false
  }
}

const connectGoogle = () => {
  window.location.href = `${apiBase}/api/auth/google/connect`
}

const handleLogout = async () => {
  await logout()
  await navigateTo('/login')
}

onMounted(async () => {
  await refreshStatus()
  if (route.query.google === 'connected') {
    statusMessage.value = 'Google-Konto verbunden'
  }
})
</script>

<template>
  <div class="settings">
    <h1>Einstellungen</h1>

    <section class="settings__card">
      <h2>Google Kalender</h2>
      <p v-if="loading">Status wird geladen…</p>
      <p v-else-if="googleConnected">
        Verbunden{{ googleEmail ? `: ${googleEmail}` : '' }}
      </p>
      <p v-else>Nicht verbunden</p>

      <button class="settings__button" type="button" @click="connectGoogle">
        {{ googleConnected ? 'Google neu verbinden' : 'Google verbinden' }}
      </button>
    </section>

    <section class="settings__card">
      <h2>Konto</h2>
      <button class="settings__button settings__button--secondary" type="button" @click="handleLogout">
        Abmelden
      </button>
    </section>

    <p v-if="statusMessage" class="settings__status">{{ statusMessage }}</p>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings__card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings__button {
  align-self: flex-start;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: #3b82f6;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.settings__button--secondary {
  background: #6b7280;
}

.settings__status {
  color: #2563eb;
}
</style>