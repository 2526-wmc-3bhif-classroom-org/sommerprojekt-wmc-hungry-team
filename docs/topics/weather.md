# Weather Service API Documentation

## Overview

The Weather Service provides weather forecast data using the OpenMeteo API. It returns 2-hour interval forecasts for the rest of the current calendar day (from now until midnight).

## Base URL

```
/api/weather
```

## Endpoints

### GET /api/weather/forecast

Fetches weather forecast data for a specific location.

**Query Parameters:**

| Parameter | Type   | Required | Description                                    | Validation           |
|-----------|--------|----------|------------------------------------------------|----------------------|
| `lat`     | number | Yes      | Latitude of the location                       | -90 to 90            |
| `lon`     | number | Yes      | Longitude of the location                      | -180 to 180          |

**Example Request:**

```bash
GET /api/weather/forecast?lat=48.3069&lon=14.2858
```

**Response Format:**

```json
{
  "location": {
    "latitude": 48.3069,
    "longitude": 14.2858
  },
  "timezone": "Europe/Vienna",
  "forecasts": [
    {
      "time": "2026-03-17T18:00:00",
      "temperature": 12.5,
      "feelsLike": 10.3,
      "humidity": 65,
      "windSpeed": 15.2,
      "windDirection": 220,
      "windGusts": 25.0,
      "precipitation": 0.0,
      "precipitationProbability": 10,
      "weatherCode": 2,
      "weatherDescription": "Partly cloudy",
      "cloudCover": 45,
      "visibility": 10000,
      "isDay": true,
      "conditions": {
        "snow": false,
        "rain": false,
        "ice": false,
        "sunny": false,
        "cloudy": true
      }
    }
    // ... more 2-hour intervals until midnight
  ]
}
```

**Response Fields:**

| Field                                  | Type    | Description                                           |
|----------------------------------------|---------|-------------------------------------------------------|
| `location.latitude`                    | number  | Requested latitude                                    |
| `location.longitude`                   | number  | Requested longitude                                   |
| `timezone`                             | string  | IANA timezone identifier                              |
| `forecasts[].time`                     | string  | ISO 8601 timestamp (local time)                       |
| `forecasts[].temperature`              | number  | Temperature in °C                                     |
| `forecasts[].feelsLike`                | number  | Apparent temperature (feels-like) in °C               |
| `forecasts[].humidity`                 | number  | Relative humidity (%)                                 |
| `forecasts[].windSpeed`                | number  | Wind speed in km/h                                    |
| `forecasts[].windDirection`            | number  | Wind direction in degrees (0-360)                     |
| `forecasts[].windGusts`                | number  | Wind gusts in km/h                                    |
| `forecasts[].precipitation`            | number  | Precipitation amount in mm                            |
| `forecasts[].precipitationProbability` | number  | Probability of precipitation (%)                      |
| `forecasts[].weatherCode`              | number  | WMO weather code (see table below)                    |
| `forecasts[].weatherDescription`       | string  | Human-readable weather description                    |
| `forecasts[].cloudCover`               | number  | Total cloud cover (%)                                 |
| `forecasts[].visibility`               | number  | Visibility in meters                                  |
| `forecasts[].isDay`                    | boolean | True if daytime, false if nighttime                   |
| `forecasts[].conditions.snow`          | boolean | True if snow is present/forecasted                    |
| `forecasts[].conditions.rain`          | boolean | True if rain is present/forecasted                    |
| `forecasts[].conditions.ice`           | boolean | True if freezing conditions (temp ≤ 0°C)              |
| `forecasts[].conditions.sunny`         | boolean | True if clear/sunny (cloud cover < 20%)               |
| `forecasts[].conditions.cloudy`        | boolean | True if cloudy (cloud cover ≥ 50%)                    |

**Error Responses:**

```json
{
  "error": "Invalid coordinates",
  "message": "Latitude must be between -90 and 90"
}
```

**Status Codes:**

- `200` - Success
- `400` - Invalid parameters (missing or out-of-range coordinates)
- `500` - Server error (OpenMeteo API failure)
- `503` - Service unavailable (OpenMeteo API timeout)

---

## WMO Weather Codes

Weather codes follow the [WMO weather interpretation standard](https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM):

