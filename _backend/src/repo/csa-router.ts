import { Driver } from 'neo4j-driver';

export interface Connection {
  departure_stop: string;
  arrival_stop: string;
  departure_time: number;
  arrival_time: number;
  trip_id: string;
}

export interface StopData {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface TripData {
  id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
}

export class CSARouter {
  private connections: Connection[] = [];
  private backwardConnections: Connection[] = [];
  private stops = new Map<string, StopData>();
  private trips = new Map<string, TripData>();
  public ready = false;

  private timeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    if (parts.length !== 3) return -1;
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  private secondsToTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async loadGraph(driver: Driver) {
    console.log('[CSA] Loading graph from Neo4j...');
    console.time('[CSA] Total load time');
    const session = driver.session();
    try {
      // 1. Load Stops
      console.time('[CSA] Load Stops');
      const stopResult = await session.run(`MATCH (s:Stop) RETURN s.id as id, s.name as name, s.latitude as lat, s.longitude as lon`);
      for (const record of stopResult.records) {
        this.stops.set(record.get('id'), {
          id: record.get('id'),
          name: record.get('name'),
          lat: record.get('lat'),
          lon: record.get('lon')
        });
      }
      console.timeEnd('[CSA] Load Stops');

      // 2. Load Trips
      console.time('[CSA] Load Trips');
      const tripResult = await session.run(`
        MATCH (t:Trip)-[:ON_ROUTE]->(r:Route) 
        RETURN t.id as id, r.short_name as short_name, r.long_name as long_name, r.type as type
      `);
      for (const record of tripResult.records) {
        this.trips.set(record.get('id'), {
          id: record.get('id'),
          route_short_name: record.get('short_name') || '',
          route_long_name: record.get('long_name') || '',
          route_type: record.get('type') ? (typeof record.get('type').toNumber === 'function' ? record.get('type').toNumber() : Number(record.get('type'))) : 3
        });
      }
      console.timeEnd('[CSA] Load Trips');

      // 3. Load Connections
      console.time('[CSA] Load Connections');
      // Stream connections
      const connResult = await session.run(`
        MATCH (st1:StopTime)-[:NEXT_STOP]->(st2:StopTime)
        RETURN st1.stop_id as dep_stop, st2.stop_id as arr_stop, 
               st1.departure_time as dep_time, st2.arrival_time as arr_time, 
               st1.trip_id as trip_id
      `);
      
      const conns: Connection[] = [];
      for (const record of connResult.records) {
        const depTime = this.timeToSeconds(record.get('dep_time'));
        const arrTime = this.timeToSeconds(record.get('arr_time'));
        if (depTime !== -1 && arrTime !== -1) {
          conns.push({
            departure_stop: record.get('dep_stop'),
            arrival_stop: record.get('arr_stop'),
            departure_time: depTime,
            arrival_time: arrTime,
            trip_id: record.get('trip_id')
          });
        }
      }
      
      // Sort connections by departure time ascending
      console.log(`[CSA] Sorting ${conns.length} connections...`);
      conns.sort((a, b) => a.departure_time - b.departure_time);
      this.connections = conns;
      this.backwardConnections = [...conns].sort((a, b) => b.arrival_time - a.arrival_time);
      console.timeEnd('[CSA] Load Connections');
      
      this.ready = true;
      console.log(`[CSA] Graph loaded successfully. Stops: ${this.stops.size}, Trips: ${this.trips.size}, Connections: ${this.connections.length}`);
    } finally {
      await session.close();
      console.timeEnd('[CSA] Total load time');
    }
  }

  private getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // radius of the earth in m
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return Math.round(R * c);
  }

  // Find all stops within maxMeters, plus walking time in seconds
  private findStopsWithinRadius(lat: number, lon: number, maxMeters: number): Array<{stop: StopData, walkTime: number}> {
    const WALK_SPEED_M_S = 1.4; // approx 5km/h
    const results = [];
    for (const stop of this.stops.values()) {
      const dist = this.getDistanceMeters(lat, lon, stop.lat, stop.lon);
      if (dist <= maxMeters) {
        results.push({ stop, walkTime: Math.round(dist / WALK_SPEED_M_S) });
      }
    }
    
    // Fallback: if none found within radius, find the absolute nearest stop
    if (results.length === 0) {
      let nearest: StopData | null = null;
      let minDist = Infinity;
      for (const stop of this.stops.values()) {
        const dist = this.getDistanceMeters(lat, lon, stop.lat, stop.lon);
        if (dist < minDist) {
          minDist = dist;
          nearest = stop;
        }
      }
      if (nearest) {
        results.push({ stop: nearest, walkTime: Math.round(minDist / WALK_SPEED_M_S) });
      }
    }
    return results;
  }

