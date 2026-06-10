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

export interface Footpath {
  from: string;
  to: string;
  walkTime: number;
}

export class CSARouter {
  private connections: Connection[] = [];
  private backwardConnections: Connection[] = [];
  private stops = new Map<string, StopData>();
  private trips = new Map<string, TripData>();
  private footpaths = new Map<string, Footpath[]>();
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

      console.time('[CSA] Compute Footpaths');
      const MAX_TRANSFER_METERS = 300;
      const WALK_SPEED = 1.4; // m/s
      const stopList = Array.from(this.stops.values());
      for (let i = 0; i < stopList.length; i++) {
        const s1 = stopList[i];
        const paths: Footpath[] = [];
        paths.push({ from: s1.id, to: s1.id, walkTime: 0 });
        for (let j = 0; j < stopList.length; j++) {
          if (i === j) continue;
          const s2 = stopList[j];
          const latDiff = Math.abs(s1.lat - s2.lat);
          const lonDiff = Math.abs(s1.lon - s2.lon);
          if (latDiff > 0.005 || lonDiff > 0.005) continue; 
          
          const dist = this.getDistanceMeters(s1.lat, s1.lon, s2.lat, s2.lon);
          if (dist <= MAX_TRANSFER_METERS) {
            paths.push({ from: s1.id, to: s2.id, walkTime: Math.round(dist / WALK_SPEED) });
          }
        }
        this.footpaths.set(s1.id, paths);
      }
      console.timeEnd('[CSA] Compute Footpaths');

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

      console.time('[CSA] Load Connections');
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
    const R = 6371e3;
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

  private findStopsWithinRadius(lat: number, lon: number, maxMeters: number): Array<{stop: StopData, walkTime: number}> {
    const WALK_SPEED_M_S = 1.4;
    const results = [];
    for (const stop of this.stops.values()) {
      const dist = this.getDistanceMeters(lat, lon, stop.lat, stop.lon);
      if (dist <= maxMeters) {
        results.push({ stop, walkTime: Math.round(dist / WALK_SPEED_M_S) });
      }
    }
    if (results.length === 0) {
      let nearest: StopData | null = null;
      let minDist = Infinity;
      for (const stop of this.stops.values()) {
        const dist = this.getDistanceMeters(lat, lon, stop.lat, stop.lon);
        if (dist < minDist) { minDist = dist; nearest = stop; }
      }
      if (nearest) { results.push({ stop: nearest, walkTime: Math.round(minDist / WALK_SPEED_M_S) }); }
    }
    return results;
  }

