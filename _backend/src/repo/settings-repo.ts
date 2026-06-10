import { getDb } from '../db/sqlite.js';

export interface UserSettings {
  clockType: 'digital' | 'analog';
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: UserSettings = { clockType: 'digital' };

export function getSettings(userId: string): UserSettings {
  const db = getDb();
  const row = db.prepare('SELECT settings_json FROM user_settings WHERE user_id = ?').get(userId) as { settings_json: string } | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings_json) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function upsertSettings(userId: string, settings: Partial<UserSettings>): UserSettings {
  const db = getDb();
  const current = getSettings(userId);
  const merged = { ...current, ...settings };
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`
  ).run(userId, JSON.stringify(merged), now);
  return merged;
}
