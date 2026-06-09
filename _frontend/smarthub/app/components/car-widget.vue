<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '../composables/use-settings'

const { getDay } = useSettings()

const today = new Date().toISOString().slice(0, 10)

const carRoutine = computed(() => {
  const daySettings = getDay(today)
  return daySettings.routines.find(r => r.transportMode === 'car')
})

const destination = computed(() => carRoutine.value?.destination ?? '')
const hasDestination = computed(() => destination.value.trim() !== '')
</script>

<template>
  <div class="car-widget">
    <h3 class="car-widget__title">Route (Auto)</h3>
    <div v-if="!hasDestination" class="car-widget__status">
      Bitte Ziel-Adresse in den Einstellungen konfigurieren
    </div>
    <template v-else>
      <div class="car-widget__route-label">Ziel: {{ destination }}</div>
      <div class="car-widget__content">
        <div class="car-widget__icon">🚗</div>
        <div class="car-widget__message">Fahrtzeit und Verkehr werden hier in Kürze angezeigt.</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.car-widget {
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

.car-widget__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.car-widget__status {
  color: #6b7280;
  font-size: 0.95rem;
}

.car-widget__route-label {
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: -8px;
}

.car-widget__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 16px;
  text-align: center;
  background: #f9fafb;
  border-radius: 8px;
  padding: 32px 16px;
}

.car-widget__icon {
  font-size: 3rem;
}

.car-widget__message {
  color: #6b7280;
  font-size: 0.95rem;
}
</style>
