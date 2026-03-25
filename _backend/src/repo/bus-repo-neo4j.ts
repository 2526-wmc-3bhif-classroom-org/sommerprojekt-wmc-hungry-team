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
    // Step 1: Find closest start stop
    const startStopResult = await session.run(
      `MATCH (s:Stop)
       WITH s, point({latitude: s.latitude, longitude: s.longitude}) as stop_point,
            point({latitude: $lat, longitude: $lon}) as search_point
       RETURN s.id as stop_id, s.name as stop_name
       ORDER BY distance(stop_point, search_point)
       LIMIT 1`,
      { lat: startLat, lon: startLon }
    );

    // Step 2: Find closest end stop
    const endStopResult = await session.run(
      `MATCH (s:Stop)
       WITH s, point({latitude: s.latitude, longitude: s.longitude}) as stop_point,
            point({latitude: $lat, longitude: $lon}) as search_point
       RETURN s.id as stop_id, s.name as stop_name
       ORDER BY distance(stop_point, search_point)
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

    const routesResult = await session.run(
      `MATCH (startStop:Stop {id: $startStopId})
       MATCH (endStop:Stop {id: $endStopId})
       
       // Find all viable trips departing after the requested time
       MATCH (startStop)<-[:AT_STOP]-(st1:StopTime)
       WHERE time(st1.departure_time) >= time($departureTime)
       
       // Find reachable end stop with up to maxLegs
       WITH startStop, endStop, st1, 
            [startStop, st1] as current_path, 
            0 as num_transfers
       
       CALL {
         WITH startStop, endStop, st1, current_path, num_transfers, $maxLegs as maxLegs
         
         MATCH (st1)-[:NEXT_STOP*0..100]->(st_end:StopTime)-[:AT_STOP]->(endStop)
         WHERE st_end.trip_id = st1.trip_id
         
         RETURN st1 as first_st, st_end as final_st, 1 as legs, 
                [st1, st_end] as path_nodes, st1.departure_time as departure,
                st_end.arrival_time as arrival
         
         UNION
         
         // Handle transfers
         MATCH (st1)-[:NEXT_STOP*0..100]->(st_transfer:StopTime)
         WHERE st1.trip_id = st_transfer.trip_id
         AND num_transfers < $maxLegs - 1
         
         WITH st_transfer, startStop, endStop, current_path, num_transfers + 1 as next_transfers,
              $maxLegs as maxLegs, st1.departure_time as departure
         
         MATCH (transfer_stop:Stop)<-[:AT_STOP]-(st_transfer)
         MATCH (transfer_stop)<-[:AT_STOP]-(st2:StopTime)
         WHERE st2.trip_id <> st_transfer.trip_id
         AND time(st2.departure_time) >= time(st_transfer.arrival_time) + duration('PT3M')
         AND time(st2.departure_time) < time('23:59:59')
         
         MATCH (st2)-[:NEXT_STOP*0..100]->(st_end:StopTime)-[:AT_STOP]->(endStop)
         WHERE st_end.trip_id = st2.trip_id
         
         RETURN st1 as first_st, st_end as final_st, next_transfers + 1 as legs,
                [st_transfer, st2, st_end] as path_nodes, departure,
                st_end.arrival_time as arrival
       }
       
       WITH first_st, final_st, legs, path_nodes, departure, arrival,
            duration.between(time(departure), time(arrival)).minutes as duration_minutes
       
       // Enrich with route information
       MATCH (trip1:Trip)-[:STOPS_AT]->(first_st)
       MATCH (trip1)-[:ON_ROUTE]->(route1:Route)
       
       RETURN {
         legs: legs,
         duration_minutes: duration_minutes,
         departure_time: departure,
         arrival_time: arrival,
         start_stop_id: $startStopId,
         start_stop_name: startStop.name,
         end_stop_id: $endStopId,
         end_stop_name: endStop.name,
         route_short_name: route1.short_name,
         route_long_name: route1.long_name,
         route_type: route1.type
       }
       
       ORDER BY legs ASC, duration_minutes ASC, departure ASC
       LIMIT 5`,
      {
        startStopId,
        endStopId,
        departureTime,
        maxLegs
      }
    );

    // Format results
    return routesResult.records.map(record => {
      const route = record.get(0);
      return {
        legs: route.legs,
        duration_minutes: route.duration_minutes,
        departure_time: formatTime(route.departure_time),
        arrival_time: formatTime(route.arrival_time),
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
function formatTime(timeValue) {
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
 * Test Neo4j connection
 */
export const testNeo4jConnection = async () => {
  const session = getNeo4jSession();
  try {
    const result = await session.run('MATCH (a:Agency) RETURN count(a) as count');
    return result.records;
  } finally {
    await session.close();
  }
};

