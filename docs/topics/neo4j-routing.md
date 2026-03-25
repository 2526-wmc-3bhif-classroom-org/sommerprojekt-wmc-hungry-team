# Neo4j Routing Implementation - Backend Documentation

## Overview

SmartHub now uses **Neo4j** as the primary database for GTFS route finding. This is a graph database designed specifically for finding optimal paths through transit networks. PostgreSQL runs in parallel for testing and comparison during the migration period.

## Architecture

### Dual Database Setup

**Neo4j (Primary - Graph Database)**
- Real-time shortest path finding
- Relationship-based transit network modeling
- Native support for multi-leg transfers
- Expected response time: 100-500ms per query

**PostgreSQL (Fallback - Relational Database)**
- Legacy system for comparison
- Automatic fallback if Neo4j fails
- Can be explicitly requested via query parameter

### Data Flow

```
User Request
    ↓
Router (/api/bus/route)
    ↓
    ├─→ Try Neo4j routing engine
    │   ├─→ Find closest start/end stops (spatial indexing)
    │   ├─→ Search graph for optimal paths (Cypher query)
    │   ├─→ Return sorted results (transfers → duration → time)
    │   └─→ Success: Return Neo4j results
    │
    └─→ If Neo4j fails or `?use_postgres=true`:
        └─→ Fall back to PostgreSQL routing
            └─→ Return PostgreSQL results
```

## Neo4j Graph Model

### Nodes

| Node Type | Properties | Purpose |
|-----------|-----------|---------|
| **Stop** | id, name, latitude, longitude, code, desc | Transit stops/stations |
| **Route** | id, short_name, long_name, type, desc, url | Bus/tram/train routes |
| **Trip** | id, route_id, service_id, headsign, direction | Scheduled service trips |
| **StopTime** | trip_id, stop_id, stop_sequence, arrival_time, departure_time | Stop visit records |
| **Service** | id, monday...sunday, start_date, end_date | Service calendars |

### Relationships

| Relationship | Source → Target | Properties | Purpose |
|-------------|-----------------|-----------|---------|
| STOPS_AT | Trip → StopTime | — | Trip visits stop at specific time |
| AT_STOP | StopTime → Stop | — | Stop time node points to physical stop |
| NEXT_STOP | StopTime → StopTime | arrival_time, departure_time | Consecutive stops on same trip |
| ON_ROUTE | Trip → Route | — | Trip runs on specific route |
| ON_SERVICE | Trip → Service | — | Trip runs on specific service |
| TRANSFER | Stop → Stop | min_time, from_trip, to_trip | Transfer opportunity between stops |

### Example Graph Path

```
Start Stop (Linz Hbf)
  ↓ [AT_STOP from]
StopTime (Trip 28A, 08:30 departure)
  ↓ [NEXT_STOP]
StopTime (Trip 28A, 08:45 arrival)
  ↓ [TRANSFER - 5 min wait]
StopTime (Trip 30, 08:55 departure)
  ↓ [NEXT_STOP]
StopTime (Trip 30, 09:15 arrival)
  ↓ [AT_STOP to]
End Stop (Final Stop)
```

## Routing Algorithm

### Query Strategy

The Neo4j routing query finds optimal paths by:

1. **Locating Stops**: Find nearest stops to input coordinates using spatial distance
2. **Finding Departures**: Match trips departing after requested time from start stop
3. **Path Discovery**: Use Cypher recursive queries to explore paths up to `maxLegs`
4. **Transfer Matching**: Find connections with minimum 3-minute wait at transfer stops
5. **Sorting**: Return top 5 routes sorted by:
   - Number of transfers (ascending)
   - Total duration (ascending)
   - Departure time (ascending)

### Example Cypher Query

```cypher
MATCH (startStop:Stop {id: 'linz_hauptbahnhof'})
MATCH (endStop:Stop {id: 'final_stop'})

// Find trips departing after 08:30
MATCH (startStop)<-[:AT_STOP]-(st1:StopTime)
WHERE time(st1.departure_time) >= time('08:30:00')

// Find reachable end stop with transfers
MATCH (st1)-[:NEXT_STOP*0..100]->(st_end:StopTime)-[:AT_STOP]->(endStop)

// Enrich with route info
MATCH (trip:Trip)-[:STOPS_AT]->(st1)
MATCH (trip)-[:ON_ROUTE]->(route:Route)

RETURN {
  legs: 1,
  departure: st1.departure_time,
  arrival: st_end.arrival_time,
  route: route.short_name
}
ORDER BY legs ASC, duration ASC
LIMIT 5
```

## API Usage

### Find Routes Endpoint

**Request:**
```
GET /api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2
```

**Parameters:**
- `lat_a`, `lon_a`: Start coordinates (degrees)
- `lat_b`, `lon_b`: End coordinates (degrees)
- `departure_time`: Earliest departure (HH:MM:SS format)
- `max_transfers`: Maximum allowed transfers (0-5)
- `use_postgres` (optional): Set to `true` to force PostgreSQL backend

**Response Header:**
```
X-Route-Backend: neo4j  (or "postgresql")
```

**Response:**
```json
[
  {
    "legs": 1,
    "duration_minutes": 15,
    "departure_time": "08:30:00",
    "arrival_time": "08:45:00",
    "boarded_at_stop_id": "...",
    "boarded_at_stop_name": "Linz Hbf",
    "alight_at_stop_id": "...",
    "alight_at_stop_name": "Final Stop",
    "route_short_name": "28",
    "route_long_name": "Line 28",
    "route_type": 3
  }
]
```

