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

// Helper to parse CSV line (simple parser, handles quoted fields)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normalizeHeader(header) {
  return header.replace(/^\uFEFF/, '').trim();
}

/**
 * Normalize GTFS time format (handles 24+ hour times)
 * GTFS allows times like "24:30:00" meaning "00:30:00 next day"
 * We store as string to preserve the original value for schedule logic
 */
function normalizeGtfsTime(timeStr) {
  if (!timeStr || timeStr.trim() === '') return '';
  
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const seconds = parts[2] || '00';
  
  // Keep hours as-is for GTFS logic (24+ means next day service)
  // But format consistently
  return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
}

// Parse CSV file and return array of objects with headers
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let headers = [];
    let isFirst = true;

    rl.on('line', (line) => {
      if (isFirst) {
        headers = parseCSVLine(line).map(normalizeHeader);
        isFirst = false;
      } else if (line.trim()) {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = values[i];
        });
        results.push(obj);
      }
    });

    rl.on('close', () => resolve(results));
    rl.on('error', reject);
  });
}

async function loadGTFS() {
  try {
    // Check if data is already loaded
    const existingStops = await session.run('MATCH (s:Stop) RETURN count(s) AS count');
    const stopCount = existingStops.records[0].get('count');
    const count = typeof stopCount.toNumber === 'function' ? stopCount.toNumber() : Number(stopCount);

    if (count > 0) {
      console.log(`✓ Neo4j already contains ${count} stops — skipping GTFS import.`);
      return;
    }

    console.log('No existing data found — starting GTFS import...');

    console.log('Clearing existing data...');
    await session.run('MATCH (n) DETACH DELETE n');

    // Create constraints and indexes
    console.log('Creating constraints and indexes...');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (s:Stop) REQUIRE s.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (r:Route) REQUIRE r.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (t:Trip) REQUIRE t.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (sv:Service) REQUIRE sv.id IS UNIQUE');
    await session.run('CREATE INDEX IF NOT EXISTS FOR (st:StopTime) ON (st.trip_id)');
    await session.run('CREATE INDEX IF NOT EXISTS FOR (st:StopTime) ON (st.stop_id)');

    // Load Stops
    console.log('Loading stops...');
    const stops = await parseCSV('/data/LINZ_AG_GTFS_2026/stops.txt');
    for (let i = 0; i < stops.length; i += 100) {
      const batch = stops.slice(i, i + 100);
      await session.run(
        `UNWIND $stops as stop
         CREATE (s:Stop {
           id: stop.stop_id,
           name: stop.stop_name,
           latitude: toFloat(stop.stop_lat),
           longitude: toFloat(stop.stop_lon),
           code: stop.stop_code,
           desc: stop.stop_desc
         })`,
        { stops: batch }
      );
    }
    console.log(`Loaded ${stops.length} stops`);

    // Load Routes
    console.log('Loading routes...');
    const routes = await parseCSV('/data/LINZ_AG_GTFS_2026/routes.txt');
    for (let i = 0; i < routes.length; i += 100) {
      const batch = routes.slice(i, i + 100);
      await session.run(
        `UNWIND $routes as route
         CREATE (r:Route {
           id: route.route_id,
           short_name: route.route_short_name,
           long_name: route.route_long_name,
           type: toInteger(route.route_type),
           desc: route.route_desc,
           url: route.route_url
         })`,
        { routes: batch }
      );
    }
    console.log(`Loaded ${routes.length} routes`);

    // Load Services (Calendar)
    console.log('Loading services...');
    const calendar = await parseCSV('/data/LINZ_AG_GTFS_2026/calendar.txt');
    for (let i = 0; i < calendar.length; i += 100) {
      const batch = calendar.slice(i, i + 100);
      await session.run(
        `UNWIND $services as svc
         CREATE (s:Service {
           id: svc.service_id,
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
        { services: batch }
      );
    }
    console.log(`Loaded ${calendar.length} services`);

    // Load Trips
    console.log('Loading trips...');
    const trips = await parseCSV('/data/LINZ_AG_GTFS_2026/trips.txt');
    for (let i = 0; i < trips.length; i += 100) {
      const batch = trips.slice(i, i + 100);
      await session.run(
        `UNWIND $trips as trip
         MATCH (r:Route {id: trip.route_id})
         MATCH (s:Service {id: trip.service_id})
         CREATE (t:Trip {
           id: trip.trip_id,
           route_id: trip.route_id,
           service_id: trip.service_id,
           headsign: trip.trip_headsign,
           direction: trip.direction_id
         })
         CREATE (t)-[:ON_ROUTE]->(r)
         CREATE (t)-[:ON_SERVICE]->(s)`,
        { trips: batch }
      );
    }
    console.log(`Loaded ${trips.length} trips`);

    // Load Stop Times (this creates the main connectivity graph)
    console.log('Loading stop times...');
    const stopTimes = await parseCSV('/data/LINZ_AG_GTFS_2026/stop_times.txt');
    
    // Group by trip for efficiency
    const tripMap = new Map();
    let skippedStopTimes = 0;
    for (const st of stopTimes) {
      const tripId = st.trip_id;
      const stopId = st.stop_id;
      const stopSeq = st.stop_sequence;

      if (!tripId || !stopId || !stopSeq) {
        skippedStopTimes++;
        continue;
      }

      if (!tripMap.has(tripId)) {
        tripMap.set(tripId, []);
      }
      tripMap.get(tripId).push(st);
    }

    if (skippedStopTimes > 0) {
      console.warn(`Skipped ${skippedStopTimes} malformed stop_times rows`);
    }

    // Process trips in batches for memory efficiency
    const tripIds = Array.from(tripMap.keys());
    const BATCH_SIZE = 50;
    let tripCount = 0;
    
    for (let batchStart = 0; batchStart < tripIds.length; batchStart += BATCH_SIZE) {
      const batchTripIds = tripIds.slice(batchStart, batchStart + BATCH_SIZE);
      
      // Prepare batch data for stop times
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
          
          // Prepare next stop relationship
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
      
      // Batch insert stop times
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
      
      // Batch insert next stop relationships  
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
      
      // Clear batch arrays to help garbage collection
      stopTimeBatch.length = 0;
      nextStopBatch.length = 0;
    }
    
    console.log(`Loaded ${tripCount} trips with ${stopTimes.length} stop times`);

    // Skip transfer relationships for now - they're complex and not required for basic routing
    // The routing algorithm can find transfers by matching stops between different trips
    console.log('Skipping transfer relationship creation (not required for routing)...');

    console.log('✓ GTFS data successfully loaded into Neo4j');
    console.log('\nDatabase Summary:');
    
    // Run summary queries sequentially to avoid transaction issues
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

