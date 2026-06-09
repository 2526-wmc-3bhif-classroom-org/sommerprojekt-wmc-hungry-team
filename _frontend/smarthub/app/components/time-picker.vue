<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const hours = computed({
  get: () => (props.modelValue || '00:00').split(':')[0] || '00',
  set: (val: string) => emit('update:modelValue', `${val}:${minutes.value}`)
})

const minutes = computed({
  get: () => ((props.modelValue || '00:00').split(':')[1] || '00').substring(0, 2),
  set: (val: string) => emit('update:modelValue', `${hours.value}:${val}`)
})
</script>

<template>
  <div class="time-picker">
    <input 
      type="number" 
      v-model="hours" 
      class="time-input" 
      min="0" 
      max="23" 
      @blur="hours = String(Math.min(23, Math.max(0, parseInt(hours) || 0))).padStart(2, '0')"
    />
    <span class="time-separator">:</span>
    <input 
      type="number" 
      v-model="minutes" 
      class="time-input" 
      min="0" 
      max="59" 
      @blur="minutes = String(Math.min(59, Math.max(0, parseInt(minutes) || 0))).padStart(2, '0')"
    />
  </div>
</template>

<style scoped>
.time-picker {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 4px 8px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}

.time-input {
  border: none;
  background: transparent;
  padding: 4px;
  font-size: 1rem;
  font-family: inherit;
  font-weight: 500;
  color: #1f2937;
  width: 36px;
  text-align: center;
  -moz-appearance: textfield;
  transition: all 0.2s;
}

.time-input:focus {
  outline: none;
  background: #f3f4f6;
  border-radius: 6px;
}

.time-input::-webkit-outer-spin-button,
.time-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.time-separator {
  font-weight: 700;
  color: #9ca3af;
}
</style>
