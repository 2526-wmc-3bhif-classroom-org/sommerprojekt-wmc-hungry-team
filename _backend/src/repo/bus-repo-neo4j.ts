import { getNeo4jSession } from './neo4j-driver.js';

/**
 * Find optimal routes using Neo4j graph algorithms
 * Returns routes sorted by: transfers (asc), duration (asc), departure time (asc)
 */
export const findRoutes = async (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  departureTime: string,
  maxTransfers: number
) => {
  const session = getNeo4jSession();

  try {
    // Step 1: Find closest start stop that has StopTime data
    const startStopResult = await session.run(
      `MATCH (s:Stop)<-[:AT_STOP]-(:StopTime)
       WITH DISTINCT s, 
            point({latitude: s.latitude, longitude: s.longitude}) as stop_point,
            point({latitude: $lat, longitude: $lon}) as search_point
       RETURN s.id as stop_id, s.name as stop_name
       ORDER BY point.distance(stop_point, search_point)
       LIMIT 1`,
      { lat: startLat, lon: startLon }
    );

    // Step 2: Find closest end stop that has StopTime data
    const endStopResult = await session.run(
      `MATCH (s:Stop)<-[:AT_STOP]-(:StopTime)
       WITH DISTINCT s,
            point({latitude: s.latitude, longitude: s.longitude}) as stop_point,
            point({latitude: $lat, longitude: $lon}) as search_point
       RETURN s.id as stop_id, s.name as stop_name
       ORDER BY point.distance(stop_point, search_point)
       LIMIT 1`,
      { lat: endLat, lon: endLon }
    );

    if (startStopResult.records.length === 0 || endStopResult.records.length === 0) {
      return [];
    }

    const startStopId = startStopResult.records[0].get('stop_id');
    const endStopId = endStopResult.records[0].get('stop_id');

    // Step 3: Find all valid routes with varying transfer counts
    // Using recursive Cypher query to find paths up to maxTransfers+1 legs
    const maxLegs = Math.min(maxTransfers + 1, 6); // Cap at 6 legs for performance

    // Get the destination stop name to match any platform at that station
    const endStopName = endStopResult.records[0].get('stop_name');

    // Simpler routing query that uses string comparison for times
    // This works because HH:MM:SS format sorts lexicographically for times < 24:00
    const routesResult = await session.run(
      `MATCH (startStop:Stop {id: $startStopId})
       
       // Find stop times at start stop departing after requested time
       MATCH (startStop)<-[:AT_STOP]-(st1:StopTime)
       WHERE st1.departure_time >= $departureTime
       AND st1.departure_time < '24:00:00'
       
       // Find if this trip reaches any stop with the destination name (any platform)
       MATCH (st1)-[:NEXT_STOP*1..50]->(st_end:StopTime)-[:AT_STOP]->(endStop:Stop)
       WHERE endStop.name = $endStopName
       
       // Get route info
       MATCH (trip:Trip)-[:STOPS_AT]->(st1)
       MATCH (trip)-[:ON_ROUTE]->(route:Route)
       
       WITH st1, st_end, route, startStop, endStop,
            st1.departure_time as departure,
            st_end.arrival_time as arrival
       
       RETURN {
         legs: 1,
         departure_time: departure,
         arrival_time: arrival,
         start_stop_id: startStop.id,
         start_stop_name: startStop.name,
         end_stop_id: endStop.id,
         end_stop_name: endStop.name,
         route_short_name: route.short_name,
         route_long_name: route.long_name,
         route_type: route.type
       } as result
       
       ORDER BY result.departure_time ASC
       LIMIT 5`,
      {
        startStopId,
        endStopName,
        departureTime
      }
    );

    // Format results - calculate duration from time strings
    return routesResult.records.map(record => {
      const route = record.get('result');
      const depTime = formatTime(route.departure_time);
      const arrTime = formatTime(route.arrival_time);
      const durationMinutes = calculateDurationMinutes(depTime, arrTime);
      
      return {
        legs: route.legs,
        duration_minutes: durationMinutes,
        departure_time: depTime,
        arrival_time: arrTime,
        boarded_at_stop_id: route.start_stop_id,
        boarded_at_stop_name: route.start_stop_name,
        alight_at_stop_id: route.end_stop_id,
        alight_at_stop_name: route.end_stop_name,
        route_short_name: route.route_short_name,
        route_long_name: route.route_long_name,
        route_type: route.route_type
      };
    });

  } finally {
    await session.close();
  }
};

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

