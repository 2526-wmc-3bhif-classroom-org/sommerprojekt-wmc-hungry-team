<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '../composables/use-settings'

const { state } = useSettings()

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
    <h3 class="appointments-widget__title"><i class="fa-solid fa-clock" style="color: var(--color-primary); margin-right: 8px;"></i>Upcoming Alarms (Today)</h3>
    <div v-if="activeAlarms.length === 0" class="appointments-widget__status">
      No alarms activated for today.
    </div>
    <div v-else class="appointments-widget__list">
      <div v-for="(alarm, idx) in activeAlarms" :key="idx" class="appointments-widget__item">
        <span class="appointments-widget__time">{{ alarm.time }}</span>
        <span class="appointments-widget__title-text">
          <span class="alarm-badge">Active</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.appointments-widget {
  background: var(--bg-surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px var(--shadow-widget);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.appointments-widget__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary-alt-2);
  margin: 0;
}

.appointments-widget__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: 6px;
}

/* Custom scrollbar styling */
.appointments-widget__list::-webkit-scrollbar {
  width: 6px;
}
.appointments-widget__list::-webkit-scrollbar-track {
  background: transparent;
}
.appointments-widget__list::-webkit-scrollbar-thumb {
  background: var(--border-stronger);
  border-radius: 3px;
}
.appointments-widget__list::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.appointments-widget__status {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.appointments-widget__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-surface-hover);
  border-radius: 8px;
  border: 1px solid var(--border-base);
}

.appointments-widget__time {
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.alarm-badge {
  background: var(--bg-primary-light);
  color: var(--color-primary-dark);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
