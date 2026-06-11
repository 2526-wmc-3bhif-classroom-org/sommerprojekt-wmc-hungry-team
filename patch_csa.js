const fs = require('fs');
let code = fs.readFileSync('_backend/src/repo/csa-router.ts', 'utf8');

// Modify the latestDeparture check to heavily penalize wait time!
// We'll add a 'transfers' tracking object or just penalize wait times in the scan.

code = code.replace(
  `const latestDeparture = new Map<string, number>();`,
  `const latestDeparture = new Map<string, { time: number, transfers: number }>();`
);

code = code.replace(
  `for (const stop of this.stops.keys()) {\n      latestDeparture.set(stop, -Infinity);\n    }`,
  `for (const stop of this.stops.keys()) {\n      latestDeparture.set(stop, { time: -Infinity, transfers: Infinity });\n    }`
);

code = code.replace(
  `const existing = latestDeparture.get(stop.id)!;\n      if (dep > existing) {\n        latestDeparture.set(stop.id, dep);\n        walkToEnd.set(stop.id, walkTime);\n      }`,
  `const existing = latestDeparture.get(stop.id)!;\n      if (dep > existing.time) {\n        latestDeparture.set(stop.id, { time: dep, transfers: 0 });\n        walkToEnd.set(stop.id, walkTime);\n      }`
);

code = code.replace(
  `const canTake = latestDeparture.get(arrStopId)! >= c.arrival_time || tripReached.has(c.trip_id);`,
  `const arrState = latestDeparture.get(arrStopId)!;
      const canTake = arrState.time >= c.arrival_time || tripReached.has(c.trip_id);`
);

code = code.replace(
  `if (c.departure_time > latestDeparture.get(depStopId)!) {\n          latestDeparture.set(depStopId, c.departure_time);`,
  `const depState = latestDeparture.get(depStopId)!;
        const newTransfers = tripReached.has(c.trip_id) ? arrState.transfers : arrState.transfers + 1;
        if (c.departure_time > depState.time || (c.departure_time === depState.time && newTransfers < depState.transfers)) {
          latestDeparture.set(depStopId, { time: c.departure_time, transfers: newTransfers });`
);

code = code.replace(
  `if (walkDep > latestDeparture.get(fp.to)!) {\n              latestDeparture.set(fp.to, walkDep);`,
  `const fpState = latestDeparture.get(fp.to)!;
            if (walkDep > fpState.time || (walkDep === fpState.time && newTransfers + 1 < fpState.transfers)) {
              latestDeparture.set(fp.to, { time: walkDep, transfers: newTransfers + 1 });`
);

code = code.replace(
  `const dep = latestDeparture.get(stop.id)!;\n      if (dep !== -Infinity) {`,
  `const dep = latestDeparture.get(stop.id)!.time;\n      if (dep !== -Infinity) {`
);

fs.writeFileSync('_backend/src/repo/csa-router.ts', code);