  findRoute(startLat: number, startLon: number, endLat: number, endLon: number, startTimeStr: string): any {
    if (!this.ready) throw new Error("CSA Router not initialized");

    const startTime = this.timeToSeconds(startTimeStr);
    const MAX_WALK_METERS = 1500;
    const TRANSFER_PENALTY = 120; // 2 minutes added to footpaths to penalize transfers
    
    const directWalkDist = this.getDistanceMeters(startLat, startLon, endLat, endLon);
    const directWalkTime = Math.round(directWalkDist / 1.4);

    const startStops = this.findStopsWithinRadius(startLat, startLon, MAX_WALK_METERS);
    const endStops = this.findStopsWithinRadius(endLat, endLon, MAX_WALK_METERS);

    if (startStops.length === 0 || endStops.length === 0) { return []; }

    const earliestArrival = new Map<string, { time: number, transfers: number }>();
    const inConnection = new Map<string, any>(); 
    const tripReached = new Set<string>();
    const walkToStart = new Map<string, number>();

    for (const stop of this.stops.keys()) {
      earliestArrival.set(stop, { time: Infinity, transfers: Infinity });
    }
    
    for (const { stop, walkTime } of startStops) {
      const arr = startTime + walkTime;
      const existing = earliestArrival.get(stop.id)!;
      if (arr < existing) {
        earliestArrival.set(stop.id, arr);
        walkToStart.set(stop.id, walkTime);
      }
    }

    let connsEvaluated = 0;
    for (const c of this.connections) {
      if (c.departure_time < startTime) continue;
      connsEvaluated++;
      
      const depStopId = c.departure_stop;
      const arrStopId = c.arrival_stop;

      const depState = earliestArrival.get(depStopId)!;
      const canTake = depState.time <= c.departure_time || tripReached.has(c.trip_id);

      if (canTake) {
        const arrState = earliestArrival.get(arrStopId)!;
        const newTransfers = tripReached.has(c.trip_id) ? depState.transfers : depState.transfers + 1;
        if (c.arrival_time < arrState.time || (c.arrival_time === arrState.time && newTransfers < arrState.transfers)) {
          earliestArrival.set(arrStopId, { time: c.arrival_time, transfers: newTransfers });
          inConnection.set(arrStopId, c);
          tripReached.add(c.trip_id);

          const paths = this.footpaths.get(arrStopId) || [];
          for (const fp of paths) {
            if (fp.from === fp.to) continue;
            const walkArr = c.arrival_time + fp.walkTime + TRANSFER_PENALTY;
            const fpState = earliestArrival.get(fp.to)!;
            if (walkArr < fpState.time || (walkArr === fpState.time && newTransfers + 1 < fpState.transfers)) {
              earliestArrival.set(fp.to, { time: walkArr, transfers: newTransfers + 1 });
              inConnection.set(fp.to, { type: 'footpath', from: fp.from, to: fp.to, walkTime: fp.walkTime, connectionTime: c.arrival_time });
            }
          }
        }
      }
    }

    let bestTotalTime = Infinity;
    let bestEndStopId: string | null = null;
    let finalWalkTime = 0;

    for (const { stop, walkTime } of endStops) {
      const arr = earliestArrival.get(stop.id)!.time;
      if (arr !== Infinity) {
        const total = arr + walkTime;
        if (total < bestTotalTime) {
          bestTotalTime = total;
          bestEndStopId = stop.id;
          finalWalkTime = walkTime;
        }
      }
    }

    const transitTotalTime = bestTotalTime - startTime;
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

    if (bestTotalTime === Infinity || !bestEndStopId) { return []; }

    const rawPath = [];
    let currentStopId = bestEndStopId;
    let currentItem = inConnection.get(currentStopId);
    
    while (currentItem) {
      rawPath.unshift(currentItem);
      if (currentItem.type === 'footpath') {
        currentStopId = currentItem.from;
      } else {
        currentStopId = currentItem.departure_stop;
      }
      currentItem = inConnection.get(currentStopId);
      if (rawPath.length > 200) break;
    }

    const groupedLegs = [];
    
    const firstTransitStopId = rawPath.length > 0 ? (rawPath[0].type === 'footpath' ? rawPath[0].from : rawPath[0].departure_stop) : bestEndStopId;
    const initialWalk = walkToStart.get(firstTransitStopId);
    if (initialWalk && initialWalk > 0) {
      groupedLegs.push({
        board_stop_id: 'START',
        board_stop_name: 'Origin',
        alight_stop_id: firstTransitStopId,
        alight_stop_name: this.stops.get(firstTransitStopId)?.name || '',
        departure_time: this.secondsToTime(startTime),
        arrival_time: this.secondsToTime(startTime + initialWalk),
        route_short_name: 'Walk',
        route_long_name: 'Walking',
        route_type: 99
      });
    }

    if (rawPath.length > 0) {
      let currentTrip = rawPath[0].trip_id;
      let startLeg = rawPath[0];
      let lastLeg = rawPath[0];

      for (let i = 1; i < rawPath.length; i++) {
        const item = rawPath[i];
        if (item.type === 'footpath') {
          if (currentTrip) {
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
            currentTrip = null;
          }
          groupedLegs.push({
            board_stop_id: item.from,
            board_stop_name: this.stops.get(item.from)?.name || '',
            alight_stop_id: item.to,
            alight_stop_name: this.stops.get(item.to)?.name || '',
            departure_time: this.secondsToTime(item.connectionTime),
            arrival_time: this.secondsToTime(item.connectionTime + item.walkTime),
            route_short_name: 'Walk',
            route_long_name: 'Transfer',
            route_type: 99
          });
        } else {
          if (item.trip_id === currentTrip) {
            lastLeg = item;
          } else {
            if (currentTrip) {
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
            currentTrip = item.trip_id;
            startLeg = item;
            lastLeg = item;
          }
        }
      }
      if (currentTrip) {
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
    }

    if (finalWalkTime > 0) {
      const lastArrivalTime = earliestArrival.get(bestEndStopId)!;
      groupedLegs.push({
        board_stop_id: rawPath.length > 0 ? (rawPath[rawPath.length - 1].type === 'footpath' ? rawPath[rawPath.length - 1].to : rawPath[rawPath.length - 1].arrival_stop) : bestEndStopId,
        board_stop_name: this.stops.get(bestEndStopId)?.name || '',
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

  findReverseRoute(startLat: number, startLon: number, endLat: number, endLon: number, targetTimeStr: string): any {
    if (!this.ready) throw new Error("CSA Router not initialized");

    const targetTime = this.timeToSeconds(targetTimeStr);
    const MAX_WALK_METERS = 1500;
    const TRANSFER_PENALTY = 120;
    
    const directWalkDist = this.getDistanceMeters(startLat, startLon, endLat, endLon);
    const directWalkTime = Math.round(directWalkDist / 1.4);

    const startStops = this.findStopsWithinRadius(startLat, startLon, MAX_WALK_METERS);
    const endStops = this.findStopsWithinRadius(endLat, endLon, MAX_WALK_METERS);

    if (startStops.length === 0 || endStops.length === 0) { return []; }

    const latestDeparture = new Map<string, { time: number, transfers: number }>();
    const outConnection = new Map<string, any>();
    const tripReached = new Set<string>();
    const walkToEnd = new Map<string, number>();

    for (const stop of this.stops.keys()) {
      latestDeparture.set(stop, { time: -Infinity, transfers: Infinity });
    }
    
    for (const { stop, walkTime } of endStops) {
      const dep = targetTime - walkTime;
      const existing = latestDeparture.get(stop.id)!;
      if (dep > existing.time) {
        latestDeparture.set(stop.id, { time: dep, transfers: 0 });
        walkToEnd.set(stop.id, walkTime);
      }
    }

    for (const c of this.backwardConnections) {
      if (c.arrival_time > targetTime) continue;
      
      const depStopId = c.departure_stop;
      const arrStopId = c.arrival_stop;

      const arrState = latestDeparture.get(arrStopId)!;
      const canTake = arrState.time >= c.arrival_time || tripReached.has(c.trip_id);

      if (canTake) {
        const depState = latestDeparture.get(depStopId)!;
        const newTransfers = tripReached.has(c.trip_id) ? arrState.transfers : arrState.transfers + 1;
        if (c.departure_time > depState.time || (c.departure_time === depState.time && newTransfers < depState.transfers)) {
          latestDeparture.set(depStopId, { time: c.departure_time, transfers: newTransfers });
          outConnection.set(depStopId, c);
          tripReached.add(c.trip_id);

          const paths = this.footpaths.get(depStopId) || [];
          for (const fp of paths) {
            if (fp.from === fp.to) continue;
            // Reverse direction: we are walking from fp.to to depStopId
            // So departure from fp.to must be (c.departure_time - walkTime - penalty)
            const walkDep = c.departure_time - fp.walkTime - TRANSFER_PENALTY;
            const fpState = latestDeparture.get(fp.to)!;
            if (walkDep > fpState.time || (walkDep === fpState.time && newTransfers + 1 < fpState.transfers)) {
              latestDeparture.set(fp.to, { time: walkDep, transfers: newTransfers + 1 });
              outConnection.set(fp.to, { type: 'footpath', from: fp.to, to: depStopId, walkTime: fp.walkTime, connectionTime: c.departure_time });
            }
          }
        }
      }
    }

    let bestTotalTime = -Infinity;
    let bestStartStopId: string | null = null;
    let initialWalkTime = 0;

    for (const { stop, walkTime } of startStops) {
      const dep = latestDeparture.get(stop.id)!.time;
      if (dep !== -Infinity) {
        const total = dep - walkTime;
        if (total > bestTotalTime) {
          bestTotalTime = total;
          bestStartStopId = stop.id;
          initialWalkTime = walkTime;
        }
      }
    }
    
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

    if (bestTotalTime === -Infinity || !bestStartStopId) { return []; }

    const rawPath = [];
    let currentStopId = bestStartStopId;
    let currentItem = outConnection.get(currentStopId);
    
    while (currentItem) {
      rawPath.push(currentItem);
      if (currentItem.type === 'footpath') {
        currentStopId = currentItem.to;
      } else {
        currentStopId = currentItem.arrival_stop;
      }
      currentItem = outConnection.get(currentStopId);
      if (rawPath.length > 200) break;
    }

    const groupedLegs = [];
    
    if (initialWalkTime > 0) {
      groupedLegs.push({
        board_stop_id: 'START',
        board_stop_name: 'Origin',
        alight_stop_id: bestStartStopId,
        alight_stop_name: this.stops.get(bestStartStopId)?.name || '',
        departure_time: this.secondsToTime(bestTotalTime),
        arrival_time: this.secondsToTime(bestTotalTime + initialWalkTime),
        route_short_name: 'Walk',
        route_long_name: 'Walking',
        route_type: 99
      });
    }

    if (rawPath.length > 0) {
      let currentTrip = rawPath[0].trip_id;
      let startLeg = rawPath[0];
      let lastLeg = rawPath[0];

      for (let i = 1; i < rawPath.length; i++) {
        const item = rawPath[i];
        if (item.type === 'footpath') {
          if (currentTrip) {
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
            currentTrip = null;
          }
          groupedLegs.push({
            board_stop_id: item.from,
            board_stop_name: this.stops.get(item.from)?.name || '',
            alight_stop_id: item.to,
            alight_stop_name: this.stops.get(item.to)?.name || '',
            departure_time: this.secondsToTime(item.connectionTime - item.walkTime),
            arrival_time: this.secondsToTime(item.connectionTime),
            route_short_name: 'Walk',
            route_long_name: 'Transfer',
            route_type: 99
          });
        } else {
          if (item.trip_id === currentTrip) {
            lastLeg = item;
          } else {
            if (currentTrip) {
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
            currentTrip = item.trip_id;
            startLeg = item;
            lastLeg = item;
          }
        }
      }
      if (currentTrip) {
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
    }

    const finalTransitStopId = rawPath.length > 0 ? (rawPath[rawPath.length - 1].type === 'footpath' ? rawPath[rawPath.length - 1].to : rawPath[rawPath.length - 1].arrival_stop) : bestStartStopId;
    const finalWalk = walkToEnd.get(finalTransitStopId);
    if (finalWalk && finalWalk > 0) {
      const depTime = rawPath.length > 0 ? (rawPath[rawPath.length - 1].type === 'footpath' ? rawPath[rawPath.length - 1].connectionTime : rawPath[rawPath.length - 1].arrival_time) : (bestTotalTime + initialWalkTime);
      groupedLegs.push({
        board_stop_id: finalTransitStopId,
        board_stop_name: this.stops.get(finalTransitStopId)?.name || '',
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
