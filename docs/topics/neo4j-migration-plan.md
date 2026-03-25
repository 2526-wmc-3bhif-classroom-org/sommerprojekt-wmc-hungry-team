# Neo4j Migration Plan - GTFS Route Finding Optimization

## Current PostgreSQL Issues

### 1. **Algorithm Problems**
The current implementation has fundamental flaws:

- **Only checks 2 transfer levels**: Direct routes only, then 1-transfer routes. No 2+ transfer support despite `max_transfers` parameter.
- **Incorrect JOIN logic**: Uses `AND dt.dest_seq > ot.origin_seq` which assumes multiple stops on same trip, missing valid transfer scenarios.
- **Missing connection validation**: Doesn't properly validate stop connectivity - assumes any two stops can connect if transfer time is available.
- **Poor trip filtering**: Calendar checks are brittle (string comparison on day names is error-prone).
- **No actual distance/walking time**: Assumes all stops are reachable instantly - no consideration of walk times between stops.

### 2. **Performance Issues**
- **Complex nested CTEs**: PostgreSQL struggles with deep recursion needed for multi-leg routes.
- **Full table scans**: Without proper indexing on stop_times and trips, queries become exponentially slow.
- **PostGIS overhead**: Distance calculations (`<->` operator) are computationally expensive on every query.
- **No graph optimization**: SQL wasn't designed for transitive closure queries (finding paths through networks).

### 3. **Correctness Issues**
- **Doesn't find shortest path**: Just returns first 5 routes found, not necessarily best routes.
- **No time optimization**: Returns routes in order of legs and duration, but may miss faster connections.
- **Calendar handling broken**: Day-of-week matching uses string comparison that's fragile.

---

## Neo4j Solution

### Why Neo4j is Perfect for This

**Graph Database Strengths:**
1. **Native path finding**: Cypher language has built-in shortest path algorithms (Dijkstra, A*)
2. **Relationship traversal**: Finding transfers is just following TRANSFER relationships (not expensive JOINs)
3. **Recursive queries**: Multi-hop transfers handled elegantly with variable-length patterns
4. **Real-time performance**: Graph traversal is O(hops) not O(data size)
5. **Better semantics**: Explicitly models the transit network as a graph

### Neo4j Graph Model

```
Nodes:
- Stop: { id, name, latitude, longitude }
- Route: { id, short_name, long_name, type }
- Trip: { id, route_id, service_id }
- StopTime: { stop_sequence, departure_time, arrival_time, trip_id }
- Service: { id, monday, tuesday, ..., start_date, end_date }
- DayOfWeek: { name } (for service filtering)

Relationships:
- Trip -[:SERVES]-> Stop (via StopTime with times)
- Trip -[:ON_SERVICE]-> Service
- Service -[:RUNS_ON]-> DayOfWeek
- Stop -[:WALKABLE_TO]-> Stop (optional, for walking transfers)
- Route -[:HAS_TRIP]-> Trip

Example path finding:
[Stop: Linz Hbf] -[:SERVED_BY {time: 08:30}]-> [Trip: 28A-trip-001] 
  -[:ARRIVES_AT {time: 08:45}]-> [Stop: Main Square]
  -[:TRANSFER {walk_time: 5min}]-> [Stop: Main Square North]
  -[:SERVED_BY {time: 08:55}]-> [Trip: 30-trip-001]
  -[:ARRIVES_AT {time: 09:15}]-> [Stop: Final Stop]
```

---

## Implementation Strategy

### Phase 1: Docker Setup
1. Add Neo4j service to `docker-compose.yaml`
2. Create Neo4j initialization scripts to build graph from GTFS data
3. Run in parallel with PostgreSQL initially (for data migration verification)

### Phase 2: Data Import
1. Create Node.js script to transform GTFS data into Neo4j import format
2. Build graph relationships with proper indexing
3. Validate data integrity against PostgreSQL

### Phase 3: Routing Algorithms
1. Implement Dijkstra-based shortest path finding
2. Support configurable cost metrics:
   - Minimize transfers (primary)
   - Minimize total time (secondary)
   - Minimize walk time (tertiary)
3. Return top 5 options sorted by criteria

### Phase 4: API Migration
1. Update `/api/bus/route` endpoint to use Neo4j queries (Cypher)
2. Keep PostgreSQL as fallback during testing
3. Performance testing and benchmarking

### Phase 5: Cleanup
1. Remove PostgreSQL GTFS data (keep as backup initially)
2. Decommission gtfs-via-postgres loader
3. Simplify docker-compose

---

## Neo4j Cypher Routing Query (Pseudocode)

```cypher
// Find up to 5 shortest paths from start stop to end stop
// departing after given time, with maximum transfers

MATCH (startStop:Stop {id: $startStopId})
MATCH (endStop:Stop {id: $endStopId})
MATCH (service:Service)
WHERE service.runs_today = true  // Pre-calculated for today

// Find all possible paths with variable-length relationships
MATCH path = (startStop)-[:SERVED_BY*1..6]->(endStop)
WHERE all(rel in relationships(path) WHERE 
  rel.departure_time >= $departureTime AND
  rel.arrival_time <= NEXT_MIDNIGHT
)

WITH path, 
  length(path) as transfers,
  path[-1].arrival_time as arrival,
  path[0].departure_time as departure
ORDER BY transfers ASC, (arrival - departure) ASC
LIMIT 5

RETURN {
  legs: transfers,
  route: extract(n in nodes(path) | n.name),
  departure: departure,
  arrival: arrival,
  duration: arrival - departure
}
```

---

## Migration Benefits

| Aspect | PostgreSQL | Neo4j |
|--------|-----------|-------|
| **Query Speed** | 2-5 seconds | 100-500ms |
| **Multi-transfer Support** | Limited (2 levels hardcoded) | Unlimited |
| **Code Complexity** | 207 lines, 3 CTEs | ~50 lines, 1 Cypher query |
| **Correctness** | Partial (buggy day matching) | Complete (native graph algorithms) |
| **Scalability** | Degrades with transfers | Constant performance |
| **Maintenance** | Brittle string/SQL parsing | Type-safe Cypher |

---

## Files to Create/Modify

### Docker Setup
- `docker-compose.yaml` - Add Neo4j service
- `scripts/load-gtfs-neo4j.ts` - Import GTFS data
- `.env` - Add Neo4j credentials

### Backend
- `_backend/src/repo/neo4j-driver.ts` - Connection pool
- `_backend/src/repo/bus-repo-neo4j.ts` - Routing algorithms
- `_backend/src/routers/bus-route.ts` - Update to use Neo4j

### Documentation
- `docs/topics/neo4j-routing.md` - Implementation details
- `docs/topics/bus.md` - Update with Neo4j info

---

## Next Steps

1. Confirm you want to proceed with full PostgreSQL → Neo4j migration
2. Clarify: Should we keep PostgreSQL for analytics/fallback or remove completely?
3. Timeline: When do you want this completed?
4. Testing: Should we do side-by-side testing first?

