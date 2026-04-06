<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const currentTime = ref('')
const currentDate = ref('')

const alarmTime = '07:30'
const alarmActive = true

function updateClock() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('de-AT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  currentDate.value = now.toLocaleDateString('de-AT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

let interval: ReturnType<typeof setInterval>
onMounted(() => {
  updateClock()
  interval = setInterval(updateClock, 1000)
})
onUnmounted(() => clearInterval(interval))
</script>

<template>
  <div class="clock-widget">
    <div class="clock-widget__time">{{ currentTime }}</div>
    <div class="clock-widget__date">{{ currentDate }}</div>
    <div v-if="alarmActive" class="clock-widget__alarm">
      <span class="clock-widget__alarm-icon">&#9200;</span>
      <span class="clock-widget__alarm-text">Alarm {{ alarmTime }}</span>
    </div>
  </div>
</template>

<style scoped>
.clock-widget {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clock-widget__time {
  font-size: 3rem;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: 0.02em;
}

.clock-widget__date {
  font-size: 1rem;
  color: #6b7280;
}

.clock-widget__alarm {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 6px 12px;
  background: #fef3c7;
  border-radius: 8px;
  width: fit-content;
}

.clock-widget__alarm-icon {
  font-size: 1.1rem;
  color: #d97706;
}

.clock-widget__alarm-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #92400e;
}
</style>
