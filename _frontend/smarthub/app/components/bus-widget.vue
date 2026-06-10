<script setup lang="ts">
import type { BusRouteApiResponse } from '../types/bus'
import { formatDurationMinutes, formatTime } from '../types/bus'
import { useSettings } from '../composables/use-settings'

const MAX_TRANSFERS = 2

const { state } = useSettings()

const currentDayOfWeek = ref(new Date().getDay())
const today = new Date().toISOString().slice(0, 10)

const busRoutine = computed(() => {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  return state.value.routines.find(r => {
    if (!r.activeDays?.includes(currentDayOfWeek.value)) return false
    if (r.transportMode !== 'bus') return false
    
    const start = r.startTime || '00:00'
    const end = r.endTime || '23:59'
    
    if (start <= end) {
      return currentTime >= start && currentTime <= end
    } else {
      return currentTime >= start || currentTime <= end
    }
  })
})

const startPlace = computed(() => busRoutine.value?.startAddress ?? '')
const endPlace = computed(() => busRoutine.value?.destination ?? '')
const hasStops = computed(() => startPlace.value.trim() !== '' && endPlace.value.trim() !== '')

const loading = ref(true)
const error = ref('')
const route = ref<BusRouteApiResponse | null>(null)

const { geocodePlace, get } = useSmarthubApi()

