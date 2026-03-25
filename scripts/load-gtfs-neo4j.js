import neo4j from 'neo4j';
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
        headers = parseCSVLine(line);
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
    for (const st of stopTimes) {
      if (!tripMap.has(st.trip_id)) {
        tripMap.set(st.trip_id, []);
      }
      tripMap.get(st.trip_id).push(st);
    }

    let tripCount = 0;
    for (const [tripId, times] of tripMap) {
      // Sort by stop sequence
      times.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

      // Create stop time nodes and connections
      for (let i = 0; i < times.length; i++) {
        const st = times[i];
        await session.run(
          `MATCH (t:Trip {id: $tripId})
           MATCH (stop:Stop {id: $stopId})
           CREATE (st:StopTime {
             trip_id: $tripId,
             stop_id: $stopId,
             stop_sequence: toInteger($stopSeq),
             arrival_time: $arrivalTime,
             departure_time: $departureTime
           })
           CREATE (t)-[:STOPS_AT]->(st)
           CREATE (st)-[:AT_STOP]->(stop)`,
          {
            tripId,
            stopId: st.stop_id,
            stopSeq: st.stop_sequence,
            arrivalTime: st.arrival_time || '',
            departureTime: st.departure_time || ''
          }
        );

        // Create connection to next stop in same trip
        if (i < times.length - 1) {
          const nextSt = times[i + 1];
          await session.run(
            `MATCH (st1:StopTime {trip_id: $tripId, stop_sequence: toInteger($seq1)})
             MATCH (st2:StopTime {trip_id: $tripId, stop_sequence: toInteger($seq2)})
             CREATE (st1)-[:NEXT_STOP {
               arrival_time: $arrivalTime2,
               departure_time: $departureTime1
             }]->(st2)`,
            {
              tripId,
              seq1: st.stop_sequence,
              seq2: nextSt.stop_sequence,
              departureTime1: st.departure_time,
              arrivalTime2: nextSt.arrival_time
            }
          );
        }
      }

      tripCount++;
      if (tripCount % 500 === 0) {
        console.log(`  Processed ${tripCount} trips...`);
      }
    }
    console.log(`Loaded ${tripCount} trips with ${stopTimes.length} stop times`);

    // Create transfer relationships between stops if there's enough time gap
    console.log('Creating transfer relationships...');
    await session.run(
      `MATCH (s1:Stop)<-[:AT_STOP]-(st1:StopTime)
       MATCH (s2:Stop)<-[:AT_STOP]-(st2:StopTime)
       WHERE s1 <> s2
       AND st1.trip_id <> st2.trip_id
       AND st2.departure_time > st1.arrival_time
       AND duration.between(time(st1.arrival_time), time(st2.departure_time)).minutes <= 15
       CREATE (s1)-[:TRANSFER {
         min_time: duration.between(time(st1.arrival_time), time(st2.departure_time)).minutes,
         from_trip: st1.trip_id,
         to_trip: st2.trip_id
       }]->(s2)`
    );

    console.log('✓ GTFS data successfully loaded into Neo4j');
    console.log('\nDatabase Summary:');
    const stats = await session.run(
      `RETURN 
       count(distinct (n:Stop)) as stops,
       count(distinct (n:Route)) as routes,
       count(distinct (n:Trip)) as trips,
       count(distinct (n:Service)) as services,
       count(distinct (n:StopTime)) as stopTimes`
    );
    console.log(stats.records[0].toObject());

  } catch (error) {
    console.error('Error loading GTFS data:', error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

loadGTFS();

