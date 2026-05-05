# SmartHub - Complete Project Guide

SmartHub is a Raspberry Pi dashboard web application that displays real-time transit information, weather forecasts, clock, and integrates with KNX IoT devices. It supports multi-user access via Google accounts and features configurable time-based "Routines" to display different information widgets.

**Team**: Arthur Dirnberger, Matthias Darabosch, Benjamin Stoica, Almir Hadzic

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Development Setup](#development-setup)
5. [Backend Architecture](#backend-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [Database Systems](#database-systems)
8. [API Reference](#api-reference)
9. [External Services](#external-services)
10. [Code Conventions](#code-conventions)
11. [Environment Configuration](#environment-configuration)
12. [Planned Features](#planned-features)

---

## Project Overview

SmartHub runs on a Raspberry Pi connected to an LCD panel positioned over a nightstand. It helps users get organized in the morning by displaying:

- **Bus/Transit routes** - Real-time journey planning with GTFS data
- **Weather forecasts** - 2-hour interval forecasts via OpenMeteo
- **Clock/Time** - Current time display
- **Calendar events** - Google Calendar integration (planned)
- **KNX device control** - Shutters, LED lights (planned)

### Current Implementation Status

| Feature | Status |
|---------|--------|
| Bus routing (Neo4j) | ✅ Implemented |
| Weather forecasts | ✅ Implemented |
| Places/Geocoding | ✅ Implemented |
| Clock widget | ✅ Implemented |
| Frontend (Nuxt) | 🔄 In progress |
| Google Calendar | 📋 Planned |
| Routines system | 📋 Planned |
| KNX integration | 📋 Planned |
| AI features | 📋 Planned |

---

## Technology Stack

### Frontend
- **Framework**: Nuxt 4 (Vue 3 + TypeScript)
- **State Management**: Pinia
- **Styling**: CSS (component-scoped)

### Backend
- **Runtime**: Node.js 20.19+ or 22.12+
- **Framework**: Express + TypeScript
- **Execution**: tsx (TypeScript execution)

### Databases
- **Neo4j 5**: Graph database for transit routing

### External APIs
- **OpenMeteo**: Weather forecasts (free, no auth)
- **Google Geocoding**: Place name → coordinates
- **Google Calendar**: User calendar data (planned)

### Infrastructure
- **Docker Compose**: Database orchestration
- **GTFS Data**: Austrian transit feeds (LINZ AG, OOEVV)

---

## Project Structure

```
sommerprojekt-wmc-hungry-team/
├── _backend/                    # Express API server
│   ├── src/
│   │   ├── app.ts              # Server entry point
│   │   ├── routers/            # HTTP route handlers
│   │   │   ├── bus-route.ts    # Transit routing endpoints
│   │   │   ├── weather.ts      # Weather endpoints
│   │   │   └── places.ts       # Geocoding endpoints
│   │   ├── repo/               # Data access layer
│   │   │   ├── bus-repo-neo4j.ts # Neo4j routing
│   │   │   ├── neo4j-driver.ts # Neo4j connection pool
│   │   │   ├── weather-repo.ts # OpenMeteo integration
│   │   │   └── places-repo.ts  # Google Geocoding
│   │   └── utils/              # Shared utilities
│   │       ├── validation.ts   # Input validation helpers
│   │       └── http.ts         # HTTP fetch utilities
│   └── package.json
│
├── _frontend/smarthub/          # Nuxt application
│   └── app/
│       ├── app.vue             # Root component
│       ├── pages/              # Route pages
│       │   └── index.vue       # Dashboard page
│       ├── layouts/            # Page layouts
│       │   └── default.vue     # Default layout with header
│       └── components/         # Reusable widgets
│           ├── ClockWidget.vue
│           ├── WeatherWidget.vue
│           ├── BusRouteChart.vue
│           └── ...
│
├── data/                        # GTFS data files
│   └── LINZ_AG_GTFS_2026.zip
│
├── scripts/                     # Utility scripts
│   └── load-gtfs-neo4j.js      # Neo4j data importer
│
├── docs/                        # Documentation
│   ├── topics/                 # Topic-specific docs
│   └── ...
│
├── docker-compose.yaml          # Database services (Neo4j)
├── .env                         # Environment variables
└── .env.example                 # Environment template
```

---

## Development Setup

### Prerequisites
- Node.js 20.19+ or 22.12+
- Docker and Docker Compose
- Google API key (for geocoding)

### Quick Start

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 2. Prepare GTFS dataset for Neo4j loader (required once or when data changes)
unzip -o data/LINZ_AG_GTFS_2026.zip -d data/LINZ_AG_GTFS_2026

# 3. Start Neo4j + load GTFS data
docker compose up -d neo4j
docker compose run --rm neo4j-loader

# 4. Install backend dependencies
cd _backend && npm install

# 5. Start backend (new terminal)
cd _backend && npm run dev

# 6. Start frontend (new terminal)
# (if backend also runs on :3000, set frontend API URL explicitly)
NUXT_PUBLIC_API_BASE_URL=http://localhost:3000 cd _frontend/smarthub && npm run dev
```

By default, frontend API calls use `NUXT_PUBLIC_API_BASE_URL` and fall back to `http://localhost:3000`.
If Nuxt runs on the same port as the backend in your setup, use a different frontend port or set `NUXT_PUBLIC_API_BASE_URL` explicitly.

```bash
cd _frontend/smarthub && npm run dev
```

### Development Commands

**Backend** (`_backend/`):
```bash
npm run dev      # Start with tsx (hot reload)
npm start        # Production mode
```

**Frontend** (`_frontend/smarthub/`):
```bash
npm run dev      # Start Nuxt dev server
npm run build    # Production build
npm run preview  # Preview production build
```

**Docker**:
```bash
docker-compose up              # Start all services
docker-compose up -d           # Start detached
docker-compose logs neo4j      # View Neo4j logs
docker-compose logs neo4j-loader  # View data import logs
```

---

## Backend Architecture

### Layering Pattern

```
HTTP Request
    ↓
Router (routers/*.ts)
    - Input validation
    - HTTP status codes
    - Error handling
    ↓
Repository (repo/*.ts)
    - Business logic
    - Database queries
    - External API calls
    ↓
Response
```

### Router Responsibilities
- Validate all query parameters
- Parse and type-convert inputs
- Call repository functions
- Return appropriate HTTP status codes
- Handle errors gracefully

### Repository Responsibilities
- Execute database queries
- Call external APIs
- Transform data formats
- Throw errors for exceptional cases

### Connection Management

**Neo4j** - Driver with session factory:
```typescript
let driver: Driver | null = null;
export const getNeo4jDriver = () => {
  if (!driver) {
    driver = neo4j.driver(uri, auth, { maxConnectionPoolSize: 50 });
  }
  return driver;
};
export const getNeo4jSession = () => getNeo4jDriver().session({ database: 'neo4j' });
```

### Shared Utilities

Common code is extracted into `src/utils/`:

**validation.ts** - Input validation:
```typescript
import { parseCoordinates, parseCoordinatePair, validateTimeFormat } from '../utils/validation.js';

const coords = parseCoordinates(lat, lon);
if (!coords.valid) return res.status(400).json({ error: coords.error });
```

**http.ts** - HTTP client:
```typescript
import { fetchJson } from '../utils/http.js';

const data = await fetchJson(url, 10000); // 10s timeout
```

---

## Frontend Architecture

### Nuxt Structure

- **`app/pages/`**: File-based routing (each .vue = route)
- **`app/layouts/`**: Shared page layouts
- **`app/components/`**: Auto-imported components

### Component Pattern

All components use Composition API with `<script setup lang="ts">`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const data = ref<SomeType | null>(null)

onMounted(async () => {
  // fetch data
})
</script>

<template>
  <div>{{ data }}</div>
</template>

<style scoped>
/* component styles */
</style>
```

### State Management

Pinia stores for shared state:
```typescript
// stores/weather.ts
export const useWeatherStore = defineStore('weather', {
  state: () => ({
    forecasts: new Map<string, WeatherForecast>()
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

---

## Database Systems

### Neo4j (Transit Routing)

**Purpose**: Graph-based transit routing with native path finding

**Node Types**:
| Node | Properties |
|------|------------|
| Stop | id, name, latitude, longitude |
| Route | id, short_name, long_name, type |
| Trip | id, route_id, service_id, headsign |
| StopTime | trip_id, stop_id, stop_sequence, arrival_time, departure_time |
| Service | id, monday-sunday flags, start_date, end_date |

**Relationships**:
| Relationship | Pattern | Purpose |
|-------------|---------|---------|
| STOPS_AT | Trip → StopTime | Trip visits stop |
| AT_STOP | StopTime → Stop | Stop time at physical stop |
| NEXT_STOP | StopTime → StopTime | Consecutive stops on trip |
| ON_ROUTE | Trip → Route | Trip belongs to route |
| ON_SERVICE | Trip → Service | Trip runs on service |

**Key Implementation Notes**:
- GTFS times stored as strings (not Neo4j time type) to handle 24+ hour times
- Stop matching uses name, not ID (handles multiple platforms at same station)
- Batch processing in loader (50 trips/batch) to avoid memory issues

---

## API Reference

### Bus Routing

**GET /api/bus/test**

Health check for Neo4j connection.

Response:
```json
{
  "status": "ok",
  "backend": "neo4j",
  "neo4j": "up",
  "timestamp": "2026-04-07T12:00:00.000Z"
}
```

**GET /api/bus/route**

Find transit routes between two points.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lat_a | number | Yes | Start latitude (-90 to 90) |
| lon_a | number | Yes | Start longitude (-180 to 180) |
| lat_b | number | Yes | End latitude |
| lon_b | number | Yes | End longitude |
| departure_time | string | Yes | HH:MM:SS format |
| max_transfers | number | Yes | 0-5 transfers allowed |

Response:
```json
[
  {
    "legs": [
      {
        "board_stop_id": "at:44:40002:0:0",
        "board_stop_name": "Linz/Donau Saporoshjestraße",
        "alight_stop_id": "at:44:41126:0:0",
        "alight_stop_name": "Linz/Donau Ebelsberg",
        "departure_time": "10:50:00",
        "arrival_time": "10:51:00",
        "route_short_name": "19",
        "route_long_name": "Linz Fernheizkraftwerk - Linz Pichlinger See",
        "route_type": 3
      }
    ],
    "total_duration_minutes": 1,
    "departure_time": "08:30:00",
    "arrival_time": "08:45:00",
    "num_transfers": 0
  }
]
```

Headers: `X-Route-Backend: neo4j`

### Weather

**GET /api/weather/forecast**

Get weather forecast for location.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lat | number | Yes | Latitude (-90 to 90) |
| lon | number | Yes | Longitude (-180 to 180) |

Response:
```json
{
  "location": { "latitude": 48.3069, "longitude": 14.2858 },
  "timezone": "Europe/Vienna",
  "forecasts": [
    {
      "time": "2026-04-07T10:00:00",
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
  ]
}
```

**Notes**:
- Returns 2-hour intervals from now until midnight (Vienna time)
- Timezone is always `Europe/Vienna` (hardcoded)

### Places/Geocoding

**GET /api/places/geocode**

Convert place name to coordinates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| place | string | Yes | Place name or address |

Response:
```json
{
  "place": "Linz, Austria",
  "coordinates": { "lat": 48.3069, "lon": 14.2858 },
  "formattedAddress": "Linz, Upper Austria, Austria"
}
```

**Notes**:
- Biased to Austria (`region=at`)
- Shared by both weather and bus routing widgets

---

## External Services

### OpenMeteo (Weather)

- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Auth**: None required (free tier)
- **Rate limit**: 10,000 requests/day
- **Timeout**: 10 seconds

**Parameters used**:
```
latitude, longitude
hourly: temperature_2m, apparent_temperature, relative_humidity_2m,
        precipitation, precipitation_probability, weather_code,
        cloud_cover, wind_speed_10m, wind_direction_10m, wind_gusts_10m,
        visibility, is_day
timezone: Europe/Vienna
forecast_days: 1
```

### Google Geocoding

- **Endpoint**: `https://maps.googleapis.com/maps/api/geocode/json`
- **Auth**: `GOOGLE_KEY` environment variable
- **Rate limit**: 40,000 requests/month (free tier)
- **Timeout**: 5 seconds

**Parameters used**:
```
address: <place name>
key: <API key>
region: at
```

### GTFS Data Sources

- **LINZ AG**: Linz city transit
- **OOEVV**: Upper Austria regional transit
- **Source**: https://data.mobilitaetsverbuende.at/de/data-sets
- **Format**: Standard GTFS (ZIP files in `data/` directory)

---

## Code Conventions

### File Naming
- **TypeScript files**: kebab-case (`bus-route.ts`, `weather-repo.ts`)
- **Vue components**: kebab-case files, PascalCase in code (`ClockWidget.vue`)

### Code Style
- **Functions/Variables**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE

### Import Extensions
TypeScript files use `.js` extension in imports (tsx requirement):
```typescript
import { fetchWeatherForecast } from '../repo/weather-repo.js';
```

### Error Handling

Routers catch errors and return appropriate status codes:
```typescript
try {
  const result = await repoFunction(params);
  res.json(result);
} catch (e: any) {
  if (e.message?.includes('not found')) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (e.message?.includes('unavailable')) {
    return res.status(503).json({ error: 'Service unavailable' });
  }
  res.status(500).json({ error: 'Internal server error' });
}
```

### HTTP Client

Use shared utility from `src/utils/http.ts`:
```typescript
import { fetchJson } from '../utils/http.js';

const data = await fetchJson(url, 10000); // timeout in ms
```

---

## Environment Configuration

Create `.env` in project root:

```env
# Neo4j (Graph routing)
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_secure_password
NEO4J_HOST=localhost
NEO4J_BOLT_PORT=7687
NEO4J_HTTP_PORT=7474

# Google APIs
GOOGLE_KEY=your_google_api_key
```

Backend loads from `../.env` (parent of `_backend/`).

---

## Planned Features

### Routines System
Time-based configuration for dashboard widgets:
- Users configure what displays at specific times
- Morning routine: weather, bus routes, calendar
- Evening routine: different widget set
- Customizable per user

### Google Calendar Integration
- OAuth2 authentication
- Display today's events
- Calendar-based routine triggers

### KNX Integration
- Control shutters and LED lights
- Scene activation from dashboard
- Integration with routines

### AI Features
- Intelligent recommendations
- Natural language queries
- Automation suggestions

---

## Additional Documentation

Detailed topic documentation in `docs/topics/`:
- `bus.md` - Bus routing implementation
- `weather.md` - Weather API documentation
- `neo4j-routing.md` - Neo4j graph model and algorithms
- `neo4j-migration-plan.md` - PostgreSQL to Neo4j migration
- `docker.md` - Docker configuration
- `dataset.md` - GTFS data format
- `google.md` - Google API architecture

Testing guides in `docs/`:
- `testing-neo4j-migration.md` - Neo4j validation test plan
- `NEO4J_IMPLEMENTATION_SUMMARY.md` - Migration status
