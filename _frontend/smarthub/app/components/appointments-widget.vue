<script setup lang="ts">
import { computed } from 'vue'
import { state } from '../composables/use-settings'

const today = new Date()
const currentDayOfWeek = computed(() => (today.getDay() + 6) % 7)

const activeAlarms = computed(() => {
  let alarms: any[] = []
  
  for (const r of state.value.routines) {
    if (r.activeDays?.includes(currentDayOfWeek.value) && r.alarms) {
      const validAlarms = r.alarms.filter((a: any) => a.enabled)
      alarms.push(...validAlarms)
    }
  }
  
  alarms.sort((a, b) => a.time.localeCompare(b.time))
  return alarms
})
</script>

<template>
  <div class="appointments-widget">
    <h3 class="appointments-widget__title">⏰ Anstehende Wecker (Heute)</h3>
    <div v-if="activeAlarms.length === 0" class="appointments-widget__status">
      Keine Wecker für heute aktiviert.
    </div>
    <div v-else class="appointments-widget__list">
      <div v-for="(alarm, idx) in activeAlarms" :key="idx" class="appointments-widget__item">
        <span class="appointments-widget__time">{{ alarm.time }}</span>
        <span class="appointments-widget__title-text">
          <span class="alarm-badge">Aktiv</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.appointments-widget {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.appointments-widget__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.appointments-widget__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.appointments-widget__status {
  color: #6b7280;
  font-size: 0.95rem;
}

.appointments-widget__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.appointments-widget__time {
  font-weight: 700;
  font-size: 1.25rem;
  color: #1f2937;
}

.alarm-badge {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
