# Weather Endpoint Implementation - Thought Process

## Overview

This document explains my implementation strategy for the weather service endpoints (weather forecast + places geocoding). The implementation follows the existing codebase patterns established in the bus routing feature.

## Analysis of Existing Patterns

### Current Architecture

Looking at the existing bus routing implementation, I identified these patterns:

1. **Module System**: Uses ES modules (`"type": "module"` in package.json)
2. **File Extensions**: Import statements use `.js` extension even for `.ts` files (TSX compilation quirk)
3. **Router Structure**: Routers define routes WITH the full path (e.g., `/api/bus/test` not just `/test`)
4. **Repository Pattern**: Separate repo files handle all data fetching/processing logic
5. **Error Handling**: Try-catch blocks in routers, throw errors from repos
6. **Validation**: Extensive parameter validation in routers before calling repo functions
7. **No External HTTP Library**: Current code doesn't use axios/node-fetch (only pg for database)

### Key Files

- **`app.ts`**: Imports routers, mounts with `app.use()`, no path prefix needed
- **`routers/bus-route.ts`**: Full path in routes, validates all inputs, calls repo functions
- **`repo/bus-repo.ts`**: Exports async functions, uses Pool pattern for database
- **`package.json`**: Has express, pg, dotenv; no axios or node-fetch yet

## Implementation Strategy

### Decision: HTTP Client Library

**Problem**: Need to make HTTP requests to OpenMeteo and Google Geocoding APIs.

**Options**:
1. **Node.js built-in `https` module** - No dependencies, but verbose and callback-based
2. **`node-fetch`** - Popular, promise-based, fetch API compatible
3. **`axios`** - Feature-rich, promise-based, automatic JSON parsing

**Decision: Use built-in `https` module wrapped in Promise**

**Reasoning**:
- Raspberry Pi performance: No extra dependencies = smaller memory footprint
- Already using Node.js built-in modules (no axios/fetch in package.json suggests preference)
- OpenMeteo and Google APIs are simple GET requests (no complex features needed)
- Can always add axios later if needed

**Implementation Pattern**:
```typescript
import https from 'https';

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}
```

### Phase 1: Weather Repository (`repo/weather-repo.ts`)

**Purpose**: Fetch weather data from OpenMeteo, process it, return formatted response

**Function Signature**:
```typescript
export async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherForecast>
```

**Implementation Steps**:

1. **Define Timezone Constant**
   ```typescript
   // At top of file
   const TIMEZONE = 'Europe/Vienna';
   ```

2. **Build OpenMeteo API URL**
   ```typescript
   const params = new URLSearchParams({
     latitude: lat.toString(),
     longitude: lon.toString(),
     hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,...',
     timezone: TIMEZONE,  // Always use Vienna time
     forecast_days: '1'
   });
   const url = `https://api.open-meteo.com/v1/forecast?${params}`;
   ```

2. **Fetch Data**
   - Use `fetchJson()` helper
   - Timeout: 10 seconds (similar to database query timeout pattern)
   - Error handling: Catch network errors, invalid responses

3. **Process Response**
   - Extract `hourly` object with arrays of values
   - Timezone will always be "Europe/Vienna" (hardcoded)
   - Each index in arrays corresponds to same time slot

4. **Filter to 2-Hour Intervals**
   - OpenMeteo returns hourly data (24 items for 1 day)
   - Filter: Keep indices 0, 2, 4, 6, 8, ... (even indices only)
   - This gives us 00:00, 02:00, 04:00, ..., 22:00

5. **Filter to Current Day Only**
   - Get current time in Vienna timezone (Europe/Vienna)
   - Convert OpenMeteo timestamps to Date objects
   - Filter: `time >= now && time <= endOfDay(now)`
   - This ensures we only show "rest of today until midnight" in Vienna time
   - Use Intl.DateTimeFormat or simple date comparison

6. **Map Weather Codes to Descriptions**
   - Create lookup object:
   ```typescript
   const WEATHER_CODE_MAP: Record<number, string> = {
     0: 'Clear sky',
     1: 'Mainly clear',
     2: 'Partly cloudy',
     // ... etc
   };
   ```

7. **Calculate Condition Flags**
   ```typescript
   conditions: {
     snow: weatherCode >= 71 && weatherCode <= 77,
     rain: (weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82),
     ice: temperature <= 0,
     sunny: cloudCover < 20 && isDay,
     cloudy: cloudCover >= 50
   }
   ```

8. **Return Formatted Object**
   - Match the structure defined in `docs/topics/weather.md`
   - Include location, timezone, and forecasts array

**Error Scenarios**:
- OpenMeteo API down → Throw error with message "Weather service unavailable"
- Invalid response format → Throw error "Invalid weather data"
- Timeout → Throw error "Weather service timeout"

### Phase 2: Places Repository (`repo/places-repo.ts`)

**Purpose**: Convert place name to coordinates using Google Geocoding API

**Function Signature**:
```typescript
export async function geocodePlace(placeName: string): Promise<PlaceResult>
```

**Implementation Steps**:

1. **Get API Key from Environment**
   ```typescript
   const apiKey = process.env.GOOGLE_KEY;
   if (!apiKey) {
     throw new Error('GOOGLE_KEY not configured');
   }
   ```

2. **Build Google Geocoding URL**
   ```typescript
   const params = new URLSearchParams({
     address: placeName,
     key: apiKey,
     region: 'at' // Bias results to Austria
   });
   const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
   ```

3. **Fetch Data**
   - Use same `fetchJson()` helper
   - Timeout: 5 seconds (geocoding is usually faster)

4. **Handle Google API Status**
   ```typescript
   if (data.status !== 'OK') {
     const errorMap = {
       ZERO_RESULTS: 'Place not found',
       OVER_QUERY_LIMIT: 'API quota exceeded',
       REQUEST_DENIED: 'Invalid API key',
       INVALID_REQUEST: 'Invalid place name'
     };
     throw new Error(errorMap[data.status] || 'Geocoding failed');
   }
   ```

5. **Extract First Result**
   - `formatted_address` → display name
   - `geometry.location.lat` → latitude
   - `geometry.location.lng` → longitude (convert to "lon" for consistency)

6. **Return Formatted Object**
   ```typescript
   return {
     place: placeName,
     formattedAddress: result.formatted_address,
     coordinates: {
       lat: result.geometry.location.lat,
       lon: result.geometry.location.lng
     }
   };
   ```

**Error Scenarios**:
- Missing API key → Throw error immediately
- Place not found → Throw error "Place not found"
- API quota exceeded → Throw error with clear message
- Invalid API key → Throw error "Google API authentication failed"

### Phase 3: Weather Router (`routers/weather.ts`)

**Purpose**: HTTP endpoint that validates inputs and calls weather repo

**Route**: `GET /api/weather/forecast`

**Implementation Pattern** (following bus-route.ts structure):

```typescript
import { Router, Request, Response } from 'express';
import { fetchWeatherForecast } from '../repo/weather-repo.js'; // Note .js extension

