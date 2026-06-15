import neo4j from 'neo4j-driver';
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const driver = neo4j.driver(
  `bolt://${process.env.NEO4J_HOST}:${process.env.NEO4J_BOLT_PORT}`,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  { maxConnectionPoolSize: 50 }
);

const session = driver.session();

// Helper to parse CSV line
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; } 
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; } 
    else { current += char; }
  }
  result.push(current);
  return result;
}

function normalizeHeader(header) { return header.replace(/^\uFEFF/, '').trim(); }

function normalizeGtfsTime(timeStr) {
  if (!timeStr || timeStr.trim() === '') return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const seconds = parts[2] || '00';
  return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
}

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      resolve([]);
      return;
    }
    const results = [];
    const fileStream = createReadStream(filePath);
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
    let headers = [];
    let isFirst = true;
    rl.on('line', (line) => {
      if (isFirst) {
        headers = parseCSVLine(line).map(normalizeHeader);
        isFirst = false;
      } else if (line.trim()) {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((header, i) => { obj[header] = values[i]; });
        results.push(obj);
      }
    });
    rl.on('close', () => resolve(results));
    rl.on('error', reject);
  });
}

async function loadDataset(directory, prefix) {
  console.log(`\n=== Loading dataset ${directory} with prefix ${prefix} ===\n`);

  // Load Stops
  console.log('Loading stops...');
  const stops = await parseCSV(`${directory}/stops.txt`);
  for (let i = 0; i < stops.length; i += 100) {
    const batch = stops.slice(i, i + 100);
    await session.run(
      `UNWIND $stops as stop
       CREATE (s:Stop {
         id: $prefix + stop.stop_id,
         name: stop.stop_name,
         latitude: toFloat(stop.stop_lat),
         longitude: toFloat(stop.stop_lon),
         code: stop.stop_code,
         desc: stop.stop_desc
       })`,
      { stops: batch, prefix }
    );
  }
  console.log(`Loaded ${stops.length} stops`);

  // Load Routes
  console.log('Loading routes...');
  const routes = await parseCSV(`${directory}/routes.txt`);
  for (let i = 0; i < routes.length; i += 100) {
    const batch = routes.slice(i, i + 100);
    await session.run(
      `UNWIND $routes as route
       CREATE (r:Route {
         id: $prefix + route.route_id,
         short_name: route.route_short_name,
         long_name: route.route_long_name,
         type: toInteger(route.route_type),
         desc: route.route_desc,
         url: route.route_url
       })`,
      { routes: batch, prefix }
    );
  }
  console.log(`Loaded ${routes.length} routes`);

  // Load Services (Calendar)
  console.log('Loading services...');
  const calendar = await parseCSV(`${directory}/calendar.txt`);
  for (let i = 0; i < calendar.length; i += 100) {
    const batch = calendar.slice(i, i + 100);
    await session.run(
      `UNWIND $services as svc
       CREATE (s:Service {
         id: $prefix + svc.service_id,
         monday: svc.monday = '1',
         tuesday: svc.tuesday = '1',
         wednesday: svc.wednesday = '1',
         thursday: svc.thursday = '1',
         friday: svc.friday = '1',
         saturday: svc.saturday = '1',
         sunday: svc.sunday = '1',
         start_date: svc.start_date,
         end_date: svc.end_date
       })`,
      { services: batch, prefix }
    );
  }
  console.log(`Loaded ${calendar.length} services`);

  // Load Trips
  console.log('Loading trips...');
  const trips = await parseCSV(`${directory}/trips.txt`);
  for (let i = 0; i < trips.length; i += 100) {
    const batch = trips.slice(i, i + 100);
    await session.run(
      `UNWIND $trips as trip
       MATCH (r:Route {id: $prefix + trip.route_id})
       MATCH (s:Service {id: $prefix + trip.service_id})
       CREATE (t:Trip {
         id: $prefix + trip.trip_id,
         route_id: $prefix + trip.route_id,
         service_id: $prefix + trip.service_id,
         headsign: trip.trip_headsign,
         direction: trip.direction_id
       })
       CREATE (t)-[:ON_ROUTE]->(r)
       CREATE (t)-[:ON_SERVICE]->(s)`,
      { trips: batch, prefix }
    );
  }
  console.log(`Loaded ${trips.length} trips`);

  // Load Stop Times
  console.log('Loading stop times...');
  const stopTimes = await parseCSV(`${directory}/stop_times.txt`);
  
  const tripMap = new Map();
  let skippedStopTimes = 0;
  for (const st of stopTimes) {
    const tripId = prefix + st.trip_id;
    const stopId = prefix + st.stop_id;
    const stopSeq = st.stop_sequence;
    if (!st.trip_id || !st.stop_id || !stopSeq) { skippedStopTimes++; continue; }
    if (!tripMap.has(tripId)) { tripMap.set(tripId, []); }
    tripMap.get(tripId).push({ ...st, trip_id: tripId, stop_id: stopId });
  }

  if (skippedStopTimes > 0) { console.warn(`Skipped ${skippedStopTimes} malformed stop_times rows`); }

  const tripIds = Array.from(tripMap.keys());
  const BATCH_SIZE = 50;
  let tripCount = 0;
  
  for (let batchStart = 0; batchStart < tripIds.length; batchStart += BATCH_SIZE) {
    const batchTripIds = tripIds.slice(batchStart, batchStart + BATCH_SIZE);
    const stopTimeBatch = [];
    const nextStopBatch = [];
    
    for (const tripId of batchTripIds) {
      const times = tripMap.get(tripId);
      times.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
      
      for (let i = 0; i < times.length; i++) {
        const st = times[i];
        const stopSequence = Number.parseInt(st.stop_sequence, 10);
        if (Number.isNaN(stopSequence)) continue;
        
        stopTimeBatch.push({
          tripId,
          stopId: st.stop_id,
          stopSeq: stopSequence,
          arrivalTime: normalizeGtfsTime(st.arrival_time),
          departureTime: normalizeGtfsTime(st.departure_time)
        });
        
        if (i < times.length - 1) {
          const nextSt = times[i + 1];
          const nextSequence = Number.parseInt(nextSt.stop_sequence, 10);
          if (!Number.isNaN(nextSequence)) {
            nextStopBatch.push({
              tripId,
              seq1: stopSequence,
              seq2: nextSequence,
              departureTime1: normalizeGtfsTime(st.departure_time),
              arrivalTime2: normalizeGtfsTime(nextSt.arrival_time)
            });
          }
        }
      }
    }
    
    if (stopTimeBatch.length > 0) {
      await session.run(
        `UNWIND $batch as item
         MATCH (t:Trip {id: item.tripId})
         MATCH (stop:Stop {id: item.stopId})
         CREATE (st:StopTime {
           trip_id: item.tripId,
           stop_id: item.stopId,
           stop_sequence: item.stopSeq,
           arrival_time: item.arrivalTime,
           departure_time: item.departureTime
         })
         CREATE (t)-[:STOPS_AT]->(st)
         CREATE (st)-[:AT_STOP]->(stop)`,
        { batch: stopTimeBatch }
      );
    }
    
    if (nextStopBatch.length > 0) {
      await session.run(
        `UNWIND $batch as item
         MATCH (st1:StopTime {trip_id: item.tripId, stop_sequence: item.seq1})
         MATCH (st2:StopTime {trip_id: item.tripId, stop_sequence: item.seq2})
         CREATE (st1)-[:NEXT_STOP {
           arrival_time: item.arrivalTime2,
           departure_time: item.departureTime1
         }]->(st2)`,
        { batch: nextStopBatch }
      );
    }
    
    tripCount += batchTripIds.length;
    if (tripCount % 500 === 0 || tripCount === tripIds.length) {
      console.log(`  Processed ${tripCount}/${tripIds.length} trips...`);
    }
    
    stopTimeBatch.length = 0;
    nextStopBatch.length = 0;
  }
  console.log(`Loaded ${tripCount} trips from ${directory}`);
}

