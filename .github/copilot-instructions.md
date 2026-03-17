# SmartHub - Copilot Instructions

SmartHub is a Raspberry Pi dashboard web application that displays real-time transit information, weather, clock, and integrates with KNX IoT devices. It supports multi-user access via Google accounts and features configurable time-based "Routines" to display different information widgets.

**Project Status**: Bus routing and weather service implemented. Google Calendar integration, routines configuration, and KNX/AI features are planned.

## Recent Changes (2026-03-17)

**Weather Service Implementation**: Complete backend API for weather forecasts and geocoding.
- Added OpenMeteo API integration for 2-hour interval weather forecasts
- Added Google Geocoding API for place name → coordinates conversion
- Vienna timezone hardcoded (`Europe/Vienna`) for all weather requests
- Weather endpoint filters forecasts from now until midnight (current day)
- Places endpoint shared by both weather and bus routing widgets
- Frontend Pinia store created; widget implementation deferred for Nuxt migration
- See `docs/topics/weather.md` for complete API documentation

## Technology Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Pinia + Vue Router (migrating to Nuxt planned)
- **Backend**: Express + TypeScript (via tsx)
- **Databases**: 
  - PostgreSQL with PostGIS (GTFS transit data)
- **Data Sources**: 
  - GTFS feeds (2026) from Austrian transit (LINZ AG, OOEVV)
  - OpenMeteo API (weather forecasts - implemented)
  - Google Geocoding API (place → coordinates - implemented)
  - Google Calendar API (planned: user calendars)

## Development Commands

### Frontend (`_frontend/smarthub/`)

```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check + production build (vue-tsc + vite)
npm run type-check   # Run Vue TypeScript checking only
npm run preview      # Preview production build
```

### Backend (`_backend/`)

```bash
npm run dev          # Start with tsx (src/app.ts)
npm start            # Production mode (node dist/app.js)
```

### Database & Docker

```bash
docker-compose up    # Start PostgreSQL+PostGIS with GTFS loader
```

The loader service automatically imports GTFS data from `data/` directory on first run.

### Typical Development Workflow

```bash
# Terminal 1: Database
docker-compose up

# Terminal 2: Backend API
cd _backend && npm run dev

# Terminal 3: Frontend
cd _frontend/smarthub && npm run dev
```

## Architecture

### Backend Structure

```
_backend/
├── src/
│   ├── app.ts              # Express server entry point
│   ├── routers/            # Route handlers (HTTP layer)
│   │   ├── bus-route.ts    # Bus API endpoints
│   │   ├── weather.ts      # Weather API endpoints
│   │   └── places.ts       # Geocoding API endpoints
│   └── repo/               # Data access layer
│       ├── bus-repo.ts     # PostgreSQL/PostGIS queries
│       ├── weather-repo.ts # OpenMeteo API integration
│       └── places-repo.ts  # Google Geocoding API
```

**Layering Pattern**: Routers handle HTTP → Repo handles data fetching/queries

