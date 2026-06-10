import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DEFAULT_DB_PATH = '/data/smarthub.sqlite';

let db: Database.Database | null = null;

function ensureDirectoryExists(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS google_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      google_sub TEXT NOT NULL UNIQUE,
      email TEXT,
      name TEXT,
      avatar TEXT,
      refresh_token TEXT,
      access_token TEXT,
      token_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      transport_mode TEXT NOT NULL DEFAULT 'bus',
      destination TEXT NOT NULL DEFAULT '',
      start_address TEXT NOT NULL DEFAULT '',
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS routine_days (
      routine_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      PRIMARY KEY (routine_id, day_of_week),
      FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_google_accounts_user_id ON google_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);
    CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  try { database.exec("ALTER TABLE routines ADD COLUMN transport_mode TEXT NOT NULL DEFAULT 'bus'"); } catch (e) {}
  try { database.exec("ALTER TABLE routines ADD COLUMN destination TEXT NOT NULL DEFAULT ''"); } catch (e) {}
  try { database.exec("ALTER TABLE routines ADD COLUMN start_address TEXT NOT NULL DEFAULT ''"); } catch (e) {}
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || DEFAULT_DB_PATH;
    ensureDirectoryExists(dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