const router = Router();

router.get('/api/weather/forecast', async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;

    // 1. Check required parameters
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'Missing required parameters: lat, lon' 
      });
    }

    // 2. Parse and validate numbers
    const parsedLat = parseFloat(lat as string);
    const parsedLon = parseFloat(lon as string);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      return res.status(400).json({ 
        error: 'Coordinates must be valid numbers' 
      });
    }

    // 3. Validate ranges
    if (parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json({ 
        error: 'Latitude must be between -90 and 90' 
      });
    }
    
    if (parsedLon < -180 || parsedLon > 180) {
      return res.status(400).json({ 
        error: 'Longitude must be between -180 and 180' 
      });
    }

    // 4. Call repository function
    const forecast = await fetchWeatherForecast(parsedLat, parsedLon);

    // 5. Return success response
    res.json(forecast);

  } catch (e: any) {
    console.error('Weather endpoint error:', e);
    
    // Distinguish between service unavailable and internal error
    if (e.message?.includes('unavailable') || e.message?.includes('timeout')) {
      return res.status(503).json({ 
        error: 'Weather service temporarily unavailable' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: e.message 
    });
  }
});

export default router;
```

**Key Decisions**:
- Same validation pattern as bus-route (consistent UX)
- 503 status for external API failures (not our fault)
- 500 status for internal errors (our code failed)
- Include error messages in dev (remove in production if needed)

### Phase 4: Places Router (`routers/places.ts`)

**Purpose**: HTTP endpoint for geocoding place names

**Route**: `GET /api/places/geocode`

**Implementation Pattern**:

```typescript
import { Router, Request, Response } from 'express';
import { geocodePlace } from '../repo/places-repo.js';

const router = Router();

router.get('/api/places/geocode', async (req: Request, res: Response) => {
  try {
    const { place } = req.query;

    // 1. Validate required parameter
    if (!place || typeof place !== 'string' || place.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Missing required parameter: place' 
      });
    }

    // 2. Call repository function
    const result = await geocodePlace(place as string);

    // 3. Return success response
    res.json(result);

  } catch (e: any) {
    console.error('Geocoding endpoint error:', e);
    
    // Specific error handling for common cases
    if (e.message?.includes('not found')) {
      return res.status(404).json({ 
        error: 'Place not found',
        message: 'Could not find coordinates for the given place name'
      });
    }
    
    if (e.message?.includes('quota')) {
      return res.status(503).json({ 
        error: 'Geocoding service temporarily unavailable',
        message: 'API quota exceeded'
      });
    }
    
    if (e.message?.includes('authentication')) {
      return res.status(500).json({ 
        error: 'Service configuration error' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: e.message 
    });
  }
});

export default router;
```

**Key Decisions**:
- Simpler validation (only one parameter)
- More granular error status codes (404 for not found, 503 for quota)
- Don't expose API key errors to users (security)

### Phase 5: Mount Routers in App (`app.ts`)

**Changes Needed**:

```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import busRouter from './routers/bus-route.js';
import weatherRouter from './routers/weather.js';      // ADD
import placesRouter from './routers/places.js';        // ADD

// ... existing env logging ...

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(busRouter);
app.use(weatherRouter);    // ADD
app.use(placesRouter);     // ADD