function getCurrentTimeParam() {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

const travelTime = computed(() => route.value ? formatDurationMinutes(route.value.total_duration_minutes) : '-')
const transferCount = computed(() => route.value?.num_transfers ?? 0)
const arrivalTime = computed(() => route.value ? formatTime(route.value.arrival_time) : '--:--')

onMounted(async () => {
  if (!hasStops.value) {
    error.value = 'Please configure start and destination stops in the settings'
    loading.value = false
    return
  }

  try {
    const [start, end] = await Promise.all([
      geocodePlace(startPlace.value),
      geocodePlace(endPlace.value),
    ])

    const targetArrival = busRoutine.value?.arrivalTime ? `${busRoutine.value.arrivalTime}:00` : '08:00:00'

    const fetchRoutesByArrival = (arrivalTime: string) => {
      return get<BusRouteApiResponse[]>('/api/bus/route', {
        lat_a: start.coordinates.lat,
        lon_a: start.coordinates.lon,
        lat_b: end.coordinates.lat,
        lon_b: end.coordinates.lon,
        arrival_time: arrivalTime,
        max_transfers: MAX_TRANSFERS,
      })
    }

    const fetchRoutesByDeparture = (departureTime: string) => {
      return get<BusRouteApiResponse[]>('/api/bus/route', {
        lat_a: start.coordinates.lat,
        lon_a: start.coordinates.lon,
        lat_b: end.coordinates.lat,
        lon_b: end.coordinates.lon,
        departure_time: departureTime,
        max_transfers: MAX_TRANSFERS,
      })
    }

    let routes = await fetchRoutesByArrival(targetArrival)
    let selectedRoute = routes[0]

    const nowTime = getCurrentTimeParam()
    if (selectedRoute && selectedRoute.departure_time < nowTime) {
      // Missed the ideal departure time! Fetch next available route departing now.
      routes = await fetchRoutesByDeparture(nowTime)
      selectedRoute = routes[0]
    } else if (!selectedRoute) {
      // Fallback if no route found arriving by that time
      routes = await fetchRoutesByDeparture(nowTime)
      selectedRoute = routes[0]
    }

    route.value = selectedRoute ?? null
    if (!route.value) {
      error.value = 'No route found'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not load routes'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="bus-widget">
    <h3 class="bus-widget__title"><i class="fa-solid fa-route" style="color: #3b82f6; margin-right: 8px;"></i>Route</h3>
    <div v-if="loading" class="bus-widget__status">Loading route...</div>
    <div v-else-if="error" class="bus-widget__status bus-widget__status--error">{{ error }}</div>
    <template v-else>
      <div class="bus-widget__route-label">{{ startPlace }} → {{ endPlace }}</div>

      <div class="bus-widget__timeline">
        <template v-for="(leg, index) in route?.legs || []" :key="index">
          <!-- Boarding Stop -->
          <div class="bus-widget__stop">
            <div class="bus-widget__stop-dot"></div>
            <div class="bus-widget__stop-info">
              <div class="bus-widget__stop-name">{{ leg.board_stop_name }}</div>
            </div>
          </div>

          <!-- Connection -->
          <div class="bus-widget__connection">
            <div class="bus-widget__connection-line"></div>
            <div class="bus-widget__connection-content">
              <div class="bus-widget__connection-time">{{ formatTime(leg.departure_time) }}</div>
              <div class="bus-widget__connection-mode">
                <i v-if="leg.route_type === 3" class="fa-solid fa-bus" style="color: #3b82f6; width: 24px; text-align: center;"></i>
                <i v-else-if="leg.route_type === 0" class="fa-solid fa-train-tram" style="color: #3b82f6; width: 24px; text-align: center;"></i>
                <i v-else-if="leg.route_type === 99" class="fa-solid fa-person-walking" style="color: #3b82f6; width: 24px; text-align: center;"></i>
                <i v-else class="fa-solid fa-bus" style="color: #3b82f6; width: 24px; text-align: center;"></i>
                <template v-if="leg.route_type === 99">
                  Walk
                </template>
                <template v-else>
                  Line {{ leg.route_short_name }}
                </template>
              </div>
              <div class="bus-widget__connection-time">{{ formatTime(leg.arrival_time) }}</div>
            </div>
          </div>

          <!-- Final Stop -->
          <div v-if="index === route!.legs.length - 1" class="bus-widget__stop">
            <div class="bus-widget__stop-dot bus-widget__stop-dot--end"></div>
            <div class="bus-widget__stop-info">
              <div class="bus-widget__stop-name">{{ leg.alight_stop_name }}</div>
            </div>
          </div>
        </template>
      </div>

      <div class="bus-widget__summary">
        <div class="bus-widget__summary-item">
          <div class="bus-widget__summary-label">Travel time</div>
          <div class="bus-widget__summary-value">{{ travelTime }}</div>
        </div>
        <div class="bus-widget__summary-item">
          <div class="bus-widget__summary-label">Transfers</div>
          <div class="bus-widget__summary-value">{{ transferCount }}</div>
        </div>
        <div class="bus-widget__summary-item">
          <div class="bus-widget__summary-label">Arrival</div>
          <div class="bus-widget__summary-value">{{ arrivalTime }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bus-widget {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  min-height: 0;
}

.bus-widget__title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.bus-widget__route-label {
  color: #6b7280;
  font-size: 1.1rem;
  margin-top: -8px;
}

.bus-widget__status {
  color: #6b7280;
  font-size: 1.1rem;
}

.bus-widget__status--error {
  color: #b91c1c;
}

.bus-widget__timeline {
  position: relative;
  padding-left: 48px;
  flex: 1;
}

.bus-widget__stop {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.bus-widget__stop-dot {
  position: absolute;
  box-sizing: border-box;
  left: -36px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  border: 4px solid #3b82f6;
  z-index: 1;
}

.bus-widget__stop-dot--end {
  background: #3b82f6;
}

.bus-widget__stop-info {
  flex: 1;
}

.bus-widget__stop-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.bus-widget__connection {
  position: relative;
  display: flex;
  padding: 4px 0 4px 0;
}

.bus-widget__connection-line {
  position: absolute;
  box-sizing: border-box;
  left: -29px; /* -36px left + 9px half width = -27px center. line width 4px => left -29px */
  top: -8px;
  bottom: -8px;
  width: 4px;
  background: #3b82f6;
  border-radius: 2px;
}

.bus-widget__connection-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 12px 16px;
  width: 100%;
}

.bus-widget__connection-time {
  font-size: 1rem;
  font-weight: 600;
  color: #6b7280;
}

.bus-widget__connection-mode {
  font-size: 1.15rem;
  font-weight: 700;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}

.bus-widget__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
  text-align: center;
}

.bus-widget__summary-label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin-bottom: 4px;
}

.bus-widget__summary-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: #1f2937;
}
</style>
