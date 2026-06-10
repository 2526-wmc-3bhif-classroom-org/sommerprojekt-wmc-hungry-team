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

const { state, getGlobalSettings, addRoutineItem, updateRoutineItem, removeRoutineItem, setPreview, saveGlobalSettings } = useSettings()
const { geocodePlace, get, fetchMe, logout } = useSmarthubApi()

const globalSettings = computed(() => getGlobalSettings())

const routines = computed(() => state.value.routines)

function addNewRoutine() { addRoutineItem() }

function addAlarm(item: any) {
  if (!item.alarms) item.alarms = []
  item.alarms.push({
    id: crypto.randomUUID(),
    time: item.startTime,
    enabled: true
  })
}

function removeAlarm(item: any, alarmId: string) {
  item.alarms = item.alarms.filter((a: any) => a.id !== alarmId)
}

function toggleDay(item: any, dayIndex: number) {
  if (!item.activeDays) item.activeDays = []
  const idx = item.activeDays.indexOf(dayIndex)
  if (idx === -1) {
    item.activeDays.push(dayIndex)
  } else {
    item.activeDays.splice(idx, 1)
  }
  updateRoutineItem(item)
}

const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

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
    statusMessage.value = 'Could not load status'
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
    statusMessage.value = 'Google account connected'
  }
})
</script>

<template>
  <div class="settings-page">
    <div class="settings-left">
      <div class="settings-page-header">
        <button class="back-btn-premium" @click="router.push('/dashboard')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Dashboard
        </button>
        <h2>Settings</h2>
      </div>

      <section class="routines-section">
        <div class="routines-section-header">
          <h3>🖥️ Dashboard View</h3>
        </div>
        <div class="routine-card">
          <div class="routine-card__body" style="padding: 16px 20px;">
            <div class="routine-card__row" style="align-items: center; justify-content: space-between;">
              <div class="routine-card__field">
                <label class="field-label" style="font-size: 0.95rem; color: #111827; margin: 0; text-transform: none; letter-spacing: normal;">Clock Type</label>
              </div>
              <select :value="globalSettings.clockType" @change="(e) => { getGlobalSettings().clockType = (e.target as HTMLSelectElement).value as any; saveGlobalSettings() }" class="premium-select" style="min-width: 200px;">
                <option value="digital">Digital (e.g. 14:30)</option>
                <option value="analog">Analog (Clock face)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section class="routines-section">
        <div class="routines-section-header">
          <h3>⏰ Your Routines</h3>
          <button class="add-routine-btn-premium" @click="addNewRoutine">+ New Routine</button>
        </div>

        <div v-for="item in routines" :key="item.id" class="routine-card">
          <div class="routine-card__header">
            <div class="transport-segment">
              <button 
                type="button" 
                class="segment-btn" 
                :class="{ active: item.transportMode === 'bus' }"
                @click="item.transportMode = 'bus'; updateRoutineItem(item)"
              >🚌 Public Transport</button>
              <button 
                type="button" 
                class="segment-btn" 
                :class="{ active: item.transportMode === 'car' }"
                @click="item.transportMode = 'car'; updateRoutineItem(item)"
              >🚗 Car</button>
            </div>
            <button class="delete-routine-btn" @click.prevent="removeRoutineItem(item.id)" aria-label="Delete routine">Delete</button>
          </div>

          <div class="routine-card__body">
            <div class="routine-card__section">
              <label class="field-label">Active on days</label>
              <div class="days-pill-container">
                <button 
                  v-for="(dayStr, idx) in daysOfWeek" 
                  :key="idx" 
                  class="day-pill" 
                  :class="{ 'day-pill--active': item.activeDays?.includes(idx) }"
                  @click="toggleDay(item, idx)"
                >
                  {{ dayStr }}
                </button>
              </div>
            </div>

            <div class="routine-card__section">
              <label class="field-label">Visibility on the Dashboard</label>
              <p class="helper-text">Determines during which time period this routine is displayed (not an arrival time).</p>
              <div class="routine-card__row" style="align-items: center; gap: 12px; margin-top: 4px;">
                <TimePicker 
                  :model-value="item.startTime"
                  @update:model-value="(val) => { item.startTime = val; updateRoutineItem(item) }"
                />
                <span style="color: #6b7280; font-weight: 500;">to</span>
                <TimePicker 
                  :model-value="item.endTime"
                  @update:model-value="(val) => { item.endTime = val; updateRoutineItem(item) }"
                />
              </div>
            </div>

            <div class="routine-card__section">
              <div class="routine-card__field">
                <label class="field-label">Start Address</label>
                <AddressAutocomplete 
                  :model-value="item.startAddress" 
                  @update:model-value="(val) => { item.startAddress = val; updateRoutineItem(item) }"
                  placeholder="e.g. Central Station" 
                />
              </div>
              <div class="routine-card__field">
                <label class="field-label">Destination Address</label>
                <AddressAutocomplete 
                  :model-value="item.destination" 
                  @update:model-value="(val) => { item.destination = val; updateRoutineItem(item) }"
                  placeholder="e.g. City Center" 
                />
              </div>
            </div>

            <div class="routine-card__section">
              <div class="alarms-header">
                <label class="field-label">Linked Alarms</label>
                <button class="add-alarm-btn" @click="addAlarm(item); updateRoutineItem(item)">+ Add Alarm</button>
              </div>
              <div class="alarms-list" v-if="item.alarms && item.alarms.length > 0">
                <div v-for="alarm in item.alarms" :key="alarm.id" class="alarm-pill">
                  <TimePicker 
                    :model-value="alarm.time"
                    @update:model-value="(val) => { alarm.time = val; updateRoutineItem(item) }"
                  />
                  <label class="alarm-toggle">
                    <input 
                      type="checkbox" 
                      :checked="alarm.enabled"
                      @change="(e) => { alarm.enabled = (e.target as HTMLInputElement).checked; updateRoutineItem(item) }"
                    />
                    <span class="slider"></span>
                  </label>
                  <button class="remove-alarm-btn" @click="removeAlarm(item, alarm.id); updateRoutineItem(item)">✕</button>
                </div>
              </div>
              <div v-else class="alarms-empty">No alarms set</div>
            </div>
          </div>
        </div>
      </section>



      <section class="routines-section">
        <div class="routines-section-header">
          <h3>📅 Integrations & Account</h3>
        </div>
        
        <div class="routine-card">
          <div class="routine-card__body">
            <div class="routine-card__row" style="align-items: center; justify-content: space-between;">
              <div class="routine-card__field">
                <label class="field-label">Google Calendar</label>
                <div style="font-size: 0.9rem; color: #4b5563;">
                  <span v-if="loadingStatus">Loading status...</span>
                  <span v-else-if="googleConnected">Connected as <b>{{ googleEmail }}</b></span>
                  <span v-else>Not connected</span>
                </div>
              </div>
              <button class="add-routine-btn-premium" @click="connectGoogle">
                {{ googleConnected ? 'Reconnect' : 'Connect' }}
              </button>
            </div>
            
            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 0;" />
            
            <div class="routine-card__row" style="align-items: center; justify-content: space-between;">
              <div class="routine-card__field">
                <label class="field-label">SmartHub Account</label>
                <div style="font-size: 0.9rem; color: #4b5563;">Logged in on this device</div>
              </div>
              <button class="delete-routine-btn" style="border: 1px solid #fee2e2; border-radius: 8px;" @click="handleLogout">
                Logout
              </button>
            </div>
          </div>
        </div>
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
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  background: transparent;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
  margin: 0 auto;
}