// ... rest of app.ts ...
```

**Why No Path Prefix?**
- Routers already include full path (e.g., `/api/weather/forecast`)
- Matches existing pattern with `busRouter`
- Simpler, more explicit

## Testing Strategy

### Manual Testing Order

1. **Test Places Endpoint First** (no dependencies)
   ```bash
   # Valid place
   curl "http://localhost:3000/api/places/geocode?place=Linz,%20Austria"
   
   # Invalid place
   curl "http://localhost:3000/api/places/geocode?place=asdfghjkl"
   
   # Missing parameter
   curl "http://localhost:3000/api/places/geocode"
   ```

2. **Test Weather Endpoint** (needs coordinates from places)
   ```bash
   # Valid coordinates (Linz)
   curl "http://localhost:3000/api/weather/forecast?lat=48.3069&lon=14.2858"
   
   # Invalid coordinates
   curl "http://localhost:3000/api/weather/forecast?lat=91&lon=14.2858"
   
   # Missing parameters
   curl "http://localhost:3000/api/weather/forecast?lat=48.3069"
   ```

3. **Integration Test** (places → weather flow)
   ```bash
   # Get coordinates for a place
   LAT_LON=$(curl -s "http://localhost:3000/api/places/geocode?place=Vienna" | jq -r '.coordinates | "\(.lat),\(.lon)"')
   
   # Use those coordinates for weather
   curl "http://localhost:3000/api/weather/forecast?lat=${LAT_LON%,*}&lon=${LAT_LON#*,}"
   ```

4. **Edge Cases**
   - Request at 23:45 Vienna time (should return very few intervals)
   - Request at 01:00 Vienna time (should return ~11 intervals until midnight)
   - ~~Different timezones~~ (not applicable - always Vienna time)
   - Extreme coordinates (verify OpenMeteo works for any lat/lon)

### Verification Checklist

- [ ] OpenMeteo returns hourly data (24 items)
- [ ] Filtering produces 2-hour intervals (12 items max)
- [ ] Day boundary filtering works (only until 23:59 Vienna time)
- [ ] Weather codes map to descriptions correctly
- [ ] Condition flags calculate correctly
- [ ] Timezone always shows "Europe/Vienna"
- [ ] Google API returns coordinates
- [ ] Place "not found" returns 404
- [ ] Invalid coordinates return 400
- [ ] Missing parameters return 400

## Potential Issues & Solutions

### Issue 1: Timezone Handling

**Problem**: OpenMeteo returns times in location's timezone, but filtering "until midnight" needs correct timezone awareness.

**Solution - SIMPLIFIED**: 
- Use Vienna time (Europe/Vienna) everywhere for now
- Define constant: `const TIMEZONE = 'Europe/Vienna';`
- Pass this to OpenMeteo API: `timezone=Europe/Vienna` parameter
- All time calculations use Vienna time, regardless of actual location
- This is acceptable since the project focuses on Austrian transit (Linz AG, OOEVV)

**Future Enhancement**: If needed, can make timezone dynamic based on coordinates later

### Issue 2: HTTPs Module Certificate Validation

**Problem**: Some SSL certificates might fail validation on Raspberry Pi.

**Solution**:
- Default: Trust system certificates (should work)
- If issues: Add `rejectUnauthorized: false` option (only as last resort)
- Better: Ensure Pi system certificates are up to date

### Issue 3: OpenMeteo Rate Limiting

**Problem**: Free tier has 10,000 requests/day limit.

**Solution**:
- Not a concern for single-user Pi dashboard
- If needed: Add simple in-memory cache (5-minute TTL)
- Weather doesn't change every second

### Issue 4: Module Import Extensions

**Problem**: TypeScript files imported as `.js` (TSX requirement).

**Solution**:
- Follow existing pattern: import from `.js` even though file is `.ts`
- TSX handles this automatically during execution
- Consistent with bus-route pattern

## Type Definitions

To maintain type safety, I'll define interfaces:

```typescript
// In weather-repo.ts
export interface WeatherForecast {
  location: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  forecasts: ForecastInterval[];
}

export interface ForecastInterval {
  time: string; // ISO 8601
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

// In places-repo.ts
export interface PlaceResult {
  place: string;
  formattedAddress: string;
  coordinates: {
    lat: number;
    lon: number;
  };
}
```

## Summary

This implementation:
- ✅ Follows existing codebase patterns (router/repo structure)
- ✅ Uses no external HTTP libraries (lightweight for Pi)
- ✅ Validates all inputs thoroughly (defensive programming)
- ✅ Handles errors gracefully (distinguishes API vs internal errors)
- ✅ Provides clear error messages (developer-friendly)
- ✅ Matches documentation in `docs/topics/weather.md`
- ✅ Type-safe with TypeScript interfaces
- ✅ Ready for frontend Pinia integration

**Implementation Order**:
1. Create helper function for HTTPS requests
2. Implement weather-repo.ts (most complex)
3. Implement places-repo.ts (simpler)
4. Implement weather router
5. Implement places router
6. Mount routers in app.ts
7. Test each endpoint
8. Integration test

**Time Estimate**: ~2-3 hours for backend implementation + testing