- **app.ts**: Server initialization, middleware registration, route mounting
- **routers/**: Express route handlers with input validation
- **repo/**: Data fetching logic (database queries, external APIs)

### Frontend Structure

```
_frontend/smarthub/src/
├── main.ts                 # Vue app entry (Pinia + Router setup)
├── App.vue                 # Root component
├── router/index.ts         # Route definitions
├── views/Dashboard.vue     # Main dashboard view
└── components/             # Reusable widgets
    ├── ClockWidget.vue
    ├── WeatherWidget.vue
    ├── BusRouteChart.vue
    ├── MapView.vue
    ├── RoutePanel.vue
    ├── InfoPanel.vue
    ├── SettingsModal.vue
    └── RoutineConfigModal.vue
```

All components use **Composition API** with `<script setup lang="ts">`.

### Database Schema

**PostgreSQL (GTFS transit data)** - Uses standard GTFS schema with PostGIS extensions:

- Core tables: `stops`, `routes`, `trips`, `stop_times`, `calendar`, `agency`
- Geospatial: `stops.stop_loc` (PostGIS POINT for distance calculations)
- SRID 4326 (WGS84) for coordinate system

**SQLite (cancelled)** - ~~Will store OpenMeteo weather forecast data locally~~ No longer needed; weather fetched fresh at routine start and cached temporarily in frontend.

## Key Conventions

### Naming

- **Files**: kebab-case (`bus-route.ts`, `clock-widget.vue`, `weather-repo.ts`)
- **Components**: PascalCase in code, kebab-case filenames (`ClockWidget.vue`)
- **Functions/Variables**: camelCase

### External API Integration

**OpenMeteo (Weather):**
- No authentication required (free tier: 10k requests/day)
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Always use Vienna timezone: `timezone=Europe/Vienna` (hardcoded constant)
- 2-hour interval filtering: Take every other hour from hourly data
- Day boundary: Filter forecasts to only include times until 23:59 Vienna time

**Google Geocoding (Places):**
- Requires `GOOGLE_KEY` from environment
- Endpoint: `https://maps.googleapis.com/maps/api/geocode/json`
- Austria-biased: Always include `region=at` parameter
- Rate limit: 40k requests/month free tier
- Returns `lng` but convert to `lon` for consistency

**HTTP Client:**
- Use Node.js built-in `https` module wrapped in Promise
- No external dependencies (axios/fetch) for Raspberry Pi performance
- Standard timeout: 10 seconds for weather, 5 seconds for geocoding

### API Endpoints

Base paths:
- `/api/bus/` - Transit routing
- `/api/weather/` - Weather forecasts
- `/api/places/` - Geocoding service

**Bus Routes:**
- `GET /api/bus/test` - Database health check
- `GET /api/bus/route` - Multi-leg journey planning
  - Query params: `lat_a`, `lon_a`, `lat_b`, `lon_b`, `departure_time`, `max_transfers`
  - Returns up to 5 route options sorted by number of legs, then duration
  - Supports 0-5 transfers with 3-minute minimum connection time

**Weather Forecast:**
- `GET /api/weather/forecast` - Weather data for location
  - Query params: `lat`, `lon`
  - Returns 2-hour interval forecasts from now until midnight (Vienna time)
  - Includes temperature, feels-like, wind, precipitation, weather codes, conditions
  - Uses OpenMeteo API (no auth required)

**Places Geocoding (Shared Service):**
- `GET /api/places/geocode` - Convert place name to coordinates
  - Query params: `place` (place name or address)
  - Returns coordinates and formatted address
  - Uses Google Geocoding API (biased to Austria: `region=at`)
  - Shared by both weather and bus routing widgets

### Database Patterns

**Complex queries use CTEs** for multi-step logic:

```sql
WITH closest_start AS (...),
     closest_end AS (...),
     direct_routes AS (...),
     one_transfer_routes AS (...)
SELECT ...
```

**PostGIS distance operator** for nearest-neighbor searches:

```sql
ORDER BY stop_loc <-> ST_SetSRID(ST_MakePoint(lon, lat), 4326)
```

**Query requirements**:
- Always set statement timeout (10 seconds per query)
- Use parameterized queries ($1, $2, etc.) for user input
- Validate coordinates: latitude ±90, longitude ±180
- Time format: HH:MM:SS (24-hour)

### Database Connection

Single connection pool pattern:

```typescript
// In repo/bus-repo.ts
const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({ /* config */ });
  }
  return pool;
};
```

Pool is lazily initialized and reused across requests.

### Service Day Calculation

GTFS calendar uses boolean columns for each day:

```sql
WHERE (
  (EXTRACT(DOW FROM service_date) = 0 AND c.sunday = 1) OR
  (EXTRACT(DOW FROM service_date) = 1 AND c.monday = 1) OR
  -- ... etc
)
```

Map JavaScript day-of-week to calendar table flags.

## Environment Configuration

Required variables in `.env` (project root):

```env
# Database (PostgreSQL + PostGIS)
DB_USER=transit_admin
DB_PASSWORD=admin
DB_NAME=gtfs_data
DB_HOST=localhost
DB_PORT=5432

