const fs = require('fs');
let code = fs.readFileSync('_backend/src/repo/csa-router.ts', 'utf8');

code = code.replace(
  `const earliestArrival = new Map<string, number>();`,
  `const earliestArrival = new Map<string, { time: number, transfers: number }>();`
);

code = code.replace(
  `for (const stop of this.stops.keys()) {\n      earliestArrival.set(stop, Infinity);\n    }`,
  `for (const stop of this.stops.keys()) {\n      earliestArrival.set(stop, { time: Infinity, transfers: Infinity });\n    }`
);

code = code.replace(
  `const existing = earliestArrival.get(stop.id)!;\n      if (arr < existing) {\n        earliestArrival.set(stop.id, arr);\n        walkFromStart.set(stop.id, walkTime);\n      }`,
  `const existing = earliestArrival.get(stop.id)!;\n      if (arr < existing.time) {\n        earliestArrival.set(stop.id, { time: arr, transfers: 0 });\n        walkFromStart.set(stop.id, walkTime);\n      }`
);

code = code.replace(
  `const canTake = earliestArrival.get(depStopId)! <= c.departure_time || tripReached.has(c.trip_id);`,
  `const depState = earliestArrival.get(depStopId)!;
      const canTake = depState.time <= c.departure_time || tripReached.has(c.trip_id);`
);

code = code.replace(
  `if (c.arrival_time < earliestArrival.get(arrStopId)!) {\n          earliestArrival.set(arrStopId, c.arrival_time);`,
  `const arrState = earliestArrival.get(arrStopId)!;
        const newTransfers = tripReached.has(c.trip_id) ? depState.transfers : depState.transfers + 1;
        if (c.arrival_time < arrState.time || (c.arrival_time === arrState.time && newTransfers < arrState.transfers)) {
          earliestArrival.set(arrStopId, { time: c.arrival_time, transfers: newTransfers });`
);

code = code.replace(
  `if (walkArr < earliestArrival.get(fp.to)!) {\n              earliestArrival.set(fp.to, walkArr);`,
  `const fpState = earliestArrival.get(fp.to)!;
            if (walkArr < fpState.time || (walkArr === fpState.time && newTransfers + 1 < fpState.transfers)) {
              earliestArrival.set(fp.to, { time: walkArr, transfers: newTransfers + 1 });`
);

code = code.replace(
  `const arr = earliestArrival.get(stop.id)!;\n      if (arr !== Infinity) {`,
  `const arr = earliestArrival.get(stop.id)!.time;\n      if (arr !== Infinity) {`
);

fs.writeFileSync('_backend/src/repo/csa-router.ts', code);