async function loadGTFS() {
  try {
    const force = process.argv.includes('--force');
    const existingStops = await session.run('MATCH (s:Stop) RETURN count(s) AS count');
    const stopCount = existingStops.records[0].get('count');
    const count = typeof stopCount.toNumber === 'function' ? stopCount.toNumber() : Number(stopCount);

    if (count > 0 && !force) {
      console.log(`✓ Data already loaded in Neo4j (${count} stops found). Skipping loader. Run with --force to overwrite.`);
      return;
    }

    console.log('Clearing existing data (force reload in batches)...');
    while (true) {
      const countRes = await session.run('MATCH (n) RETURN count(n) AS count');
      const rawCount = countRes.records[0].get('count');
      const count = typeof rawCount.toNumber === 'function' ? rawCount.toNumber() : Number(rawCount);
      if (count === 0) {
        break;
      }
      console.log(`  Deleting batch... ${count} nodes remaining`);
      await session.run('MATCH (n) WITH n LIMIT 10000 DETACH DELETE n');
    }

    console.log('Creating constraints and indexes...');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (s:Stop) REQUIRE s.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (r:Route) REQUIRE r.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (t:Trip) REQUIRE t.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (sv:Service) REQUIRE sv.id IS UNIQUE');
    await session.run('CREATE INDEX IF NOT EXISTS FOR (st:StopTime) ON (st.trip_id)');
    await session.run('CREATE INDEX IF NOT EXISTS FOR (st:StopTime) ON (st.stop_id)');

    const datasets = [
      { dir: '/data/LINZ_AG_GTFS_2026', prefix: 'LINZ_' },
      { dir: '/data/OOEVV_GTFS_2026', prefix: 'OOEVV_' }
    ];

    for (const dataset of datasets) {
      await loadDataset(dataset.dir, dataset.prefix);
    }

    console.log('✓ All GTFS data successfully loaded into Neo4j');
    console.log('\nDatabase Summary:');
    
    const stopsCount = await session.run('MATCH (n:Stop) RETURN count(n) AS count');
    const routesCount = await session.run('MATCH (n:Route) RETURN count(n) AS count');
    const tripsCount = await session.run('MATCH (n:Trip) RETURN count(n) AS count');
    const servicesCount = await session.run('MATCH (n:Service) RETURN count(n) AS count');
    const stopTimesCount = await session.run('MATCH (n:StopTime) RETURN count(n) AS count');
    const nextStopCount = await session.run('MATCH ()-[r:NEXT_STOP]->() RETURN count(r) AS count');
    
    console.log({
      stops: stopsCount.records[0].get('count'),
      routes: routesCount.records[0].get('count'),
      trips: tripsCount.records[0].get('count'),
      services: servicesCount.records[0].get('count'),
      stopTimes: stopTimesCount.records[0].get('count'),
      nextStopRelationships: nextStopCount.records[0].get('count')
    });

  } catch (error) {
    console.error('Error loading GTFS data:', error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

loadGTFS();
