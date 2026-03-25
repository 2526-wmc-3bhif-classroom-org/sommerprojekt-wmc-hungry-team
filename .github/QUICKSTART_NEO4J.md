# Quick Start - Neo4j Migration Testing

## 5-Minute Setup

### 1. Configure Environment
```bash
# Copy example to .env and edit with your values
cp .env.example .env
```

Edit `.env`:
```env
NEO4J_PASSWORD=your_secure_password_here
GOOGLE_KEY=your_google_key_here
```

### 2. Install Dependencies
```bash
cd _backend
npm install
```

### 3. Start Services
```bash
# From project root
docker-compose up

# Wait for messages:
# "✓ GTFS data successfully loaded into Neo4j"
# "Successfully loaded LINZ_AG_GTFS_2026 data into PostgreSQL"
```

This takes 1-2 minutes.

### 4. Start Backend (New Terminal)
```bash
cd _backend
npm run dev
```

### 5. Test Connection
```bash
curl http://localhost:3000/api/bus/test
```

Expected response:
```json
{
  "status": "ok",
  "backends": {
    "neo4j": "up",
    "postgresql": "up"
  }
}
```

---

## Testing Routes

### Neo4j (Primary)
```bash
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2" | jq
```

### PostgreSQL (Fallback)
```bash
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2&use_postgres=true" | jq
```

Both should return routes. Check headers:
```bash
curl -i "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2"
# Look for: X-Route-Backend: neo4j
```

---

## Neo4j Browser

View the graph database:
- Go to: http://localhost:7474
- Login: neo4j / (your NEO4J_PASSWORD)
- Run queries in browser

Example Cypher queries:

**Count stops**:
```cypher
MATCH (s:Stop) RETURN count(s)
```

**Find a specific stop**:
```cypher
MATCH (s:Stop) WHERE s.name CONTAINS "Linz" RETURN s LIMIT 5
```

**View stop connections**:
```cypher
MATCH (s:Stop)-[r:TRANSFER]->(s2:Stop) RETURN s, r, s2 LIMIT 10
```

---

## Troubleshooting

### "Cannot find module 'neo4j'"
```bash
# Dependencies not installed
cd _backend && npm install
```

### Neo4j container not starting
```bash
# Check logs
docker-compose logs neo4j

# Check port availability
lsof -i :7687
```

### Data not loaded
```bash
# Check loader logs
docker-compose logs neo4j-loader

# Verify GTFS files exist
ls data/LINZ_AG_GTFS_2026/stops.txt
```

### Routes returning empty
```bash
# Test with explicit coordinates
# Use these coordinates which are definitely in Linz:
# Start: 48.30, 14.28 (central Linz)
# End: 48.25, 14.32 (south of Linz)

curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=09:00:00&max_transfers=3"
```

---

## Full Testing (Follow this for complete validation)

See `docs/testing-neo4j-migration.md` for comprehensive test plan.

Quick summary:
1. ✓ Connection test (`/api/bus/test`)
2. ✓ Route quality comparison (same query, both backends)
3. ✓ Performance benchmarking (response times)
4. ✓ Multi-transfer validation (3+ legs)
5. ✓ Fallback testing (stop Neo4j, see PostgreSQL take over)

---

## File Structure

```
.
├── docker-compose.yaml          # Added Neo4j services
├── .env.example                 # Configuration template
├── scripts/
│   └── load-gtfs-neo4j.js       # GTFS data import
├── _backend/
│   ├── package.json             # Added neo4j dependency
│   └── src/
│       ├── routers/
│       │   └── bus-route.ts     # Neo4j-first routing
│       └── repo/
│           ├── neo4j-driver.ts  # Connection management
│           └── bus-repo-neo4j.ts # Routing algorithm
├── docs/
│   ├── NEO4J_IMPLEMENTATION_SUMMARY.md
│   ├── neo4j-routing.md
│   └── testing-neo4j-migration.md
└── .github/
    └── copilot-instructions.md  # Updated documentation
```

---

## Next Steps

1. Start services with setup above
2. Run connection test
3. Test a few routes
4. Follow `docs/testing-neo4j-migration.md` for full validation
5. Document results
6. Schedule decision gate for PostgreSQL removal

All files ready for testing! 🚀

