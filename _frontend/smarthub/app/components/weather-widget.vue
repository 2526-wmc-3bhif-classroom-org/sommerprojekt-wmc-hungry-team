<script setup lang="ts">
const temperature = 18
const skyState = 'Bewölkt'
const weatherIcon = '☁️'
</script>

<template>
  <div class="weather-widget">
    <div class="weather-widget__icon">{{ weatherIcon }}</div>
    <div class="weather-widget__info">
      <div class="weather-widget__temp">{{ temperature }}°C</div>
      <div class="weather-widget__sky">{{ skyState }}</div>
    </div>
  </div>
</template>

<style scoped>
.weather-widget {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.weather-widget__icon {
  font-size: 3rem;
  line-height: 1;
}

.weather-widget__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.weather-widget__temp {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
}

.weather-widget__sky {
  font-size: 1rem;
  color: #6b7280;
}
</style>
