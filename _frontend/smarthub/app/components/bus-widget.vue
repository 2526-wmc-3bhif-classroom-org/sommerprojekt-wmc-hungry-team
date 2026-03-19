<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { BusRoute, BusRouteApiResponse, RouteLeg, BusStop } from '~/types/bus';
import { formatTime, formatDuration, getRouteTypeLabel } from '~/types/bus';

const START_LAT = 48.29107692;
const START_LON = 14.27502937;
const START_NAME = "Linz/Donau Jäger im Tal";

const END_LAT = 48.30039407;
const END_LON = 14.26712419;
const END_NAME = "Rohrbach b.Linz Wambacherberg";

const DEPARTURE_TIME = "08:30:00";
const MAX_TRANSFERS = 2;

const routeData = ref<BusRoute | null>(null);
const rawApiData = ref<BusRouteApiResponse[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

function transformRouteData(apiData: BusRouteApiResponse[]): BusRoute {
  if (!apiData || apiData.length === 0) {
    throw new Error('No route data to transform');
  }

  const legs: RouteLeg[] = apiData.map((leg, index) => {
    const startStop: BusStop = {
      id: leg.boarded_at_stop_id,
      name: leg.boarded_at_stop_name,
      time: formatTime(leg.departure_time),
      isTransfer: index > 0
    };

    const endStop: BusStop = {
      id: leg.alight_at_stop_id,
      name: leg.alight_at_stop_name,
      time: formatTime(leg.arrival_time),
      isTransfer: !!leg.transfer_stop_name
    };

    return {
      routeName: leg.route_short_name,
      routeFullName: leg.route_long_name,
      routeType: leg.route_type,
      startStop,
      endStop,
      departureTime: formatTime(leg.departure_time),
      arrivalTime: formatTime(leg.arrival_time),
      stops: [startStop, endStop]
    };
  });

  const firstLeg = apiData[0];
  const lastLeg = apiData[apiData.length - 1];

  if (!firstLeg || !lastLeg) {
    throw new Error('apiData is empty');
  }

  const transferCount = firstLeg.legs - 1;

  return {
    legs,
    totalDuration: formatDuration(firstLeg.total_duration),
    transferCount,
    finalArrival: formatTime(lastLeg.arrival_time),
    startLocation: START_NAME,
    endLocation: END_NAME
  };
}

async function fetchRoute() {
  loading.value = true;
  error.value = null;

  try {
    const params = new URLSearchParams({
      lat_a: START_LAT.toString(),
      lon_a: START_LON.toString(),
      lat_b: END_LAT.toString(),
      lon_b: END_LON.toString(),
      departure_time: DEPARTURE_TIME,
      max_transfers: MAX_TRANSFERS.toString()
    });

    const response = await fetch(`http://localhost:3000/api/bus/route?${params}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data: BusRouteApiResponse[] = await response.json();

    if (!data || data.length === 0) {
      error.value = 'No route found between these locations';
      return;
    }

    rawApiData.value = data;
    console.log('Route API response:', data);

    routeData.value = transformRouteData(data);
    console.log('Transformed route data:', routeData.value);

  } catch (err) {
    console.error('Error fetching route:', err);
    error.value = err instanceof Error ? err.message : 'Failed to fetch route';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  console.log('Bus widget mounted, fetching route...');
  fetchRoute();
});
</script>

<template>
  <div class="bus-widget">
    <!-- Widget title -->
    <h2 v-if="routeData" class="bus-widget__title">
      Route {{ routeData?.legs[0]?.routeName || 'Bus' }}
    </h2>

    <!-- Loading state -->
    <div v-if="loading" class="bus-widget__state bus-widget__state--loading">
      <div class="bus-widget__spinner"></div>
      <div class="bus-widget__state-text">Loading route...</div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="bus-widget__state bus-widget__state--error">
      <div class="bus-widget__error-message">{{ error }}</div>
      <button class="bus-widget__retry-btn" @click="fetchRoute">
        Retry
      </button>
    </div>

    <!-- Route flowchart -->
    <div v-else-if="routeData" class="bus-widget__flowchart">
      <div class="bus-widget__timeline">
        <!-- Vertical line -->
        <div class="bus-widget__timeline-line"></div>

        <div class="bus-widget__legs">
          <template v-for="(leg, legIndex) in routeData.legs" :key="legIndex">
            <!-- Start stop -->
            <div class="bus-widget__stop">
              <div
                  class="bus-widget__stop-dot"
                  :class="{ 'bus-widget__stop-dot--transfer': leg.startStop.isTransfer }"
              ></div>
              <div class="bus-widget__stop-info">
                <div class="bus-widget__stop-name">{{ leg.startStop.name }}</div>
                <div class="bus-widget__stop-route">
                  {{ getRouteTypeLabel(leg.routeType) }} {{ leg.routeName }}
                </div>
              </div>
              <div class="bus-widget__stop-time">{{ leg.startStop.time }}</div>
            </div>

            <!-- End stop -->
            <div class="bus-widget__stop">
              <div
                  class="bus-widget__stop-dot"
                  :class="{ 'bus-widget__stop-dot--transfer': leg.endStop.isTransfer }"
              ></div>
              <div class="bus-widget__stop-info">
                <div class="bus-widget__stop-name">{{ leg.endStop.name }}</div>
                <div v-if="leg.endStop.isTransfer" class="bus-widget__stop-transfer-label">
                  Transfer
                </div>
              </div>
              <div class="bus-widget__stop-time">{{ leg.endStop.time }}</div>
            </div>
          </template>
        </div>
      </div>

      <!-- Summary section -->
      <div class="bus-widget__summary">
        <div class="bus-widget__summary-item">
          <div class="bus-widget__summary-label">Fahrzeit</div>
          <div class="bus-widget__summary-value">{{ routeData.totalDuration }}</div>
        </div>
        <div class="bus-widget__summary-item">
          <div class="bus-widget__summary-label">Umstiege</div>
          <div class="bus-widget__summary-value">{{ routeData.transferCount }}</div>
        </div>
        <div class="bus-widget__summary-item">
          <div class="bus-widget__summary-label">Ankunft</div>
          <div class="bus-widget__summary-value">{{ routeData.finalArrival }}</div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="bus-widget__state bus-widget__state--empty">
      No route data available
    </div>
  </div>
</template>

<style scoped>
/* ── Container ── */
.bus-widget {
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  padding: 24px;
  max-width: 448px;
}

.bus-widget__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 24px 0;
}

/* ── States (loading / error / empty) ── */
.bus-widget__state {
  text-align: center;
  padding: 48px 0;
}

.bus-widget__state--error,
.bus-widget__state--empty {
  color: #6b7280;
}

/* Loading spinner */
.bus-widget__spinner {
  display: inline-block;
  width: 48px;
  height: 48px;
  border: 3px solid #e5e7eb;
  border-bottom-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.bus-widget__state-text {
  margin-top: 16px;
  color: #6b7280;
}

/* Error */
.bus-widget__error-message {
  color: #dc2626;
  margin-bottom: 16px;
}

.bus-widget__retry-btn {
  padding: 8px 16px;
  background-color: #3b82f6;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.15s ease;
}

.bus-widget__retry-btn:hover {
  background-color: #2563eb;
}

/* ── Timeline ── */
.bus-widget__timeline {
  position: relative;
  padding: 16px 16px 16px 48px;
}

.bus-widget__timeline-line {
  position: absolute;
  left: 24px;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #3b82f6;
}

.bus-widget__legs {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ── Stop row ── */
.bus-widget__stop {
  position: relative;
  display: flex;
  align-items: center;
}

/* Stop dot */
.bus-widget__stop-dot {
  position: absolute;
  left: -28px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #3b82f6;
  background-color: #ffffff;
  z-index: 1;
  flex-shrink: 0;
}

.bus-widget__stop-dot--transfer {
  left: -36px;
  width: 24px;
  height: 24px;
  background-color: #3b82f6;
}

/* Stop text block */
.bus-widget__stop-info {
  flex: 1;
}

.bus-widget__stop-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.bus-widget__stop-route {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 2px;
}

.bus-widget__stop-transfer-label {
  font-size: 0.75rem;
  color: #2563eb;
  font-weight: 500;
  margin-top: 2px;
}

/* Time */
.bus-widget__stop-time {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-left: 16px;
  flex-shrink: 0;
}

/* ── Summary ── */
.bus-widget__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.bus-widget__summary-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin-bottom: 4px;
}

.bus-widget__summary-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
}
</style>