.settings-right {
  display: none
}

.day-selector, .global-setting {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 200px;
}

.premium-select {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  color: #111827;
  cursor: pointer;
  transition: all 0.2s;
}

.premium-select:hover {
  border-color: #d1d5db;
}

.premium-select:focus {
  outline: none;
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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

.settings-page-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.settings-page-header h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.back-btn-premium {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: #6b7280;
  border: none;
  font-size: 0.95rem;
  font-weight: 500;
  padding: 0;
  cursor: pointer;
  transition: color 0.2s;
  align-self: flex-start;
}

.back-btn-premium:hover {
  color: #111827;
}

/* Constrain home location input width so it doesn't span the entire screen */
.home-input { max-width: 560px; width: 100%; display: block }

button:disabled {
  opacity: 0.6
}

.routines-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 600px;
}

.routines-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: -8px;
}

.routines-section-header h3 {
  margin: 0;
  font-weight: 600;
  color: #111827;
}

.add-routine-btn-premium {
  background: #111827;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.add-routine-btn-premium:hover {
  background: #374151;
  transform: translateY(-1px);
}

.routine-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid #f3f4f6;
  overflow: hidden;
  transition: all 0.2s ease;
}

.routine-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.routine-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.transport-segment {
  display: flex;
  background: #e5e7eb;
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
}

.segment-btn {
  background: transparent;
  color: #6b7280;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
}

.segment-btn.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.delete-routine-btn {
  background: transparent;
  color: #ef4444;
  font-weight: 500;
  font-size: 0.9rem;
  padding: 6px 12px;
}

.delete-routine-btn:hover {
  background: #fee2e2;
  color: #b91c1c;
}

.routine-card__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.routine-card__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.routine-card__row {
  display: flex;
  gap: 16px;
}

.routine-card__field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #4b5563;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.helper-text {
  margin: 0;
  font-size: 0.8rem;
  color: #6b7280;
  line-height: 1.4;
}

.days-pill-container {
  display: flex;
  gap: 8px;
}

.day-pill {
  flex: 1;
  background: #f3f4f6;
  color: #9ca3af;
  border: none;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;
}

.day-pill--active {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.alarms-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.add-alarm-btn {
  background: #f3f4f6;
  color: #374151;
  padding: 4px 12px;
  font-size: 0.8rem;
  border-radius: 12px;
}

.add-alarm-btn:hover {
  background: #e5e7eb;
}

.alarms-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.alarm-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 6px 12px;
  border-radius: 12px;
}

.alarms-empty {
  font-size: 0.9rem;
  color: #9ca3af;
  font-style: italic;
}

.alarm-toggle {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}

.alarm-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.alarm-toggle .slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #d1d5db;
  transition: .3s;
  border-radius: 20px;
}

.alarm-toggle .slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

.alarm-toggle input:checked + .slider {
  background-color: #10b981;
}

.alarm-toggle input:checked + .slider:before {
  transform: translateX(14px);
}

.remove-alarm-btn {
  background: transparent;
  color: #ef4444;
  font-size: 1rem;
  padding: 0 4px;
}

.remove-alarm-btn:hover {
  color: #b91c1c;
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
