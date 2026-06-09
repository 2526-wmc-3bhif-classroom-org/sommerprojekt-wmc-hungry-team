<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useSettings } from '../composables/use-settings'
import CarWidget from '../components/car-widget.vue'

const { preview, clearPreview, state } = useSettings()

const today = ref(new Date().toISOString().slice(0, 10))
const currentDayOfWeek = ref(new Date().getDay())
const currentTime = ref('')

function updateTime() {
  const now = new Date()
  today.value = now.toISOString().slice(0, 10)
  currentDayOfWeek.value = now.getDay()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hh}:${mm}`
}

let timeInterval: ReturnType<typeof setInterval>
onMounted(() => {
  updateTime()
  timeInterval = setInterval(updateTime, 10000) // check every 10s
})
onUnmounted(() => clearInterval(timeInterval))

const activeRoutine = computed(() => {
  return state.value.routines.find(r => 
    r.activeDays?.includes(currentDayOfWeek.value) && 
    r.startTime <= currentTime.value && 
    r.endTime >= currentTime.value
  )
})

const transportMode = computed(() => activeRoutine.value?.transportMode)
</script>

<template>
  <div class="dashboard">
    <div class="dashboard__left">
      <clock-widget class="dashboard__clock" />
      <weather-widget class="dashboard__weather" />
      <appointments-widget class="dashboard__appointments" />
    </div>
    <div class="dashboard__right">
      <div v-if="preview" class="route-preview">
        <div class="route-preview__header">
          <h3>Route Preview</h3>
          <button @click="clearPreview">Close</button>
        </div>
        <div v-if="Array.isArray(preview.routes) && preview.routes.length>0">
          <div v-for="(r, idx) in preview.routes" :key="idx" class="route-card">
            <div><strong>Departure:</strong> {{ r.departure_time }} → <strong>Arrival:</strong> {{ r.arrival_time }}</div>
            <div><strong>Duration:</strong> {{ r.total_duration_minutes }} minutes</div>
            <div v-for="(leg, i) in r.legs" :key="i" class="leg">
              <div>{{ leg.board_stop_name }} → {{ leg.alight_stop_name }} ({{ leg.route_short_name }})</div>
              <div>{{ leg.departure_time }} → {{ leg.arrival_time }}</div>
            </div>
          </div>
        </div>
        <div v-else>No routes found</div>
      </div>

      <bus-widget v-if="transportMode === 'bus'" />
      <car-widget v-else-if="transportMode === 'car'" />
      <div v-else class="no-routine-msg">
        Please configure a routine in the settings
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  gap: 20px;
  height: 100%;
}

.dashboard__left {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 35%;
  min-width: 320px;
}

.dashboard__clock,
.dashboard__weather,
.dashboard__appointments {
  flex: 1;
}

.dashboard__right {
  width: 65%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.route-preview { background:#fff; padding:12px; border-radius:8px; margin-bottom:12px; box-shadow:0 4px 12px rgba(0,0,0,0.06) }
.route-preview__header { display:flex; justify-content:space-between; align-items:center }
.route-card { padding:8px; border:1px solid #eee; border-radius:6px; margin-bottom:8px }

.no-routine-msg {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 32px;
  text-align: center;
  color: #6b7280;
  font-size: 1.1rem;
}
</style>
