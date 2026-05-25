<script setup lang="ts">
import { useSettings } from '../composables/use-settings'
import { useSmarthubApi } from '../composables/use-smarthub-api'

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const selected = ref<number>(1)

const { state, getDay, setHomeLocation, addAlarm, addRoutineItem, updateRoutineItem, removeRoutineItem, setPreview } = useSettings()
const { geocodePlace, get } = useSmarthubApi()

const dayKey = computed(() => String(selected.value))
const daySettings = computed(() => getDay(dayKey.value))

const homeLocation = ref(state.value.homeLocation ?? '')
watch(homeLocation, (v) => setHomeLocation(v))

function addNewAlarm() { addAlarm(dayKey.value) }
function addNewRoutine() { addRoutineItem(dayKey.value) }

async function calculateRouteFor(item) {
  if (!homeLocation.value) { alert('Please set a Home location first'); return }
  if (!item.location) { alert('No location set for this routine item'); return }

  try {
    const place = await geocodePlace(item.location)
    const home = await geocodePlace(homeLocation.value)

    const departure = item.time.includes(':') && item.time.split(':').length >= 2 ? (item.time.length===5? item.time+':00' : item.time) : item.time+':00'

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
    navigateTo('/dashboard')
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-left">
      <h2>Settings</h2>
      <label>Home location</label>
      <input v-model="homeLocation" placeholder="e.g. Home address or 'Linz'" />

      <hr />

      <div class="day-selector">
        <label>Day</label>
        <select v-model.number="selected">
          <option v-for="(d, i) in days" :key="i" :value="i">{{ d }}</option>
        </select>
      </div>

      <section>
        <h3>Alarms</h3>
        <div v-for="alarm in daySettings.alarms" :key="alarm.id" class="alarm-row">
          <input v-model="alarm.time" type="time" />
          <label><input type="checkbox" v-model="alarm.repeat" /> Repeat</label>
        </div>
        <button @click="addNewAlarm">Add alarm</button>
      </section>

      <section>
        <h3>Routine</h3>
        <div v-for="item in daySettings.routine" :key="item.id" class="routine-row">
          <input v-model="item.time" type="time" />
          <input v-model="item.title" placeholder="Title" />
          <input v-model="item.location" placeholder="Optional location" />
          <button @click.prevent="() => calculateRouteFor(item)">Calc route</button>
        </div>
        <button @click="addNewRoutine">Add routine item</button>
      </section>
    </div>

    <!-- Preview moved to Dashboard -->
    <div class="settings-right">
      <p>Route preview opens on the dashboard after clicking "Calc route".</p>
    </div>
  </div>
</template>

<style scoped>

/* ── Page Layout ── */
.settings-page {
  display: flex;
  gap: 32px;
  padding: 40px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

/* ── Left Panel ── */
.settings-left {
  flex: 1;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.settings-left h2 {
  font-size: 2.2rem;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 8px;
}

/* ── Form Groups ── */
.settings-left label {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.settings-left input[type="text"],
.settings-left input[type="time"],
.settings-left select {
  width: 100%;
  padding: 16px 20px;
  font-size: 1.05rem;
  border: 2px solid #d1d5db;
  border-radius: 12px;
  background: white;
  color: #1f2937;
  transition: all 0.2s ease;
  font-family: inherit;
}

.settings-left input[type="text"]:focus,
.settings-left input[type="time"]:focus,
.settings-left select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.settings-left input::placeholder {
  color: #9ca3af;
}

/* ── Divider ── */
hr {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 12px 0;
}

/* ── Day Selector ── */
.day-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Sections ── */
section {
  background: white;
  padding: 28px;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

section h3 {
  font-size: 1.4rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Alarm Row ── */
.alarm-row {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.alarm-row:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.alarm-row input[type="time"] {
  flex: 0 0 auto;
  width: 140px;
  padding: 12px 16px;
  font-size: 1rem;
}

.alarm-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  text-transform: none;
  color: #6b7280;
  cursor: pointer;
}

.alarm-row input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #3b82f6;
}

/* ── Routine Row ── */
.routine-row {
  display: grid;
  grid-template-columns: 140px 1fr 1fr auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.routine-row:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.routine-row input[type="time"],
.routine-row input[type="text"] {
  width: 100%;
  padding: 12px 16px;
  font-size: 0.95rem;
  margin: 0;
}

/* ── Buttons ── */
button {
  padding: 14px 28px;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: none;
  font-family: inherit;
}

button:active {
  transform: scale(0.98);
}

/* Add Button (secondary) */
section > button {
  width: 100%;
  background: #3b82f6;
  color: white;
  margin-top: 12px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

section > button:hover {
  background: #2563eb;
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

/* Calc Route Button (in routine row) */
.routine-row button {
  background: #10b981;
  color: white;
  padding: 12px 16px;
  font-size: 0.9rem;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
}

.routine-row button:hover {
  background: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  transform: translateY(-2px);
}

/* ── Right Panel ── */
.settings-right {
  flex: 0 0 300px;
  background: white;
  padding: 32px 28px;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.6);
  height: fit-content;
  position: sticky;
  top: 40px;
}

.settings-right p {
  font-size: 1.05rem;
  line-height: 1.6;
  color: #6b7280;
  text-align: center;
}

/* ── Route Card ── */
.route-card {
  padding: 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 12px;
  background: #f9fafb;
}

/* ── Error State ── */
.error {
  color: #dc2626;
  font-weight: 600;
  font-size: 0.95rem;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .settings-page {
    flex-direction: column;
    gap: 20px;
    padding: 24px;
  }

  .settings-right {
    position: static;
    max-width: 100%;
    flex: 1;
  }

  .routine-row {
    grid-template-columns: 1fr;
  }

  .routine-row input,
  .routine-row button {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .settings-page {
    padding: 16px;
  }

  .settings-left h2 {
    font-size: 1.8rem;
  }

  section {
    padding: 20px;
  }

  .alarm-row,
  .routine-row {
    flex-direction: column;
    padding: 12px;
  }

  .alarm-row input[type="time"],
  .routine-row input {
    width: 100%;
  }

  .routine-row {
    grid-template-columns: 1fr;
  }
}

</style>
