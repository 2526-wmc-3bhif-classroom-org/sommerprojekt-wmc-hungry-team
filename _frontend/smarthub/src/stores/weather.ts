import { defineStore } from 'pinia';
import { ref } from 'vue';

// Weather forecast interface matching backend response
interface WeatherForecast {
  location: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  forecasts: ForecastInterval[];
}

interface ForecastInterval {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  precipitation: number;
  precipitationProbability: number;
  weatherCode: number;
  weatherDescription: string;
  cloudCover: number;
  visibility: number;
  isDay: boolean;
  conditions: {
    snow: boolean;
    rain: boolean;
    ice: boolean;
    sunny: boolean;
    cloudy: boolean;
  };
}

export const useWeatherStore = defineStore('weather', () => {
  // State: Map of weather data keyed by "lat,lon"
  const forecasts = ref(new Map<string, WeatherForecast>());

  // Action: Fetch weather data from backend
  async function fetchWeather(lat: number, lon: number): Promise<WeatherForecast> {
    const key = `${lat},${lon}`;
    
    // Check if already cached
    const cached = forecasts.value.get(key);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch weather data');
      }

      const data: WeatherForecast = await response.json();
      
      // Store in cache
      forecasts.value.set(key, data);
      
      return data;
    } catch (error: any) {
      console.error('Weather fetch error:', error);
      throw error;
    }
  }

  // Getter: Retrieve cached weather data
  function getWeather(lat: number, lon: number): WeatherForecast | undefined {
    const key = `${lat},${lon}`;
    return forecasts.value.get(key);
  }

  // Action: Clear all cached data
  function clearCache() {
    forecasts.value.clear();
  }

  return {
    forecasts,
    fetchWeather,
    getWeather,
    clearCache
  };
});
