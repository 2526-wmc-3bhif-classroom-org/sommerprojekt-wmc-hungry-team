<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// reactive state
const time = ref("")
const date = ref("")
const alarm = ref("07:00")

let interval:number = 0;

function updateClock() {
  const now = new Date()

  time.value = now.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })

  date.value = now.toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  })
}

// lifecycle
onMounted(() => {
  updateClock()
  interval = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <div class="time-widget">
    <div class="time-widget__title">Uhrzeit</div>

    <div class="time-widget__clock">{{ time }}</div>
    <div class="time-widget__date">{{ date }}</div>

    <div class="time-widget__alarm">
      Wecker: {{ alarm }}
    </div>
  </div>
</template>

<style scoped>  
.time-widget {
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  padding: 24px;
  max-width: 448px;
}

/* Title */
.time-widget__title {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 8px;
}

/* Clock */
.time-widget__clock {
  font-size: 2.25rem;
  font-weight: 700;
  color: #1f2937;
}

/* Date */
.time-widget__date {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 4px;
}

/* Alarm */
.time-widget__alarm {
  margin-top: 12px;
  font-size: 0.875rem;
  color: #374151;
}
</style>