import { randomUUID } from 'crypto';
import { getDb } from '../db/sqlite.js';

export interface RoutineRecord {
  id: string;
  user_id: string;
  name: string;
  start_time: string;
  end_time: string;
  transport_mode: string;
  destination: string;
  start_address: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface RoutineResponse {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  transportMode: string;
  destination: string;
  startAddress: string;
  days: number[];
  config: unknown;
  createdAt: string;
  updatedAt: string;
}

export function listRoutines(userId: string): RoutineResponse[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT r.*, rd.day_of_week
     FROM routines r
     LEFT JOIN routine_days rd ON rd.routine_id = r.id
     WHERE r.user_id = ?
     ORDER BY r.created_at ASC`
  ).all(userId) as Array<RoutineRecord & { day_of_week: number | null }>;

  const map = new Map<string, RoutineResponse>();

  rows.forEach((row) => {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        name: row.name,
        startTime: row.start_time,
        endTime: row.end_time,
        transportMode: row.transport_mode,
        destination: row.destination,
        startAddress: row.start_address,
        days: [],
        config: JSON.parse(row.config_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }

    if (row.day_of_week !== null) {
      map.get(row.id)?.days.push(row.day_of_week);
    }
  });

  return Array.from(map.values()).map((routine) => ({
    ...routine,
    days: Array.from(new Set(routine.days)).sort()
  }));
}

export function createRoutine(params: {
  userId: string;
  name: string;
  startTime: string;
  endTime: string;
  transportMode?: string;
  destination?: string;
  startAddress?: string;
  days: number[];
  config: unknown;
}): RoutineResponse {
  const db = getDb();
  const now = new Date().toISOString();
  const routineId = randomUUID();
  const configJson = JSON.stringify(params.config ?? {});

  const transportMode = params.transportMode ?? 'bus';
  const destination = params.destination ?? '';
  const startAddress = params.startAddress ?? '';

  const insertRoutine = db.prepare(
    `INSERT INTO routines (id, user_id, name, start_time, end_time, transport_mode, destination, start_address, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDay = db.prepare(
    `INSERT INTO routine_days (routine_id, day_of_week) VALUES (?, ?)`
  );

  const tx = db.transaction(() => {
    insertRoutine.run(
      routineId,
      params.userId,
      params.name,
      params.startTime,
      params.endTime,
      transportMode,
      destination,
      startAddress,
      configJson,
      now,
      now
    );

    params.days.forEach((day) => {
      insertDay.run(routineId, day);
    });
  });

  tx();

  return {
    id: routineId,
    name: params.name,
    startTime: params.startTime,
    endTime: params.endTime,
    transportMode,
    destination,
    startAddress,
    days: params.days,
    config: params.config ?? {},
    createdAt: now,
    updatedAt: now
  };
}

export function updateRoutine(params: {
  routineId: string;
  userId: string;
  name: string;
  startTime: string;
  endTime: string;
  transportMode?: string;
  destination?: string;
  startAddress?: string;
  days: number[];
  config: unknown;
}): RoutineResponse | null {
  const db = getDb();
  const now = new Date().toISOString();
  const configJson = JSON.stringify(params.config ?? {});

  const existing = db.prepare(
    `SELECT * FROM routines WHERE id = ? AND user_id = ?`
  ).get(params.routineId, params.userId) as RoutineRecord | undefined;

  if (!existing) {
    return null;
  }

  const transportMode = params.transportMode ?? existing.transport_mode;
  const destination = params.destination ?? existing.destination;
  const startAddress = params.startAddress ?? existing.start_address;

  const updateRoutineStmt = db.prepare(
    `UPDATE routines
     SET name = ?, start_time = ?, end_time = ?, transport_mode = ?, destination = ?, start_address = ?, config_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  );
  const deleteDays = db.prepare('DELETE FROM routine_days WHERE routine_id = ?');
  const insertDay = db.prepare('INSERT INTO routine_days (routine_id, day_of_week) VALUES (?, ?)');

  const tx = db.transaction(() => {
    updateRoutineStmt.run(
      params.name,
      params.startTime,
      params.endTime,
      transportMode,
      destination,
      startAddress,
      configJson,
      now,
      params.routineId,
      params.userId
    );
    deleteDays.run(params.routineId);
    params.days.forEach((day) => {
      insertDay.run(params.routineId, day);
    });
  });

  tx();

  return {
    id: params.routineId,
    name: params.name,
    startTime: params.startTime,
    endTime: params.endTime,
    transportMode,
    destination,
    startAddress,
    days: params.days,
    config: params.config ?? {},
    createdAt: existing.created_at,
    updatedAt: now
  };
}

export function deleteRoutine(routineId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?').run(routineId, userId);
  return result.changes > 0;
}