### Test Connection Endpoint

**Request:**
```
GET /api/bus/test
```

**Response:**
```json
{
  "status": "ok",
  "backends": {
    "neo4j": "up",
    "postgresql": "up"
  },
  "timestamp": "2026-03-25T10:30:00.000Z"
}
```

## Docker Setup

### Starting Services

```bash
docker-compose up
```

This starts:
- **PostgreSQL** (port 5432): Legacy GTFS database
- **Neo4j** (port 7687 Bolt, 7474 HTTP): Graph routing database
- **postgres loader**: Automatically loads GTFS data into PostgreSQL
- **neo4j-loader**: Automatically loads GTFS data into Neo4j

### Neo4j Web Console

Access at: `http://localhost:7474`
- Default user: `neo4j`
- Default password: see `.env` NEO4J_PASSWORD

### Monitoring

```bash
# Check Neo4j status
curl -i http://localhost:7474/db/neo4j/

# Check PostgreSQL status
psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1"

# View Docker logs
docker-compose logs -f neo4j      # Neo4j logs
docker-compose logs -f neo4j-loader  # Data import logs
```

## Environment Variables

Add to `.env`:

```env
# Neo4j Configuration
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_secure_password_here
NEO4J_HOST=neo4j
NEO4J_BOLT_PORT=7687
NEO4J_HTTP_PORT=7474
NEO4J_PROTOCOL=bolt

# Existing PostgreSQL variables
DB_USER=transit_admin
DB_PASSWORD=admin
DB_NAME=gtfs_data
DB_HOST=localhost
DB_PORT=5432
```

## Backend Configuration

### Dependencies

The backend now requires:
- `neo4j@^5.17.0` - Neo4j driver for Node.js
- `pg@^8.12.0` - PostgreSQL driver (still for fallback)
- `express@^4.18.2` - Web framework

### Driver Initialization

```typescript
// src/repo/neo4j-driver.ts
import neo4j from 'neo4j';

export const getNeo4jDriver = () => {
  // Lazy initialization with connection pooling (50 connections max)
  // Reads from environment variables
};

export const getNeo4jSession = () => {
  // Returns session connected to 'neo4j' database
};
```

## Testing Strategy

### Comparison Testing (Week 1)

Run both backends in parallel:

1. **Route Quality Comparison**
   - Query same route with `?use_postgres=true` and without
   - Compare results: number of transfers, duration, departure times
   - Verify Neo4j results are equal or better

2. **Performance Comparison**
   - Measure response times with `curl -w "%{time_total}"`
   - Target: Neo4j 100-500ms vs PostgreSQL 2-5 seconds
   - Sample 20+ queries across different times/routes

3. **Error Handling**
   - Test Neo4j failure scenarios
   - Verify fallback to PostgreSQL works
   - Test with invalid inputs

### Validation Queries

```bash
# Test Neo4j (primary)
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2" -i

# Test PostgreSQL (fallback)
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2&use_postgres=true" -i

# Compare response headers
# Both should return X-Route-Backend header showing which was used
```

## Performance Expectations

| Metric | PostgreSQL | Neo4j | Improvement |
|--------|-----------|-------|-------------|
| Query Time | 2-5s | 100-500ms | 4-50x faster |
| Max Transfers | 1 (limited) | 5+ (unlimited) | ✓ Fixed |
| Correctness | Partial | Complete | ✓ Fixed |
| Complexity | 207 lines SQL | 50 lines Cypher | ✓ Simpler |

## Troubleshooting

### Neo4j Connection Failed

```
Error: Could not connect to Neo4j at bolt://neo4j:7687
```

**Solution:**
- Check Docker container: `docker ps | grep neo4j`
- Check logs: `docker-compose logs neo4j`
- Verify port: `telnet localhost 7687`
- Verify credentials in `.env`

### GTFS Data Not Loaded

```
MATCH (s:Stop) RETURN count(s)
// Returns 0
```

**Solution:**
- Check loader logs: `docker-compose logs neo4j-loader`
- Verify GTFS files exist in `data/` directory
- Check Neo4j data directory: `docker exec gtfs_neo4j ls /var/lib/neo4j/data`

### Query Returns Empty Results

1. Verify stops exist near coordinates:
   ```cypher
   MATCH (s:Stop)
   WITH s, point({latitude: s.latitude, longitude: s.longitude}) as stop_point
   RETURN s.name, distance(stop_point, point({latitude: 48.30, longitude: 14.28}))
   ORDER BY distance LIMIT 5
   ```

2. Verify trips exist for departure time:
   ```cypher
   MATCH (st:StopTime)-[:AT_STOP]->(s:Stop)
   WHERE s.id = 'your_stop_id'
   AND time(st.departure_time) >= time('08:30:00')
   RETURN st LIMIT 10
   ```

## Migration Timeline

**Week 1 (2026-03-25 to 2026-03-31): Parallel Testing**
- [x] Docker setup with both databases
- [x] Neo4j GTFS data import
- [x] Routing algorithm implementation
- [ ] Comprehensive testing (see Testing Strategy)
- [ ] Performance benchmarking
- [ ] Bug fixes based on comparison

**Week 2+: PostgreSQL Removal**
- Disable PostgreSQL in routing (keep data for backup)
- Simplify docker-compose (remove postgres service)
- Archive PostgreSQL backup
- Monitor Neo4j in production

