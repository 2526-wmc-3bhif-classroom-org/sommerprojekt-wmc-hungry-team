# Neo4j Migration - Testing Guide

This guide outlines the testing strategy for validating the Neo4j route finding implementation against PostgreSQL during the parallel testing phase (Week 1).

## Prerequisites

1. Docker and docker-compose installed
2. Node.js 20+ installed locally
3. `.env` file configured with Neo4j and PostgreSQL credentials
4. Both Neo4j and PostgreSQL containers running

## Setup

### 1. Start Docker Services

```bash
docker-compose up
```

This starts:
- PostgreSQL (port 5432) - loads GTFS data automatically
- Neo4j (port 7687 Bolt, 7474 HTTP) - loads GTFS data automatically
- Both loaders run until data is fully imported

### 2. Verify Data Load

```bash
# Check PostgreSQL
docker exec gtfs_db psql -U transit_admin -d gtfs_data -c "SELECT COUNT(*) as stop_count FROM stops;"

# Check Neo4j
curl -u neo4j:password http://localhost:7474/db/neo4j/tx -X POST \
  -H "Content-Type: application/json" \
  -d '{"statements":[{"statement":"MATCH (s:Stop) RETURN count(s)"}]}'
```

Both should show similar stop counts (thousands of stops).

### 3. Start Backend

```bash
cd _backend
npm install  # Install new neo4j dependency
npm run dev
```

Backend runs on http://localhost:3000

## Testing Plan

### Phase 1: Connection Testing

#### Test Both Databases Connected

```bash
curl http://localhost:3000/api/bus/test -i
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

**Pass Criteria**: Both show "up"

---

### Phase 2: Route Quality Comparison

#### Test Cases

Use the same queries with both backends and compare results:

**Test Case 1: Simple direct route (morning rush)**
```bash
# Neo4j (primary)
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2" -i > results_neo4j_1.json

# PostgreSQL (fallback)
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2&use_postgres=true" -i > results_postgres_1.json
```

**Pass Criteria**:
- Both return HTTP 200
- Neo4j returns 1-5 results
- Results include `legs`, `departure_time`, `arrival_time`, `route_short_name`
- Neo4j results are as good or better than PostgreSQL

**Test Case 2: Complex route with transfers (afternoon)**
```bash
curl "http://localhost:3000/api/bus/route?lat_a=48.29&lon_a=14.27&lat_b=48.31&lon_b=14.29&departure_time=14:00:00&max_transfers=5" -i > results_neo4j_2.json
curl "http://localhost:3000/api/bus/route?lat_a=48.29&lon_a=14.27&lat_b=48.31&lon_b=14.29&departure_time=14:00:00&max_transfers=5&use_postgres=true" -i > results_postgres_2.json
```

**Pass Criteria**:
- Neo4j finds routes with 2+ transfers (PostgreSQL limited to 1)
- Paths are logically valid (times progress forward)
- Transfer wait times are realistic (3+ minutes)

**Test Case 3: Edge case (early morning/late night)**
```bash
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=06:00:00&max_transfers=1" -i
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=22:30:00&max_transfers=1" -i
```

**Pass Criteria**:
- Returns 404 if no routes available (correct behavior)
- Or returns available routes with realistic times

**Test Case 4: Error cases**

```bash
# Missing parameter
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25" -i
# Expected: 400 error

# Invalid coordinate
curl "http://localhost:3000/api/bus/route?lat_a=95&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2" -i
# Expected: 400 error

# Invalid time format
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=8:30:00&max_transfers=2" -i
# Expected: 400 error
```

---

### Phase 3: Performance Comparison

#### Benchmark Script

Create `test-performance.sh`:

```bash
#!/bin/bash

echo "=== Neo4j Performance Test ==="
for i in {1..20}; do
  curl -s -w "Query $i: %{time_total}s\n" \
    "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=$(printf "%02d" $((7 + i/2))):30:00&max_transfers=2" \
    > /dev/null
done

echo ""
echo "=== PostgreSQL Performance Test ==="
for i in {1..20}; do
  curl -s -w "Query $i: %{time_total}s\n" \
    "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=$(printf "%02d" $((7 + i/2))):30:00&max_transfers=2&use_postgres=true" \
    > /dev/null
done
```

Run it:
```bash
chmod +x test-performance.sh
./test-performance.sh
```

**Pass Criteria**:
- Neo4j average: < 500ms
- PostgreSQL average: 2-5 seconds
- Neo4j is consistently faster

#### Expected Results Table

| Metric | Target | Acceptable | Fail |
|--------|--------|-----------|------|
| Neo4j avg response | < 300ms | < 500ms | > 500ms |
| PostgreSQL avg response | 2-5s | 1-6s | > 6s |
| Neo4j improvement | 4-10x faster | 2x faster | < 2x |
| P95 latency (Neo4j) | < 600ms | < 800ms | > 800ms |

---

### Phase 4: Multi-Transfer Validation

#### Test Neo4j Multi-Transfer Support

Verify Neo4j finds routes with 3, 4, 5 transfers:

```bash
# Request with max_transfers=5
RESPONSE=$(curl -s "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=5")