# Google APIs (Geocoding for places)
GOOGLE_KEY=<your-api-key>
```

Backend loads from `../.env` (parent directory of `_backend/`).

**Note**: OpenMeteo API requires no authentication.

## Node Version Requirements

Frontend requires Node 20.19.0 or ≥22.12.0 (from `package.json` engines field).

## Planned Features

### Multi-User Authentication
- Google OAuth2 authentication for user login
- Access to user's Google Calendar data
- Multiple users can configure their own dashboard preferences

### Weather Integration
- Fetch forecast data from OpenMeteo API
- Store locally in SQLite database
- Display weather forecasts at configurable locations

### Routines System
- Time-based configuration system
- Users configure what information displays at specific times
- Customizable widgets: weather forecasts, bus routes, driving routes, calendar events, etc.
- Default interface shows time, weather, and other base information

### Future Integrations
- **KNX Assistant**: Control shutters and LED lights
- **AI Integration**: Planned for intelligent recommendations/automation

## Integration Points

### Implemented
- **GTFS Data**: Austrian transit (LINZ AG, OOEVV) in `data/` directory as ZIP files
  - License info: https://gemini.google.com/share/091dd2894547
  - Dataset source: https://data.mobilitaetsverbuende.at/de/data-sets
  - GTFS format: https://gemini.google.com/share/f321ec23f926
- **OpenMeteo API**: Weather forecast data (free, no auth required)
- **Google Geocoding API**: Place name to coordinates conversion
  - Shared by both weather and bus routing widgets

### Planned
- **Google Calendar API**: OAuth2 authentication and calendar access (https://gemini.google.com/share/4cd4e5188999)
- **KNX Protocol**: Smart home device control
- **AI Services**: To be determined

## Development Session Notes

### Session 2026-03-17: Weather Service Implementation

**Objective**: Implement weather forecast and geocoding services for the SmartHub dashboard.

**Key Decisions Made**:
1. **No SQLite**: Cancelled plan to cache weather in SQLite. Weather fetched fresh at routine start and cached temporarily in frontend.
2. **Coordinate-only endpoints**: Weather endpoint accepts only lat/lon (not place names). Separate geocoding endpoint for place → coordinates conversion.
3. **Vienna timezone**: Hardcoded `Europe/Vienna` timezone constant for all weather requests (acceptable since project focuses on Austrian transit).
4. **2-hour intervals**: Weather shows every 2 hours from now until midnight (rest of current day in Vienna time).
5. **Shared geocoding**: Single `/api/places/geocode` endpoint used by both weather and bus routing widgets.
6. **No external HTTP library**: Used Node.js built-in `https` module for Raspberry Pi performance (no axios/fetch dependency).

**Implementation Approach**:
- Followed existing router → repo layering pattern from bus routing
- Created comprehensive API documentation in `docs/topics/weather.md`
- Created detailed implementation thought process in `.github/weather-endpoint-implementation.md`
- Used SQL todo tracking with dependencies for phased implementation
- Tested all endpoints with curl (valid inputs, invalid inputs, error cases)

**Files Created**:
- Backend: `weather-repo.ts`, `places-repo.ts`, `weather.ts` (router), `places.ts` (router)
- Frontend: `stores/weather.ts` (Pinia store)
- Documentation: `docs/topics/weather.md`, `.github/weather-endpoint-implementation.md`

**Testing Results**:
- ✅ OpenMeteo API integration working (2-hour intervals, day boundary filtering)
- ✅ Google Geocoding API working (place names → coordinates)
- ✅ Error handling validated (400, 404, 500, 503 status codes)
- ✅ Integration flow verified (places → weather)
- ✅ Weather codes mapped correctly to descriptions
- ✅ Condition flags calculate properly (snow, rain, ice, sunny, cloudy)

**Deferred**:
- Frontend WeatherWidget.vue implementation (waiting for Nuxt migration)
- Widget will use existing Pinia store for data fetching and display

**Lessons Learned**:
- Clarifying requirements upfront (timezone handling, SQLite decision) saved implementation time
- Documenting thought process helps future developers understand design choices
- Following existing patterns (router/repo structure) maintains codebase consistency
- Using built-in Node.js modules reduces dependencies for embedded systems
