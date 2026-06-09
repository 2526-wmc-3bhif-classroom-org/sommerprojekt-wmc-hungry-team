import { getNeo4jSession } from './neo4j-driver.js';

// Minimum transfer time in minutes (time needed to change vehicles)
const MIN_TRANSFER_TIME_MINUTES = 3;

interface Leg {
  board_stop_id: string;
  board_stop_name: string;
  alight_stop_id: string;
  alight_stop_name: string;
  departure_time: string;
  arrival_time: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
}

interface RouteResult {
  legs: Leg[];
  total_duration_minutes: number;
  departure_time: string;
  arrival_time: string;
  num_transfers: number;
}

/**
 * Find optimal routes using Neo4j graph algorithms
 * Supports multi-leg journeys with transfers
 * Returns routes sorted by: transfers (asc), duration (asc), departure time (asc)
 */
export const findRoutes = async (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  departureTime: string,
  maxTransfers: number
): Promise<RouteResult[]> => {
  const session = getNeo4jSession();

  try {
    // Step 1: Find closest start stop that has StopTime data
    const startStopResult = await session.run(
      `MATCH (s:Stop)
       WITH s, point.distance(point({latitude: s.latitude, longitude: s.longitude}), point({latitude: $lat, longitude: $lon})) as dist
       ORDER BY dist
       LIMIT 20
       MATCH (s)<-[:AT_STOP]-(:StopTime)
       RETURN s.id as stop_id, s.name as stop_name
       LIMIT 1`,
      { lat: startLat, lon: startLon }
    );

    // Step 2: Find closest end stop that has StopTime data
    const endStopResult = await session.run(
      `MATCH (s:Stop)
       WITH s, point.distance(point({latitude: s.latitude, longitude: s.longitude}), point({latitude: $lat, longitude: $lon})) as dist
       ORDER BY dist
       LIMIT 20
       MATCH (s)<-[:AT_STOP]-(:StopTime)
       RETURN s.id as stop_id, s.name as stop_name
       LIMIT 1`,
      { lat: endLat, lon: endLon }
    );

    if (startStopResult.records.length === 0 || endStopResult.records.length === 0) {
      return [];
    }

    const startStopName = startStopResult.records[0].get('stop_name');
    const endStopName = endStopResult.records[0].get('stop_name');

    console.time(`findRoutes: ${startStopName} -> ${endStopName}`);

    // Collect routes from all leg counts (direct + transfers)
    const allRoutes: RouteResult[] = [];

    // Try direct routes first (0 transfers)
    const directRoutes = await findDirectRoutes(session, startStopName, endStopName, departureTime);
    allRoutes.push(...directRoutes);

    // Try routes with transfers if allowed and needed
    if (maxTransfers > 0 && directRoutes.length < 5) {
      for (let numTransfers = 1; numTransfers <= maxTransfers; numTransfers++) {
        const transferRoutes = await findRoutesWithTransfers(
          session, startStopName, endStopName, departureTime, numTransfers
        );
        allRoutes.push(...transferRoutes);
        
        // Stop if we have enough routes
        if (allRoutes.length >= 10) break;
      }
    }

    // Sort by: num_transfers ASC, total_duration ASC, departure_time ASC
    allRoutes.sort((a, b) => {
      if (a.num_transfers !== b.num_transfers) return a.num_transfers - b.num_transfers;
      if (a.total_duration_minutes !== b.total_duration_minutes) return a.total_duration_minutes - b.total_duration_minutes;
      return a.departure_time.localeCompare(b.departure_time);
    });

    // Return top 5 unique routes
    return deduplicateRoutes(allRoutes).slice(0, 5);

  } finally {
    await session.close();
  }
};

/**
 * Find direct routes (no transfers)
 */