# Extract and check legs count
echo "$RESPONSE" | jq '.[] | .legs' | sort | uniq

# Should show values like: 1, 2, 3, 4, 5 (or at least 1, 2, 3+)
```

**Pass Criteria**:
- Neo4j returns routes with 3+ transfers
- PostgreSQL returns only 0-1 transfers (known limitation)

**Test Validation**:
```bash
jq '.[].legs | max' results_neo4j_complex.json    # Should be 3+
jq '.[].legs | max' results_postgres_complex.json # Should be 1
```

---

### Phase 5: Correctness Validation

#### Validate Route Logic

For each returned route, verify:

```bash
# Save response to file
curl -s "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2" > route.json

# Check each route with jq
jq '.[] | {
  legs,
  dep: .departure_time,
  arr: .arrival_time,
  duration: ((.arrival_time | split(":") | map(tonumber) | .[0]*3600 + .[1]*60 + .[2]) - (.departure_time | split(":") | map(tonumber) | .[0]*3600 + .[1]*60 + .[2]))
}' route.json
```

**Pass Criteria**:
- `legs` count >= 1
- `arrival_time` > `departure_time` (time progresses)
- `duration` > 0 and reasonable (5 minutes to 2 hours)
- Routes are sorted by `legs` then `arrival_time`

---

### Phase 6: Fallback Testing

#### Verify Fallback Mechanism

```bash
# Stop Neo4j container
docker-compose stop neo4j

# Try route query (should fall back to PostgreSQL)
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2" -i

# Check response header
# Should show: X-Route-Backend: postgresql

# Restart Neo4j
docker-compose start neo4j

# Wait for Neo4j to be ready
sleep 10

# Try query again (should use Neo4j)
curl "http://localhost:3000/api/bus/route?lat_a=48.30&lon_a=14.28&lat_b=48.25&lon_b=14.32&departure_time=08:30:00&max_transfers=2" -i

# Should show: X-Route-Backend: neo4j
```

**Pass Criteria**:
- Graceful fallback when Neo4j unavailable
- Automatic recovery when Neo4j comes back online
- Clear indication via `X-Route-Backend` header

---

## Comparison Script

Create `compare-results.js` to automate comparison:

```javascript
const fs = require('fs');

const neo4j = JSON.parse(fs.readFileSync('results_neo4j_1.json', 'utf8'));
const postgres = JSON.parse(fs.readFileSync('results_postgres_1.json', 'utf8'));

console.log('=== Route Quality Comparison ===\n');
console.log(`Neo4j results: ${neo4j.length} routes`);
console.log(`PostgreSQL results: ${postgres.length} routes`);

if (neo4j.length > 0 && postgres.length > 0) {
  const neo4jBest = neo4j[0];
  const pgBest = postgres[0];
  
  console.log('\nBest Neo4j route:');
  console.log(`  Legs: ${neo4jBest.legs}, Duration: ${neo4jBest.duration_minutes}min`);
  
  console.log('\nBest PostgreSQL route:');
  console.log(`  Legs: ${pgBest.legs}, Duration: ${pgBest.duration_minutes}min`);
  
  const improvement = pgBest.legs - neo4jBest.legs;
  console.log(`\nImprovement: ${improvement} fewer transfers`);
}
```

---

## Documentation Template

After each test session, document results:

```markdown
## Test Session - [DATE]

### Environment
- Neo4j version: [output from docker]
- PostgreSQL version: [output from docker]
- GTFS Data: LINZ_AG_GTFS_2026

### Test Results

#### Connection Test
- [✓/✗] Both databases up

#### Route Quality
- Test Case 1: [✓/✗] 
  - Neo4j results: [n routes]
  - PostgreSQL results: [n routes]
  
- Test Case 2: [✓/✗]
  - Neo4j multi-transfer: [✓/✗]
  - PostgreSQL multi-transfer: [✓/✗]

#### Performance
- Neo4j avg: [XXXms]
- PostgreSQL avg: [XXXms]
- Improvement: [XXx faster]

#### Fallback
- [✓/✗] Graceful fallback works
- [✓/✗] Auto-recovery on restart

### Issues Found
- [List any bugs or unexpected behavior]

### Next Steps
- [Actions to take before next test]
```

---

## Success Criteria - Full Validation

✅ **Ready for Production** when:
1. ✓ Connection test passes (both databases up)
2. ✓ All route quality test cases pass
3. ✓ Performance target met (Neo4j < 500ms avg)
4. ✓ Multi-transfer support verified (3+ transfers)
5. ✓ Correctness validation passes (routes logical)
6. ✓ Fallback mechanism works
7. ✓ No critical bugs found in 20+ queries
8. ✓ Results documented and approved

⚠️ **Issues to Fix**:
- [ ] Any incorrect route results
- [ ] Neo4j performance < target
- [ ] Fallback mechanism failures
- [ ] Data loading incomplete
- [ ] Connection pool issues

