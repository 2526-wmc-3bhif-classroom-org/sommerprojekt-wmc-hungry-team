<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRuntimeConfig } from '#app'
import { useSettings } from '../composables/use-settings.js'
import { useSmarthubApi } from '../composables/use-smarthub-api.js'
import DatePickerPopup from '../components/date-picker-popup.vue'

definePageMeta({
  alias: ['/routine-settings'],
})

const router = useRouter()
const route = useRoute()

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref<string>(today)

const { state, getDay, setHomeLocation, addAlarm, addRoutineItem, updateRoutineItem, removeRoutineItem, removeAlarm, setPreview } = useSettings()
const { geocodePlace, get, fetchMe, logout } = useSmarthubApi()

const dayKey = computed(() => selectedDate.value)
const daySettings = computed(() => getDay(dayKey.value))

const homeLocation = ref(state.value.homeLocation ?? '')
watch(homeLocation, (v) => setHomeLocation(v))

const googleConnected = ref(false)
const googleEmail = ref<string | null>(null)
const statusMessage = ref('')
const loadingStatus = ref(true)

const config = useRuntimeConfig()
const apiBase = String(config.public.apiBaseUrl || '').replace(/\/$/, '')

function addNewAlarm() { addAlarm(dayKey.value) }
function addNewRoutine() { addRoutineItem(dayKey.value) }

const refreshGoogleStatus = async () => {
  loadingStatus.value = true
  try {
    const me = await fetchMe()
    googleConnected.value = me.googleConnected
    googleEmail.value = me.googleEmail
  } catch {
    statusMessage.value = 'Status konnte nicht geladen werden'
  } finally {
    loadingStatus.value = false
  }
}

const connectGoogle = () => {
  statusMessage.value = ''
  window.location.href = `${apiBase}/api/auth/google/connect`
}

const handleLogout = async () => {
  await logout()
  await router.push('/login')
}

async function calculateRouteFor(item) {
  if (!homeLocation.value) { alert('Please set a Home location first'); return }
  if (!item.location) { alert('No location set for this routine item'); return }

  try {
    const place = await geocodePlace(item.location)
    const home = await geocodePlace(homeLocation.value)

    const departure = item.time.includes(':') && item.time.split(':').length >= 2 ? (item.time.length === 5 ? item.time + ':00' : item.time) : item.time + ':00'

    const routes = await get('/api/bus/route', {
      lat_a: home.coordinates.lat,
      lon_a: home.coordinates.lon,
      lat_b: place.coordinates.lat,
      lon_b: place.coordinates.lon,
      departure_time: departure,
      max_transfers: 2,
    })

    // Store preview in shared settings and navigate to dashboard
    setPreview({ routes, item, home: home.coordinates, place: place.coordinates })
    router.push('/dashboard')
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  }
}

onMounted(async () => {
  await refreshGoogleStatus()
  if (route.query.google === 'connected') {
    statusMessage.value = 'Google-Konto verbunden'
  }
})
</script>

<template>
  <div class="settings-page">
    <div class="settings-left">
      <button class="back-btn" @click="router.push('/dashboard')">Back to Dashboard</button>
      <h2>Settings</h2>
      <label>Home location</label>
      <input class="home-input" v-model="homeLocation" placeholder="e.g. Home address or 'Linz'" />

      <hr />

      <div class="day-selector">
        <label>Day</label>
        <DatePickerPopup v-model="selectedDate" />
      </div>

      <section>
        <h3>Alarms</h3>
        <div v-for="alarm in daySettings.alarms" :key="alarm.id" class="alarm-row">
          <input v-model="alarm.time" type="time" />
          <label><input type="checkbox" v-model="alarm.repeat" /> Repeat</label>
          <button class="delete-btn" @click.prevent="removeAlarm(dayKey, alarm.id)" aria-label="Delete alarm">✕</button>
        </div>
        <button @click="addNewAlarm">Add alarm</button>
      </section>

      <section>
        <h3>Routine</h3>
        <div v-for="item in daySettings.routine" :key="item.id" class="routine-row">
          <input v-model="item.time" type="time" />
          <input v-model="item.title" placeholder="Title" />
          <input v-model="item.location" placeholder="Optional location" />
          <button class="delete-btn" @click.prevent="removeRoutineItem(dayKey, item.id)" aria-label="Delete routine item">✕</button>
        </div>
        <button @click="addNewRoutine">Add routine item</button>
      </section>

      <hr />

      <section>
        <h3>Google Kalender</h3>
        <p v-if="loadingStatus">Status wird geladen…</p>
        <p v-else-if="googleConnected">
          Verbunden{{ googleEmail ? `: ${googleEmail}` : '' }}
        </p>
        <p v-else>Nicht verbunden</p>

        <button type="button" @click="connectGoogle">
          {{ googleConnected ? 'Google neu verbinden' : 'Google verbinden' }}
        </button>
      </section>

      <section>
        <h3>Konto</h3>
        <button class="button-secondary" type="button" @click="handleLogout">
          Abmelden
        </button>
      </section>

      <p v-if="statusMessage" class="settings-status">{{ statusMessage }}</p>
    </div>

    <div class="settings-right"></div>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  justify-content: center;
  padding: 32px;
  align-items: flex-start;
  min-height: 100vh;
  overflow-y: auto;
}

.settings-left {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: transparent;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
}

.settings-right {
  display: none
}

.day-selector {
  display: flex;
  flex-direction: column;
  gap: 6px
}

input[type="text"],
input[type="time"],
input[type="date"] {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb
}

button {
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: #3b82f6;
  color: white;
  cursor: pointer;
}

.button-secondary {
  background: #6b7280;
}

/* Back button should look like primary action buttons */
.back-btn { margin-bottom: 12px; display: inline-flex; align-self: flex-start; width: auto; }

/* Constrain home location input width so it doesn't span the entire screen */
.home-input { max-width: 560px; width: 100%; display: block }

button:disabled {
  opacity: 0.6
}

.alarm-row,
.routine-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px
}

.delete-btn {
  background: transparent;
  color: #ef4444;
  border: 1px solid #fee2e2;
  padding: 6px 8px;
  border-radius: 6px;
  font-weight: 700;
}

.delete-btn:hover {
  background: #fee2e2
}

.settings-status {
  color: #2563eb;
}

.route-card {
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 8px
}

.error {
  color: #b91c1c
}
</style>