async function findDirectRoutes(
  session: any,
  startStopName: string,
  endStopName: string,
  departureTime: string
): Promise<RouteResult[]> {
  const result = await session.run(
    `MATCH (startStop:Stop {name: $startStopName})<-[:AT_STOP]-(st1:StopTime)<-[:STOPS_AT]-(trip:Trip)-[:ON_ROUTE]->(route:Route)
     WHERE st1.departure_time >= $departureTime AND st1.departure_time < '24:00:00'
     
     MATCH (trip)-[:STOPS_AT]->(st_end:StopTime)-[:AT_STOP]->(endStop:Stop {name: $endStopName})
     WHERE st1.stop_sequence < st_end.stop_sequence
     
     RETURN startStop.id as board_stop_id,
            startStop.name as board_stop_name,
            endStop.id as alight_stop_id,
            endStop.name as alight_stop_name,
            st1.departure_time as departure_time,
            st_end.arrival_time as arrival_time,
            route.short_name as route_short_name,
            route.long_name as route_long_name,
            route.type as route_type
     ORDER BY st1.departure_time ASC
     LIMIT 5`,
    { startStopName, endStopName, departureTime }
  );

  return result.records.map((record: any) => {
    const depTime = formatTime(record.get('departure_time'));
    const arrTime = formatTime(record.get('arrival_time'));
    
    return {
      legs: [{
        board_stop_id: record.get('board_stop_id'),
        board_stop_name: record.get('board_stop_name'),
        alight_stop_id: record.get('alight_stop_id'),
        alight_stop_name: record.get('alight_stop_name'),
        departure_time: depTime,
        arrival_time: arrTime,
        route_short_name: record.get('route_short_name'),
        route_long_name: record.get('route_long_name'),
        route_type: toNumber(record.get('route_type'))
      }],
      total_duration_minutes: calculateDurationMinutes(depTime, arrTime),
      departure_time: depTime,
      arrival_time: arrTime,
      num_transfers: 0
    };
  });
}

/**
 * Find routes with exactly N transfers
 * Uses a recursive approach: find first leg, then recursively find remaining legs
 */
async function findRoutesWithTransfers(
  session: any,
  startStopName: string,
  endStopName: string,
  departureTime: string,
  numTransfers: number
): Promise<RouteResult[]> {
  if (numTransfers === 1) {
    return findRoutesWithOneTransfer(session, startStopName, endStopName, departureTime);
  } else if (numTransfers === 2) {
    return findRoutesWithTwoTransfers(session, startStopName, endStopName, departureTime);
  }
  // For 3+ transfers, the query complexity grows exponentially
  // Could implement iterative deepening or use APOC path finding
  return [];
}

/**
 * Find routes with exactly 1 transfer
 */
async function findRoutesWithOneTransfer(
  session: any,
  startStopName: string,
  endStopName: string,
  departureTime: string
): Promise<RouteResult[]> {
  // Use a simpler approach: just check that departure is after arrival
  // The minimum transfer time will be enforced in post-processing
  const result = await session.run(
    `MATCH (startStop:Stop {name: $startStopName})<-[:AT_STOP]-(st1:StopTime)<-[:STOPS_AT]-(trip1:Trip)-[:ON_ROUTE]->(route1:Route)
     WHERE st1.departure_time >= $departureTime AND st1.departure_time < '24:00:00'
     
     MATCH (trip1)-[:STOPS_AT]->(st1_end:StopTime)-[:AT_STOP]->(transferStop:Stop)
     WHERE st1.stop_sequence < st1_end.stop_sequence
     
     WITH startStop, st1, trip1, route1, st1_end, transferStop, $endStopName AS endName, $minTransferTime AS minTransTime
     
     MATCH (transferStop)<-[:AT_STOP]-(st2:StopTime)<-[:STOPS_AT]-(trip2:Trip)-[:ON_ROUTE]->(route2:Route)
     WHERE st2.departure_time > st1_end.arrival_time
     AND st2.departure_time < '24:00:00'
     
     MATCH (trip2)-[:STOPS_AT]->(st2_end:StopTime)-[:AT_STOP]->(endStop:Stop {name: endName})
     WHERE st2.stop_sequence < st2_end.stop_sequence
     
     WITH *, 
          toInteger(substring(st1_end.arrival_time, 0, 2)) * 60 + toInteger(substring(st1_end.arrival_time, 3, 2)) as arr1_mins,
          toInteger(substring(st2.departure_time, 0, 2)) * 60 + toInteger(substring(st2.departure_time, 3, 2)) as dep2_mins
     WHERE dep2_mins >= arr1_mins + $minTransferTime
     
     RETURN {
       leg1: {
         board_stop_id: startStop.id,
         board_stop_name: startStop.name,
         alight_stop_id: transferStop.id,
         alight_stop_name: transferStop.name,
         departure_time: st1.departure_time,
         arrival_time: st1_end.arrival_time,
         route_short_name: route1.short_name,
         route_long_name: route1.long_name,
         route_type: route1.type
       },
       leg2: {
         board_stop_id: transferStop.id,
         board_stop_name: transferStop.name,
         alight_stop_id: endStop.id,
         alight_stop_name: endStop.name,
         departure_time: st2.departure_time,
         arrival_time: st2_end.arrival_time,
         route_short_name: route2.short_name,
         route_long_name: route2.long_name,
         route_type: route2.type
       }
     } as route
     ORDER BY route.leg1.departure_time ASC, route.leg2.arrival_time ASC
     LIMIT 5`,
    { startStopName, endStopName, departureTime, minTransferTime: MIN_TRANSFER_TIME_MINUTES }
  );

  return result.records.map((record: any) => {
    const route = record.get('route');
    const leg1 = route.leg1;
    const leg2 = route.leg2;
    
    const depTime = formatTime(leg1.departure_time);
    const arrTime = formatTime(leg2.arrival_time);
    
    return {
      legs: [
        {
          board_stop_id: leg1.board_stop_id,
          board_stop_name: leg1.board_stop_name,
          alight_stop_id: leg1.alight_stop_id,
          alight_stop_name: leg1.alight_stop_name,
          departure_time: formatTime(leg1.departure_time),
          arrival_time: formatTime(leg1.arrival_time),
          route_short_name: leg1.route_short_name,
          route_long_name: leg1.route_long_name,
          route_type: toNumber(leg1.route_type)
        },
        {
          board_stop_id: leg2.board_stop_id,
          board_stop_name: leg2.board_stop_name,
          alight_stop_id: leg2.alight_stop_id,
          alight_stop_name: leg2.alight_stop_name,
          departure_time: formatTime(leg2.departure_time),
          arrival_time: formatTime(leg2.arrival_time),
          route_short_name: leg2.route_short_name,
          route_long_name: leg2.route_long_name,
          route_type: toNumber(leg2.route_type)
        }
      ],
      total_duration_minutes: calculateDurationMinutes(depTime, arrTime),
      departure_time: depTime,
      arrival_time: arrTime,
      num_transfers: 1
    };
  });
}