| Code | Description                      |
|------|----------------------------------|
| 0    | Clear sky                        |
| 1    | Mainly clear                     |
| 2    | Partly cloudy                    |
| 3    | Overcast                         |
| 45   | Fog                              |
| 48   | Depositing rime fog              |
| 51   | Light drizzle                    |
| 53   | Moderate drizzle                 |
| 55   | Dense drizzle                    |
| 61   | Slight rain                      |
| 63   | Moderate rain                    |
| 65   | Heavy rain                       |
| 71   | Slight snow fall                 |
| 73   | Moderate snow fall               |
| 75   | Heavy snow fall                  |
| 77   | Snow grains                      |
| 80   | Slight rain showers              |
| 81   | Moderate rain showers            |
| 82   | Violent rain showers             |
| 85   | Slight snow showers              |
| 86   | Heavy snow showers               |
| 95   | Thunderstorm                     |
| 96   | Thunderstorm with slight hail    |
| 99   | Thunderstorm with heavy hail     |

---

## OpenMeteo API Integration

### API Call

The backend makes the following request to OpenMeteo:

```
GET https://api.open-meteo.com/v1/forecast
```

**Required Parameters:**

- `latitude`: Location latitude
- `longitude`: Location longitude
- `hourly`: Comma-separated list of weather variables
- `timezone`: IANA timezone identifier (auto-detected from coordinates)
- `forecast_days`: 1 (only today)

**Hourly Variables Requested:**

```
temperature_2m
apparent_temperature
relative_humidity_2m
precipitation
precipitation_probability
weather_code
cloud_cover
wind_speed_10m
wind_direction_10m
wind_gusts_10m
visibility
is_day
```

### Data Processing

1. Fetch hourly data from OpenMeteo
2. Filter to 2-hour intervals (every other hour: 00:00, 02:00, 04:00, etc.)
3. Filter to only include times from now until 23:59 of current day
4. Map weather codes to human-readable descriptions
5. Calculate condition flags (snow, rain, ice, sunny, cloudy)
6. Return formatted JSON response

---

## Frontend Integration

### Pinia Store

Weather data should be stored in a temporary Pinia store (`useWeatherStore`):

```typescript
// stores/weather.ts
export const useWeatherStore = defineStore('weather', {
  state: () => ({
    forecasts: new Map() // key: "lat,lon", value: forecast data
  }),
  
  actions: {
    async fetchWeather(lat: number, lon: number) {
      const response = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`)
      const data = await response.json()
      this.forecasts.set(`${lat},${lon}`, data)
      return data
    }
  }
})
```

### Usage in WeatherWidget

```typescript
// components/WeatherWidget.vue
const weatherStore = useWeatherStore()
const weatherData = ref(null)

onMounted(async () => {
  const routineLocation = { lat: 48.3069, lon: 14.2858 } // from routine config
  weatherData.value = await weatherStore.fetchWeather(
    routineLocation.lat, 
    routineLocation.lon
  )
})
```

---

## Related Endpoints

### Place Lookup (Shared Service)

Since both weather and bus routing widgets need to convert place names to coordinates, a shared endpoint is required:

**Endpoint:** `GET /api/places/geocode`

**Query Parameters:**
- `place`: string (place name/address)

**Response:**
```json
{
  "place": "Linz, Austria",
  "coordinates": {
    "lat": 48.3069,
    "lon": 14.2858
  },
  "formattedAddress": "Linz, Upper Austria, Austria"
}
```

This endpoint uses the Google Places API (Geocoding API) to convert place names to coordinates. The same coordinates are then used for both:
- Weather forecast requests
- Bus route planning requests

---

## Environment Variables

Add to `.env`:

```env
# Existing
DB_USER=transit_admin
DB_PASSWORD=admin
DB_NAME=gtfs_data
DB_HOST=localhost
DB_PORT=5432

# Weather & Places
GOOGLE_KEY=your_google_api_key_here  # Used for Places API
```

**Note:** OpenMeteo API is free and does not require an API key for basic usage.

---

## Implementation Notes

1. **Frontend Caching**: Weather data is fetched fresh at the start of each routine and cached temporarily in frontend Pinia store. Cache automatically expires at 00:00 Europe/Vienna (midnight).
2. **Timezone handling**: Use location's local timezone for time display
3. **Error handling**: Gracefully handle OpenMeteo API failures with user-friendly error messages
4. **Rate limiting**: OpenMeteo allows ~10,000 requests/day on free tier
5. **2-hour intervals**: Filter hourly data to show every 2 hours (00:00, 02:00, 04:00, etc.)
6. **Day boundary**: Only show forecasts until 23:59 of current day in location's local time
7. **Place Disambiguation**: When place name lookup returns multiple results, frontend presents all options to user for disambiguation
