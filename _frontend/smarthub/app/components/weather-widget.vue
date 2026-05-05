<script setup lang="ts">
interface ForecastInterval {
  time: string
  temperature: number
  weatherDescription: string
  conditions: {
    rain: boolean
    snow: boolean
    cloudy: boolean
  }
}

interface WeatherResponse {
  forecasts: ForecastInterval[]
}

const PLACE = 'Linz, Austria'

const weather = ref<ForecastInterval | null>(null)
const error = ref('')
const loading = ref(true)

const { geocodePlace, get } = useSmarthubApi()

const weatherIcon = computed(() => {
  const current = weather.value
  if (!current) return '❔'
  if (current.conditions.snow) return '❄️'
  if (current.conditions.rain) return '🌧️'
  if (current.conditions.cloudy) return '☁️'
  return '☀️'
})

onMounted(async () => {
  try {
    const geocode = await geocodePlace(PLACE)
    const response = await get<WeatherResponse>('/api/weather/forecast', {
      lat: geocode.coordinates.lat,
      lon: geocode.coordinates.lon,
    })

    weather.value = response.forecasts[0] ?? null
    if (!weather.value) {
      error.value = 'Keine Wetterdaten verfügbar'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Wetterdaten konnten nicht geladen werden'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="weather-widget">
    <div v-if="loading" class="weather-widget__status">Lade Wetter...</div>
    <div v-else-if="error" class="weather-widget__status weather-widget__status--error">{{ error }}</div>
    <div v-else-if="weather" class="weather-widget__content">
      <div class="weather-widget__icon">{{ weatherIcon }}</div>
      <div class="weather-widget__info">
        <div class="weather-widget__temp">{{ Math.round(weather.temperature) }}°C</div>
        <div class="weather-widget__sky">{{ weather.weatherDescription }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.weather-widget {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 24px;
}

.weather-widget__content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.weather-widget__status {
  color: #6b7280;
  font-size: 0.95rem;
}

.weather-widget__status--error {
  color: #b91c1c;
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
