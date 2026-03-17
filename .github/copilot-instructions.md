# SmartHub - Copilot Instructions

SmartHub is a Raspberry Pi dashboard web application that displays real-time transit information, weather, clock, and integrates with KNX IoT devices. It supports multi-user access via Google accounts and features configurable time-based "Routines" to display different information widgets.

**Project Status**: Bus routing with GTFS data is implemented. Google Calendar integration, weather forecasting, routines configuration, and KNX/AI features are planned.

## Technology Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Pinia + Vue Router
- **Backend**: Express + TypeScript (via tsx)
- **Databases**: 
  - PostgreSQL with PostGIS (GTFS transit data)
  - SQLite (planned: OpenMeteo weather forecasts)
- **Data Sources**: 
  - GTFS feeds (2026) from Austrian transit (LINZ AG, OOEVV)
  - OpenMeteo API (planned: weather forecasts)
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
│   │   └── bus-route.ts    # Bus API endpoints
│   └── repo/               # Data access layer
│       └── bus-repo.ts     # PostgreSQL/PostGIS queries
```

**Layering Pattern**: Routers handle HTTP → Repo handles database queries

- **app.ts**: Server initialization, middleware registration, route mounting
- **routers/**: Express route handlers with input validation
- **repo/**: Database query logic using PostgreSQL client pool

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

**SQLite (planned)** - Will store OpenMeteo weather forecast data locally

## Key Conventions

### Naming

- **Files**: kebab-case (`bus-route.ts`, `clock-widget.vue`)
- **Components**: PascalCase in code, kebab-case filenames (`ClockWidget.vue`)
- **Functions/Variables**: camelCase

### API Endpoints

Base path: `/api/bus/`

- `GET /api/bus/test` - Database health check
- `GET /api/bus/route` - Multi-leg journey planning
  - Query params: `lat_a`, `lon_a`, `lat_b`, `lon_b`, `departure_time`, `max_transfers`
  - Returns up to 5 route options sorted by number of legs, then duration
  - Supports 0-5 transfers with 3-minute minimum connection time

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
DB_USER=transit_admin
DB_PASSWORD=admin
DB_NAME=gtfs_data
DB_HOST=localhost
DB_PORT=5432
GOOGLE_KEY=<your-api-key>
```

Backend loads from `../.env` (parent directory of `_backend/`).

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

### Planned
- **Google Calendar API**: OAuth2 authentication and calendar access (https://gemini.google.com/share/4cd4e5188999)
- **OpenMeteo API**: Weather forecast data
- **KNX Protocol**: Smart home device control
- **AI Services**: To be determined
