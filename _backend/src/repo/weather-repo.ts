import https from 'https';

// Timezone constant - always use Vienna time
const TIMEZONE = 'Europe/Vienna';

// WMO Weather code descriptions
const WEATHER_CODE_MAP: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

// Helper function to fetch JSON from HTTPS URL
function fetchJson(url: string, timeout: number = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Type definitions
export interface WeatherForecast {
  location: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  forecasts: ForecastInterval[];
}

export interface ForecastInterval {
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

// Main function to fetch weather forecast
export async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherForecast> {
  try {
    // Build OpenMeteo API URL
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      hourly: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'precipitation',
        'precipitation_probability',
        'weather_code',
        'cloud_cover',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'visibility',
        'is_day'
      ].join(','),
      timezone: TIMEZONE,
      forecast_days: '1'
    });
    
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    
    // Fetch data from OpenMeteo
    const data = await fetchJson(url);
    
    if (!data.hourly) {
      throw new Error('Invalid weather data');
    }
    
    // Get current time in Vienna timezone
    const now = new Date();
    const viennaTime = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
    const endOfDay = new Date(viennaTime);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Process hourly data into 2-hour intervals
    const forecasts: ForecastInterval[] = [];
    const hourly = data.hourly;
    
    for (let i = 0; i < hourly.time.length; i++) {
      // Only include even hours (0, 2, 4, 6, etc.) for 2-hour intervals
      const hour = new Date(hourly.time[i]).getHours();
      if (hour % 2 !== 0) continue;
      
      // Parse the forecast time
      const forecastTime = new Date(hourly.time[i]);
      
      // Only include times from now until end of day
      if (forecastTime < viennaTime || forecastTime > endOfDay) {
        continue;
      }
      
      const weatherCode = hourly.weather_code[i];
      const temperature = hourly.temperature_2m[i];
      const cloudCover = hourly.cloud_cover[i];
      const isDay = hourly.is_day[i] === 1;
      
      // Calculate condition flags
      const conditions = {
        snow: weatherCode >= 71 && weatherCode <= 77,
        rain: (weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82),
        ice: temperature <= 0,
        sunny: cloudCover < 20 && isDay,
        cloudy: cloudCover >= 50
      };
      
      forecasts.push({
        time: hourly.time[i],
        temperature: temperature,
        feelsLike: hourly.apparent_temperature[i],
        humidity: hourly.relative_humidity_2m[i],
        windSpeed: hourly.wind_speed_10m[i],
        windDirection: hourly.wind_direction_10m[i],
        windGusts: hourly.wind_gusts_10m[i],
        precipitation: hourly.precipitation[i],
        precipitationProbability: hourly.precipitation_probability[i],
        weatherCode: weatherCode,
        weatherDescription: WEATHER_CODE_MAP[weatherCode] || 'Unknown',
        cloudCover: cloudCover,
        visibility: hourly.visibility[i],
        isDay: isDay,
        conditions: conditions
      });
    }
    
    return {
      location: {
        latitude: lat,
        longitude: lon
      },
      timezone: TIMEZONE,
      forecasts: forecasts
    };
    
  } catch (error: any) {
    console.error('Weather API error:', error);
    if (error.message?.includes('timeout')) {
      throw new Error('Weather service timeout');
    }
    if (error.message?.includes('Invalid')) {
      throw new Error('Invalid weather data');
    }
    throw new Error('Weather service unavailable');
  }
}
