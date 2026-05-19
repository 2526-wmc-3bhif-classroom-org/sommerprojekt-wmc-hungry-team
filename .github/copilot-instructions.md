# SmartHub - Project Instructions

SmartHub is a Raspberry Pi dashboard web app that shows live transit routes, weather, and a clock on an LCD panel. It is built as a Nuxt frontend with an Express API backend, Neo4j for routing, and SQLite for users/sessions/routines.

**Team**: Arthur Dirnberger, Matthias Darabosch, Benjamin Stoica, Almir Hadzic

---

## Current Status (2026-05)

### Backend
- Express + TypeScript API (run via `tsx`)
- Neo4j-based bus routing (no PostgreSQL fallback)
- SQLite for users, sessions, routines
- Local auth with server-side sessions
- Weather forecast via OpenMeteo
- Geocoding via Google Maps API
- Optional Google Calendar connect (OAuth)

### Frontend
- Nuxt 4 app with:
  - Login page (`/login`) and auth guard middleware
  - Dashboard (`/dashboard`) with widgets:
    - Clock
    - Weather
    - Bus route
    - Backend status (labeled “appointments” widget)
  - Routine settings page (`/routine-settings`) with Google connect + logout

---

## Technology Stack

### Frontend
- **Nuxt 4** + Vue 3 + TypeScript
- **@nuxt/ui** and Tailwind (via `@tailwindcss/vite`)
- Styling is currently component-scoped CSS

### Backend
- **Node.js 20+**
- **Express** + TypeScript
- **tsx** for dev execution

### Database
- **Neo4j 5 Community**
- **SQLite** (users, sessions, routines)

### External APIs
- **OpenMeteo** (no auth)
- **Google Geocoding** (`GOOGLE_KEY` required)
- **Google OAuth** (calendar connect)

---

## Project Structure

```
sommerprojekt-wmc-hungry-team/
├── _backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── db/              # SQLite connection + migrations
│   │   ├── middleware/      # auth middleware
│   │   ├── routers/         # bus-route, weather, places, auth, routines
│   │   ├── repo/            # Neo4j + API integrations + SQLite repos
│   │   └── utils/           # validation + HTTP helpers
│   └── package.json
├── _frontend/smarthub/
│   ├── app/
│   │   ├── pages/           # index, dashboard, routine-settings
│   │   ├── layouts/         # default, landing
│   │   ├── components/      # clock, weather, bus, appointments
│   │   ├── composables/     # use-smarthub-api
│   │   └── types/           # API typing helpers
│   └── package.json
├── data/                    # GTFS data ZIP + extracted folder
├── scripts/                 # load-gtfs-neo4j.js
├── docker-compose.yaml
└── .env.example
```

---

## Development Setup

### Environment
```bash
cp .env.example .env
# Fill in NEO4J_*, GOOGLE_KEY, DB_PATH, auth + OAuth envs
```

### Docker (Prod)
```bash
unzip -o data/LINZ_AG_GTFS_2026.zip -d data/LINZ_AG_GTFS_2026
docker compose up -d neo4j
docker compose --profile tools run --rm neo4j-loader
docker compose up -d
```

### Docker (Dev)
```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up
```

### GTFS Import (Neo4j)
The loader expects extracted GTFS files in `data/LINZ_AG_GTFS_2026/`.

```bash
unzip -o data/LINZ_AG_GTFS_2026.zip -d data/LINZ_AG_GTFS_2026
docker compose up -d neo4j
docker compose --profile tools run --rm neo4j-loader
```

### Backend
```bash
cd _backend
npm install
npm run dev
```

### Frontend
```bash
cd _frontend/smarthub
npm install
NUXT_PUBLIC_API_BASE_URL=http://localhost:3000 npm run dev
```

---

## API Reference (Current)

### Bus Routing

**GET /api/bus/test**  
Returns backend status and Neo4j availability.

**GET /api/bus/route**  
Required query params:
- `lat_a`, `lon_a`, `lat_b`, `lon_b`
- `departure_time` (HH:MM:SS)
- `max_transfers` (0–5)

Notes:
- Uses Neo4j only.
- Current routing implementation supports 0–2 transfers; 3+ returns no routes.
- Response is a list of up to 5 best routes.

### Weather

**GET /api/weather/forecast**  
Query: `lat`, `lon`  
Returns 2-hour interval forecasts from now until end of day (Europe/Vienna).

### Places

**GET /api/places/geocode**  
Query: `place`  
Returns coordinates + formatted address using Google Geocoding.

### Auth

**POST /api/auth/register**  
Body: `name`, `email`, `password`

**POST /api/auth/login**  
Body: `email`, `password`

**POST /api/auth/logout**  
Clears the session cookie.

**GET /api/auth/me**  
Returns current user + Google connect status.

### Routines

**GET /api/routines**  
List routines for the logged-in user.

**POST /api/routines**  
Body: `name`, `start_time`/`startTime`, `end_time`/`endTime`, `days`, `config`

**PUT /api/routines/:id**  
Update a routine.

**DELETE /api/routines/:id**  
Delete a routine.

---

## Frontend Notes

- API calls go through `app/composables/use-smarthub-api.ts`.
- `NUXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:3000` (see `nuxt.config.ts`).
- Widgets use hardcoded demo places for now.

---

## Code Conventions

- **TypeScript imports in backend include `.js` extensions** (tsx ESM requirement).
- **kebab-case** file names for TS files and Vue component files.
- Vue components are referenced in kebab-case (e.g., `<clock-widget />`).
- Routers validate inputs and return HTTP errors; repositories handle API/DB logic.

---

## Additional Docs

See `docs/` and `docs/topics/` for detailed backend and Neo4j implementation notes.
