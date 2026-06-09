<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRuntimeConfig } from '#app'
import { useSettings } from '../composables/use-settings.js'
import { useSmarthubApi } from '../composables/use-smarthub-api.js'
import DatePickerPopup from '../components/date-picker-popup.vue'
import AddressAutocomplete from '../components/address-autocomplete.vue'

definePageMeta({
  alias: ['/routine-settings'],
})

const router = useRouter()
const route = useRoute()

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref<string>(today)

const { state, getDay, addRoutineItem, updateRoutineItem, removeRoutineItem, setPreview } = useSettings()
const { geocodePlace, get, fetchMe, logout } = useSmarthubApi()

const dayKey = computed(() => selectedDate.value)
const daySettings = computed(() => getDay(dayKey.value))

function addNewRoutine() { addRoutineItem(dayKey.value) }

// Sync alarm time with start time when start time changes, 
// if user hasn't diverged them (this is a simple approximation, we can also just let them be independent)
function handleStartTimeChange(item: any, newTime: string) {
  if (item.startTime === item.alarmTime) {
    item.alarmTime = newTime
  }
  item.startTime = newTime
}

const googleConnected = ref(false)
const googleEmail = ref<string | null>(null)
const statusMessage = ref('')
const loadingStatus = ref(true)

const config = useRuntimeConfig()
const apiBase = String(config.public.apiBaseUrl || '').replace(/\/$/, '')



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

async function calculateRouteFor(item: any) {
  if (!item.destination) { alert('No destination set for this routine item'); return }
  if (item.transportMode === 'bus' && !item.startAddress) { alert('No start address set for bus route'); return }

  try {
    const place = await geocodePlace(item.destination)
    let home
    if (item.transportMode === 'bus') {
      home = await geocodePlace(item.startAddress)
    }

    const departure = item.startTime.includes(':') && item.startTime.split(':').length >= 2 ? (item.startTime.length === 5 ? item.startTime + ':00' : item.startTime) : item.startTime + ':00'

    if (item.transportMode === 'bus' && home) {
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
    }
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

      <div class="day-selector">
        <label>Tag auswählen</label>
        <DatePickerPopup v-model="selectedDate" />
      </div>

      <section class="routines-section">
        <h3>⏰ Routinen</h3>
        <div class="routines-header" v-if="daySettings.routines.length > 0">
          <div class="header-time">Startzeit</div>
          <div class="header-time">Wecker</div>
          <div class="header-dest">Ziel-Adresse</div>
          <div class="header-start">Start-Adresse</div>
          <div class="header-mode">Modus</div>
          <div class="header-action"></div>
        </div>

        <div v-for="item in daySettings.routines" :key="item.id" class="routine-row">
          <input 
            :value="item.startTime" 
            @input="(e) => handleStartTimeChange(item, (e.target as HTMLInputElement).value)" 
            type="time" 
            class="input-time" 
            title="Startzeit"
          />
          <input v-model="item.alarmTime" type="time" class="input-time" title="Wecker" />
          <AddressAutocomplete 
            v-model="item.destination" 
            placeholder="Ziel (z.B. Meixnerkreuzung)" 
          />
          
          <AddressAutocomplete 
            v-model="item.startAddress" 
            placeholder="Start (z.B. Hauptbahnhof)" 
          />

          <div class="transport-toggle">
            <button 
              type="button" 
              class="toggle-btn" 
              :class="{ active: item.transportMode === 'bus' }"
              @click="item.transportMode = 'bus'"
              title="Bus"
            >🚌</button>
            <button 
              type="button" 
              class="toggle-btn" 
              :class="{ active: item.transportMode === 'car' }"
              @click="item.transportMode = 'car'"
              title="Auto"
            >🚗</button>
          </div>

          <button class="delete-btn" @click.prevent="removeRoutineItem(dayKey, item.id)" aria-label="Delete routine">✕</button>
        </div>
        
        <button class="add-routine-btn" @click="addNewRoutine">+ Routine hinzufügen</button>
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

.routines-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.routines-header {
  display: flex;
  gap: 8px;
  padding: 0 8px;
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 600;
}

.header-time { width: 100px; }
.header-dest, .header-start { flex: 1; }
.header-mode { width: 90px; text-align: center; }
.header-action { width: 32px; }

.routine-row {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #f9fafb;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.input-time {
  width: 100px;
}

.input-text {
  min-width: 0;
}

.flex-1 {
  flex: 1;
}

.opacity-50 {
  opacity: 0.5;
  background-color: #f3f4f6;
}

.transport-toggle {
  display: flex;
  background: #e5e7eb;
  border-radius: 6px;
  padding: 2px;
  width: 90px;
}

.toggle-btn {
  flex: 1;
  background: transparent;
  color: #4b5563;
  padding: 4px 0;
  border-radius: 4px;
  font-size: 1.2rem;
  line-height: 1;
}

.toggle-btn.active {
  background: white;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.add-routine-btn {
  align-self: flex-start;
  background: #f3f4f6;
  color: #374151;
  border: 1px dashed #d1d5db;
  margin-top: 8px;
}
.add-routine-btn:hover {
  background: #e5e7eb;
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
