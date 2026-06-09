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
      console.timeEnd('[CSA] Load Connections');
      
      this.ready = true;
      console.log(`[CSA] Graph loaded successfully. Stops: ${this.stops.size}, Trips: ${this.trips.size}, Connections: ${this.connections.length}`);
    } finally {
      await session.close();
      console.timeEnd('[CSA] Total load time');
    }
  }

  // Geocoding: Find nearest stop
  findNearestStop(lat: number, lon: number): StopData | null {
    let nearest: StopData | null = null;
    let minDist = Infinity;
    
    // Simple Euclidean distance for rough estimation (valid for small regions)
    for (const stop of this.stops.values()) {
      const dLat = stop.lat - lat;
      const dLon = stop.lon - lon;
      const dist = dLat*dLat + dLon*dLon;
      if (dist < minDist) {
        minDist = dist;
        nearest = stop;
      }
    }
    return nearest;
  }

  // Standard CSA
  findRoute(startLat: number, startLon: number, endLat: number, endLon: number, startTimeStr: string): any {
    if (!this.ready) throw new Error("CSA Router not initialized");

    const startStop = this.findNearestStop(startLat, startLon);
    const endStop = this.findNearestStop(endLat, endLon);

    if (!startStop || !endStop) {
        console.log(`[CSA] Could not resolve stops`);
        return [];
    }

    console.log(`[CSA] Routing from ${startStop.name} to ${endStop.name}`);

    const startTime = this.timeToSeconds(startTimeStr);
    
    // State arrays keyed by stop name (to allow transfers between platforms of the same stop)
    const earliestArrival = new Map<string, number>();
    const inConnection = new Map<string, Connection>();
    const tripReached = new Set<string>(); // Tracks trips we have boarded

    for (const stop of this.stops.values()) {
      earliestArrival.set(stop.name, Infinity);
    }
    earliestArrival.set(startStop.name, startTime);

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

    console.log(`[CSA] Evaluated ${connsEvaluated} connections. Dest arrival: ${earliestArrival.get(endStop.name)}`);

    // Reconstruct path
    if (earliestArrival.get(endStop.name) === Infinity) {
      return []; // No route found
    }

    const legs = [];
    let currentStopName = endStop.name;
    let currentConn = inConnection.get(currentStopName);
    
    while (currentConn) {
      legs.unshift(currentConn);
      const depStopName = this.stops.get(currentConn.departure_stop)!.name;
      if (depStopName === startStop.name) {
          break;
      }
      currentConn = inConnection.get(depStopName);
      // Fallback to prevent infinite loops if data has cycles
      if (legs.length > 100) break;
    }

    // Convert raw legs into formatted output (grouping by trip_id)
    const groupedLegs = [];
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

    const totalDuration = earliestArrival.get(endStop.name)! - startTime;
    return [{
      legs: groupedLegs,
      total_duration_minutes: Math.round(totalDuration / 60),
      departure_time: this.secondsToTime(startTime),
      arrival_time: this.secondsToTime(earliestArrival.get(endStop.name)!),
      num_transfers: Math.max(0, groupedLegs.length - 1)
    }];
  }
}

export const globalCSARouter = new CSARouter();
