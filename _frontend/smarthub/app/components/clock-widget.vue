<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useSettings } from '../composables/use-settings'

const { state, getGlobalSettings } = useSettings()

const globalSettings = computed(() => getGlobalSettings())
const isAnalog = computed(() => globalSettings.value.clockType === 'analog')

const currentTimeStr = ref('')
const currentDate = ref('')
const rawTime = ref('')
const currentDayOfWeek = ref(new Date().getDay())

const nowHour = ref(0)
const nowMinute = ref(0)
const nowSecond = ref(0)

function updateClock() {
  const now = new Date()
  
  nowHour.value = now.getHours()
  nowMinute.value = now.getMinutes()
  nowSecond.value = now.getSeconds()
  currentDayOfWeek.value = now.getDay()

  currentTimeStr.value = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  rawTime.value = `${hh}:${mm}`
  
  currentDate.value = now.toLocaleDateString('en-US', {
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
  <div class="clock-widget" :class="{ 'clock-widget--analog': isAnalog }">
    <div class="clock-widget__top">
      <template v-if="isAnalog">
        <div class="clock-analog">
          <div class="clock-face">
            <!-- Optional dial markers -->
            <div v-for="n in 12" :key="n" class="dial-marker" :style="{ transform: `rotate(${n * 30}deg)` }"></div>
            
            <div class="hand hour-hand" :style="{ transform: `rotate(${(nowHour % 12) * 30 + nowMinute / 2}deg)` }"></div>
            <div class="hand minute-hand" :style="{ transform: `rotate(${nowMinute * 6 + nowSecond / 10}deg)` }"></div>
            <div class="hand second-hand" :style="{ transform: `rotate(${nowSecond * 6}deg)` }"></div>
            <div class="center-dot"></div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="clock-widget__time">{{ currentTimeStr }}</div>
      </template>
      
      <div class="clock-widget__date">{{ currentDate }}</div>
    </div>
  </div>
</template>

<style scoped>
.clock-widget {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.clock-widget__top {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 32px;
  width: 100%;
}

.clock-widget--analog {
  /* Inherits row layout now */
}

.clock-analog {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  border: 6px solid #f3f4f6;
  background: #ffffff;
  position: relative;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.05);
  flex-shrink: 0;
}

.clock-face {
  position: relative;
  width: 100%;
  height: 100%;
}

.dial-marker {
  position: absolute;
  top: 0;
  left: 50%;
  width: 4px;
  height: 100%;
  margin-left: -2px;
}

.dial-marker::after {
  content: '';
  display: block;
  width: 100%;
  height: 12px;
  background: #e5e7eb;
}

.hand {
  position: absolute;
  bottom: 50%;
  left: 50%;
  transform-origin: bottom center;
  border-radius: 4px;
  z-index: 2;
}

.hour-hand {
  width: 6px;
  height: 25%;
  margin-left: -3px;
  background: #1f2937;
}

.minute-hand {
  width: 4px;
  height: 35%;
  margin-left: -2px;
  background: #6b7280;
}

.second-hand {
  width: 2px;
  height: 40%;
  margin-left: -1px;
  background: #ef4444;
  z-index: 3;
}

.center-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  margin-top: -6px;
  background: #ef4444;
  border-radius: 50%;
  z-index: 4;
}

.clock-widget__time {
  font-size: 3rem;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: 0.02em;
}

.clock-widget__date {
  font-size: 1.25rem;
  font-weight: 500;
  color: #4b5563;
}


</style>