/**
 * Find routes with exactly 2 transfers
 */
async function findRoutesWithTwoTransfers(
  session: any,
  startStopName: string,
  endStopName: string,
  departureTime: string
): Promise<RouteResult[]> {
  // This query is complex - for now, return empty and let 1-transfer handle most cases
  // A proper implementation would extend the 1-transfer pattern with another leg
  // or use APOC shortest path algorithms
  return [];
}

/**
 * Remove duplicate routes (same legs, same times)
 */
function deduplicateRoutes(routes: RouteResult[]): RouteResult[] {
  const seen = new Set<string>();
  return routes.filter(route => {
    const key = route.legs.map(l => 
      `${l.board_stop_name}-${l.alight_stop_name}-${l.departure_time}-${l.route_short_name}`
    ).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Convert Neo4j integer to JS number
 */
function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return parseInt(value, 10) || 0;
}

/**
 * Format HH:MM:SS or interval to HH:MM:SS string
 */
function formatTime(timeValue: any): string {
  if (!timeValue) return '00:00:00';
  
  if (typeof timeValue === 'string') {
    // Already formatted
    if (timeValue.includes(':')) {
      const parts = timeValue.split(':');
      return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:${String(parts[2] || '00').padStart(2, '0')}`;
    }
  }
  
  // Handle time objects from Neo4j
  if (timeValue.hour !== undefined) {
    return `${String(timeValue.hour).padStart(2, '0')}:${String(timeValue.minute).padStart(2, '0')}:${String(timeValue.second).padStart(2, '0')}`;
  }
  
  return '00:00:00';
}

/**
 * Calculate duration in minutes between two HH:MM:SS time strings
 */
function calculateDurationMinutes(departure: string, arrival: string): number {
  const depParts = departure.split(':').map(Number);
  const arrParts = arrival.split(':').map(Number);
  
  const depMinutes = depParts[0] * 60 + depParts[1];
  const arrMinutes = arrParts[0] * 60 + arrParts[1];
  
  return arrMinutes - depMinutes;
}

/**
 * Test Neo4j connection
 */
export const testNeo4jConnection = async () => {
  const session = getNeo4jSession();
  try {
    const result = await session.run('MATCH (s:Stop) RETURN count(s) as count LIMIT 1');
    return result.records;
  } finally {
    await session.close();
  }
};

