<script setup lang="ts">
import { computed } from 'vue'
import type { RoutineItem } from '../composables/use-settings'

const props = defineProps<{
  routine?: RoutineItem | null
}>()

const carRoutine = computed(() => props.routine)
const destination = computed(() => carRoutine.value?.destination ?? '')
const hasDestination = computed(() => destination.value.trim() !== '')
</script>

<template>
  <div class="car-widget">
    <h3 class="car-widget__title"><i class="fa-solid fa-car" style="color: var(--color-primary); margin-right: 8px;"></i>Route (Car)</h3>
    <div v-if="!hasDestination" class="car-widget__status">
      Please configure destination address in the settings
    </div>
    <template v-else>
      <div class="car-widget__route-label">Destination: {{ destination }}</div>
      <div class="car-widget__content">
        <div class="car-widget__icon">🚗</div>
        <div class="car-widget__message">Travel time and traffic will be displayed here shortly.</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.car-widget {
  background: var(--bg-surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px var(--shadow-widget);
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
  color: var(--text-primary-alt-2);
  margin: 0;
}

.car-widget__status {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.car-widget__route-label {
  color: var(--text-muted);
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
  background: var(--bg-surface-hover);
  border-radius: 8px;
  padding: 32px 16px;
}

.car-widget__icon {
  font-size: 3rem;
}

.car-widget__message {
  color: var(--text-muted);
  font-size: 0.95rem;
}
</style>