  // Standard CSA with walking legs
  findRoute(startLat: number, startLon: number, endLat: number, endLon: number, startTimeStr: string): any {
    if (!this.ready) throw new Error("CSA Router not initialized");

    const startTime = this.timeToSeconds(startTimeStr);
    const MAX_WALK_METERS = 1500;
    
    // Direct walking check
    const directWalkDist = this.getDistanceMeters(startLat, startLon, endLat, endLon);
    const directWalkTime = Math.round(directWalkDist / 1.4);

    const startStops = this.findStopsWithinRadius(startLat, startLon, MAX_WALK_METERS);
    const endStops = this.findStopsWithinRadius(endLat, endLon, MAX_WALK_METERS);

    if (startStops.length === 0 || endStops.length === 0) {
        console.log(`[CSA] Could not resolve stops`);
        return [];
    }

    // State arrays keyed by stop name (to allow transfers between platforms of the same stop)
    const earliestArrival = new Map<string, number>();
    const inConnection = new Map<string, Connection>();
    const tripReached = new Set<string>(); // Tracks trips we have boarded
    const walkToStart = new Map<string, number>(); // Tracks walk time to start stop

    for (const stop of this.stops.values()) {
      earliestArrival.set(stop.name, Infinity);
    }
    
    // Initialize earliest arrival for all reachable start stops
    for (const { stop, walkTime } of startStops) {
      const arr = startTime + walkTime;
      const existing = earliestArrival.get(stop.name)!;
      if (arr < existing) {
        earliestArrival.set(stop.name, arr);
        walkToStart.set(stop.name, walkTime);
      }
    }

    let connsEvaluated = 0;
    // Run Connection Scan
    for (const c of this.connections) {
      if (c.departure_time < startTime) continue;
      connsEvaluated++;
      
      const depStopName = this.stops.get(c.departure_stop)?.name;
      const arrStopName = this.stops.get(c.arrival_stop)?.name;
      if (!depStopName || !arrStopName) continue;

      // We can take this connection IF we arrived at the departure stop before it leaves,
      // OR we are already on this trip.
      const canTake = earliestArrival.get(depStopName)! <= c.departure_time || tripReached.has(c.trip_id);

      if (canTake) {
        // Did we improve the arrival time at the destination stop?
        if (c.arrival_time < earliestArrival.get(arrStopName)!) {
          earliestArrival.set(arrStopName, c.arrival_time);
          inConnection.set(arrStopName, c);
          tripReached.add(c.trip_id);
        }
      }
    }

    // Find the best end stop that minimizes (arrival at stop + walk to destination)
    let bestTotalTime = Infinity;
    let bestEndStopName: string | null = null;
    let finalWalkTime = 0;

    for (const { stop, walkTime } of endStops) {
      const arr = earliestArrival.get(stop.name)!;
      if (arr !== Infinity) {
        const total = arr + walkTime;
        if (total < bestTotalTime) {
          bestTotalTime = total;
          bestEndStopName = stop.name;
          finalWalkTime = walkTime;
        }
      }
    }

    const transitTotalTime = bestTotalTime - startTime;
    
    // Check if direct walk is faster
    if (directWalkTime < transitTotalTime && directWalkTime < bestTotalTime) {
      const arrTime = startTime + directWalkTime;
      return [{
        legs: [{
          board_stop_id: 'START', board_stop_name: 'Origin',
          alight_stop_id: 'END', alight_stop_name: 'Destination',
          departure_time: this.secondsToTime(startTime),
          arrival_time: this.secondsToTime(arrTime),
          route_short_name: 'Walk', route_long_name: 'Walking',
          route_type: 99
        }],
        total_duration_minutes: Math.round(directWalkTime / 60),
        departure_time: this.secondsToTime(startTime),
        arrival_time: this.secondsToTime(arrTime),
        num_transfers: 0
      }];
    }

    if (bestTotalTime === Infinity || !bestEndStopName) {
      return []; // No route found
    }

    console.log(`[CSA] Evaluated ${connsEvaluated} connections. Best arrival: ${this.secondsToTime(bestTotalTime)}`);

    // Reconstruct path
    const legs = [];
    let currentStopName = bestEndStopName;
    let currentConn = inConnection.get(currentStopName);
    
    while (currentConn) {
      legs.unshift(currentConn);
      const depStopName = this.stops.get(currentConn.departure_stop)!.name;
      currentConn = inConnection.get(depStopName);
      // Fallback to prevent infinite loops if data has cycles
      if (legs.length > 100) break;
    }

    // Convert raw legs into formatted output (grouping by trip_id)
    const groupedLegs = [];
    
    // 1. Initial Walking Leg (if applicable)
    const firstTransitStopName = legs.length > 0 ? this.stops.get(legs[0].departure_stop)!.name : bestEndStopName;
    const initialWalk = walkToStart.get(firstTransitStopName);
    if (initialWalk && initialWalk > 0) {
      groupedLegs.push({
        board_stop_id: 'START',
        board_stop_name: 'Origin',
        alight_stop_id: legs.length > 0 ? legs[0].departure_stop : 'END',
        alight_stop_name: firstTransitStopName,
        departure_time: this.secondsToTime(startTime),
        arrival_time: this.secondsToTime(startTime + initialWalk),
        route_short_name: 'Walk',
        route_long_name: 'Walking',
        route_type: 99
      });
    }

    if (legs.length > 0) {
      let currentTrip = legs[0].trip_id;
      let startLeg = legs[0];
      let lastLeg = legs[0];

      for (let i = 1; i < legs.length; i++) {
        if (legs[i].trip_id === currentTrip) {
          lastLeg = legs[i];
        } else {
          // Trip changed, push the merged leg
          const tripInfo = this.trips.get(currentTrip)!;
          groupedLegs.push({
            board_stop_id: startLeg.departure_stop,
            board_stop_name: this.stops.get(startLeg.departure_stop)?.name || '',
            alight_stop_id: lastLeg.arrival_stop,
            alight_stop_name: this.stops.get(lastLeg.arrival_stop)?.name || '',
            departure_time: this.secondsToTime(startLeg.departure_time),
            arrival_time: this.secondsToTime(lastLeg.arrival_time),
            route_short_name: tripInfo.route_short_name,
            route_long_name: tripInfo.route_long_name,
            route_type: tripInfo.route_type
          });

          currentTrip = legs[i].trip_id;
          startLeg = legs[i];
          lastLeg = legs[i];
        }
      }
      // Push final trip
      const tripInfo = this.trips.get(currentTrip)!;
      groupedLegs.push({
        board_stop_id: startLeg.departure_stop,
        board_stop_name: this.stops.get(startLeg.departure_stop)?.name || '',
        alight_stop_id: lastLeg.arrival_stop,
        alight_stop_name: this.stops.get(lastLeg.arrival_stop)?.name || '',
        departure_time: this.secondsToTime(startLeg.departure_time),
        arrival_time: this.secondsToTime(lastLeg.arrival_time),
        route_short_name: tripInfo.route_short_name,
        route_long_name: tripInfo.route_long_name,
        route_type: tripInfo.route_type
      });
    }

    // 3. Final Walking Leg (if applicable)
    if (finalWalkTime > 0) {
      const lastArrivalTime = earliestArrival.get(bestEndStopName)!;
      groupedLegs.push({
        board_stop_id: legs.length > 0 ? legs[legs.length - 1].arrival_stop : 'START',
        board_stop_name: bestEndStopName,
        alight_stop_id: 'END',
        alight_stop_name: 'Destination',
        departure_time: this.secondsToTime(lastArrivalTime),
        arrival_time: this.secondsToTime(lastArrivalTime + finalWalkTime),
        route_short_name: 'Walk',
        route_long_name: 'Walking',
        route_type: 99
      });
    }

    return [{
      legs: groupedLegs,
      total_duration_minutes: Math.round((bestTotalTime - startTime) / 60),
      departure_time: this.secondsToTime(startTime),
      arrival_time: this.secondsToTime(bestTotalTime),
      num_transfers: Math.max(0, groupedLegs.filter(l => l.route_type !== 99).length - 1)
    }];
  }
  // Backward CSA (Arrival Time)
  findReverseRoute(startLat: number, startLon: number, endLat: number, endLon: number, targetTimeStr: string): any {
    if (!this.ready) throw new Error("CSA Router not initialized");

    const targetTime = this.timeToSeconds(targetTimeStr);
    const MAX_WALK_METERS = 1500;
    
    // Direct walking check
    const directWalkDist = this.getDistanceMeters(startLat, startLon, endLat, endLon);
    const directWalkTime = Math.round(directWalkDist / 1.4);

    const startStops = this.findStopsWithinRadius(startLat, startLon, MAX_WALK_METERS);
    const endStops = this.findStopsWithinRadius(endLat, endLon, MAX_WALK_METERS);

    if (startStops.length === 0 || endStops.length === 0) {
        console.log(`[CSA Reverse] Could not resolve stops`);
        return [];
    }

    // State arrays keyed by stop name
    const latestDeparture = new Map<string, number>();
    const outConnection = new Map<string, Connection>(); // Connection departing this stop
    const tripReached = new Set<string>();
    const walkToEnd = new Map<string, number>();

    for (const stop of this.stops.values()) {
      latestDeparture.set(stop.name, -Infinity);
    }
    
    // Initialize latest departure for all reachable end stops
    for (const { stop, walkTime } of endStops) {
      const dep = targetTime - walkTime;
      const existing = latestDeparture.get(stop.name)!;
      if (dep > existing) {
        latestDeparture.set(stop.name, dep);
        walkToEnd.set(stop.name, walkTime);
      }
    }

    let connsEvaluated = 0;
    // Run Backward Connection Scan
    for (const c of this.backwardConnections) {
      if (c.arrival_time > targetTime) continue;
      connsEvaluated++;
      
      const depStopName = this.stops.get(c.departure_stop)?.name;
      const arrStopName = this.stops.get(c.arrival_stop)?.name;
      if (!depStopName || !arrStopName) continue;

      // We can take this connection backwards IF we depart the arrival stop after it arrives,
      // OR we are already on this trip.
      const canTake = latestDeparture.get(arrStopName)! >= c.arrival_time || tripReached.has(c.trip_id);

      if (canTake) {
        // Did we improve the departure time at the boarding stop?
        if (c.departure_time > latestDeparture.get(depStopName)!) {
          latestDeparture.set(depStopName, c.departure_time);
          outConnection.set(depStopName, c);
          tripReached.add(c.trip_id);
        }
      }
    }

    // Find the best start stop that maximizes (departure from stop - walk from origin)
    let bestTotalTime = -Infinity;
    let bestStartStopName: string | null = null;
    let initialWalkTime = 0;

    for (const { stop, walkTime } of startStops) {
      const dep = latestDeparture.get(stop.name)!;
      if (dep !== -Infinity) {
        const total = dep - walkTime;
        if (total > bestTotalTime) {
          bestTotalTime = total;
          bestStartStopName = stop.name;
          initialWalkTime = walkTime;
        }
      }
    }
    
    // Check if direct walk is faster or better
    // "directWalkTime < targetTime" is always true unless targetTime is very small
    // The metric to optimize is latest departure. If we walk directly, departure is targetTime - directWalkTime
    const directWalkDep = targetTime - directWalkTime;
    if (directWalkDep > bestTotalTime) {
      return [{
        legs: [{
          board_stop_id: 'START', board_stop_name: 'Origin',
          alight_stop_id: 'END', alight_stop_name: 'Destination',
          departure_time: this.secondsToTime(directWalkDep),
          arrival_time: this.secondsToTime(targetTime),
          route_short_name: 'Walk', route_long_name: 'Walking',
          route_type: 99
        }],
        total_duration_minutes: Math.round(directWalkTime / 60),
        departure_time: this.secondsToTime(directWalkDep),
        arrival_time: this.secondsToTime(targetTime),
        num_transfers: 0
      }];
    }

    if (bestTotalTime === -Infinity || !bestStartStopName) {
      return []; // No route found
    }

    console.log(`[CSA Reverse] Evaluated ${connsEvaluated} connections. Best departure: ${this.secondsToTime(bestTotalTime)}`);

    // Reconstruct path by tracing FORWARD from bestStartStopName
    const legs = [];
    let currentStopName = bestStartStopName;
    let currentConn = outConnection.get(currentStopName);
    
    while (currentConn) {
      legs.push(currentConn);
      const arrStopName = this.stops.get(currentConn.arrival_stop)!.name;
      currentConn = outConnection.get(arrStopName);
      if (legs.length > 100) break;
    }

    // Convert raw legs into formatted output (grouping by trip_id)
    const groupedLegs = [];
    
    // 1. Initial Walking Leg
    if (initialWalkTime > 0) {
      groupedLegs.push({
        board_stop_id: 'START',
        board_stop_name: 'Origin',
        alight_stop_id: legs.length > 0 ? legs[0].departure_stop : 'END',
        alight_stop_name: bestStartStopName,
        departure_time: this.secondsToTime(bestTotalTime),
        arrival_time: this.secondsToTime(bestTotalTime + initialWalkTime),
        route_short_name: 'Walk',
        route_long_name: 'Walking',
        route_type: 99
      });
    }

    if (legs.length > 0) {
      let currentTrip = legs[0].trip_id;
      let startLeg = legs[0];
      let lastLeg = legs[0];

      for (let i = 1; i < legs.length; i++) {
        if (legs[i].trip_id === currentTrip) {
          lastLeg = legs[i];
        } else {
          const tripInfo = this.trips.get(currentTrip)!;
          groupedLegs.push({
            board_stop_id: startLeg.departure_stop,
            board_stop_name: this.stops.get(startLeg.departure_stop)?.name || '',
            alight_stop_id: lastLeg.arrival_stop,
            alight_stop_name: this.stops.get(lastLeg.arrival_stop)?.name || '',
            departure_time: this.secondsToTime(startLeg.departure_time),
            arrival_time: this.secondsToTime(lastLeg.arrival_time),
            route_short_name: tripInfo.route_short_name,
            route_long_name: tripInfo.route_long_name,
            route_type: tripInfo.route_type
          });

          currentTrip = legs[i].trip_id;
          startLeg = legs[i];
          lastLeg = legs[i];
        }
      }
      const tripInfo = this.trips.get(currentTrip)!;
      groupedLegs.push({
        board_stop_id: startLeg.departure_stop,
        board_stop_name: this.stops.get(startLeg.departure_stop)?.name || '',
        alight_stop_id: lastLeg.arrival_stop,
        alight_stop_name: this.stops.get(lastLeg.arrival_stop)?.name || '',
        departure_time: this.secondsToTime(startLeg.departure_time),
        arrival_time: this.secondsToTime(lastLeg.arrival_time),
        route_short_name: tripInfo.route_short_name,
        route_long_name: tripInfo.route_long_name,
        route_type: tripInfo.route_type
      });
    }

    // 3. Final Walking Leg
    const finalTransitStopName = legs.length > 0 ? this.stops.get(legs[legs.length - 1].arrival_stop)!.name : bestStartStopName;
    const finalWalk = walkToEnd.get(finalTransitStopName);
    if (finalWalk && finalWalk > 0) {
      const depTime = legs.length > 0 ? legs[legs.length - 1].arrival_time : (bestTotalTime + initialWalkTime);
      groupedLegs.push({
        board_stop_id: legs.length > 0 ? legs[legs.length - 1].arrival_stop : 'START',
        board_stop_name: finalTransitStopName,
        alight_stop_id: 'END',
        alight_stop_name: 'Destination',
        departure_time: this.secondsToTime(depTime),
        arrival_time: this.secondsToTime(depTime + finalWalk),
        route_short_name: 'Walk',
        route_long_name: 'Walking',
        route_type: 99
      });
    }

    const finalArrival = groupedLegs.length > 0 ? groupedLegs[groupedLegs.length - 1].arrival_time : this.secondsToTime(targetTime);
    const totalDurationSeconds = this.timeToSeconds(finalArrival) - bestTotalTime;

    return [{
      legs: groupedLegs,
      total_duration_minutes: Math.round(totalDurationSeconds / 60),
      departure_time: this.secondsToTime(bestTotalTime),
      arrival_time: finalArrival,
      num_transfers: Math.max(0, groupedLegs.filter(l => l.route_type !== 99).length - 1)
    }];
  }
}

export const globalCSARouter = new CSARouter();
