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

### Session 2026-03-25: Neo4j Route Finding Migration

**Objective**: Replace PostgreSQL routing with Neo4j graph database for better performance and correctness.

**Issues with PostgreSQL Implementation**:
- Only supports 2 transfer levels despite claiming 5
- Incorrect JOIN logic missing valid transfer scenarios
- No actual stop connectivity validation
- Fragile calendar handling (string comparison on day names)
- Performance degrades exponentially with transfers
- Doesn't find shortest/best paths reliably

**Solution: Neo4j Graph Database**:
- Native shortest-path algorithms (Dijkstra, A*)
- Explicit modeling of transit network as graph
- Path finding is O(hops) not O(data size)
- Support unlimited transfers with consistent performance
- Simpler, more maintainable code

**Implementation Approach**:
- Parallel setup: Both databases running for testing
- Neo4j as primary, PostgreSQL as fallback
- Automatic fallback if Neo4j fails
- `?use_postgres=true` query param for explicit testing
- Response header `X-Route-Backend` shows which backend was used

**Files Created**:
- `docker-compose.yaml` - Added Neo4j service + loader
- `scripts/load-gtfs-neo4j.js` - GTFS data import script
- `_backend/src/repo/neo4j-driver.ts` - Connection pooling
- `_backend/src/repo/bus-repo-neo4j.ts` - Routing algorithms
- `_backend/package.json` - Added neo4j dependency
- `docs/topics/neo4j-routing.md` - Complete implementation guide

**Testing Results** (to be completed):
- [ ] Route quality comparison (Neo4j vs PostgreSQL)
- [ ] Performance benchmarking (target: 100-500ms vs 2-5s)
- [ ] Multi-transfer path finding (up to 5 transfers)
- [ ] Error handling and fallback mechanisms

**Status**:
- ✅ Docker setup with both databases
- ✅ Neo4j GTFS data loader created
- ✅ Routing algorithm implemented
- ✅ Backend integration with fallback
- ⏳ Pending: Testing and validation (Week 1)
- ⏳ Pending: PostgreSQL removal (Week 2+)

**Next Steps**:
1. Start Docker containers
2. Verify GTFS data loads into Neo4j
3. Run comparison tests (Neo4j vs PostgreSQL)
4. Benchmark performance improvements
5. Fix any bugs found during testing
6. Document test results
7. Schedule PostgreSQL removal after successful validation
