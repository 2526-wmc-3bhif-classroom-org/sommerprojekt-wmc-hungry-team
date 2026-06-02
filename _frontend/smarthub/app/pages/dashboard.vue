<script setup lang="ts">
import { useSettings } from '../composables/use-settings'

const { preview, clearPreview } = useSettings()
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

      <bus-widget />
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

.dashboard__clock {
  flex: 1.2;
}

.dashboard__weather {
  flex: 0.6;
}

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
</style>
