<script setup lang="ts">
import { useSettings } from '../composables/use-settings'
import { useSmarthubApi } from '../composables/use-smarthub-api'

const today = new Date().toISOString().slice(0,10)
const selectedDate = ref<string>(today)

const { state, getDay, setHomeLocation, addAlarm, addRoutineItem, updateRoutineItem, removeRoutineItem, removeAlarm, setPreview } = useSettings()
const { geocodePlace, get } = useSmarthubApi()

const dayKey = computed(() => selectedDate.value)
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
          <button @click.prevent="() => calculateRouteFor(item)">Calc route</button>
          <button class="delete-btn" @click.prevent="removeRoutineItem(dayKey, item.id)" aria-label="Delete routine item">✕</button>
        </div>
        <button @click="addNewRoutine">Add routine item</button>
      </section>
    </div>

    <div class="settings-right"></div>
  </div>
</template>

<style scoped>
.settings-page { display:flex; gap:20px; padding:20px }
.settings-left { width:420px; display:flex; flex-direction:column; gap:12px }
.settings-right { flex:1; background:#fff; padding:16px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.06) }
.alarm-row, .routine-row { display:flex; gap:8px; align-items:center; margin-bottom:8px }
.route-card { padding:8px; border:1px solid #eee; border-radius:6px; margin-bottom:8px }
.error { color: #b91c1c }
</style>
