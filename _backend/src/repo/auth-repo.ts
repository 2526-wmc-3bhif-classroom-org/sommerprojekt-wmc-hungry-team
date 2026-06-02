import { getDb } from '../db/sqlite.js';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string | null;
}

export interface GoogleAccountRecord {
  id: string;
  user_id: string;
  google_sub: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  refresh_token: string | null;
  access_token: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthStateRecord {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export function createUser(user: UserRecord) {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
     VALUES (@id, @email, @name, @password_hash, @created_at, @updated_at)`
  ).run(user);
}

export function findUserByEmail(email: string): UserRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRecord | undefined;
}

export function findUserById(userId: string): UserRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRecord | undefined;
}

export function createSession(session: SessionRecord) {
  const db = getDb();
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at)
     VALUES (@id, @user_id, @created_at, @expires_at)`
  ).run(session);
}

export function findSession(sessionId: string): SessionRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRecord | undefined;
}

export function deleteSession(sessionId: string) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function createOAuthState(state: OAuthStateRecord) {
  const db = getDb();
  db.prepare(
    `INSERT INTO oauth_states (id, user_id, created_at, expires_at)
     VALUES (@id, @user_id, @created_at, @expires_at)`
  ).run(state);
}

export function consumeOAuthState(stateId: string): OAuthStateRecord | undefined {
  const db = getDb();
  const record = db.prepare('SELECT * FROM oauth_states WHERE id = ?').get(stateId) as OAuthStateRecord | undefined;
  if (record) {
    db.prepare('DELETE FROM oauth_states WHERE id = ?').run(stateId);
  }
  return record;
}

export function cleanupExpiredOAuthStates(nowIso: string) {
  const db = getDb();
  db.prepare('DELETE FROM oauth_states WHERE expires_at < ?').run(nowIso);
}

export function upsertGoogleAccount(record: GoogleAccountRecord) {
  const db = getDb();
  const existing = db.prepare('SELECT refresh_token FROM google_accounts WHERE google_sub = ?').get(record.google_sub) as {
    refresh_token?: string | null;
  } | undefined;

  const refreshToken = record.refresh_token ?? existing?.refresh_token ?? null;

  db.prepare(
    `INSERT INTO google_accounts (
        id, user_id, google_sub, email, name, avatar, refresh_token, access_token, token_expires_at, created_at, updated_at
     ) VALUES (
        @id, @user_id, @google_sub, @email, @name, @avatar, @refresh_token, @access_token, @token_expires_at, @created_at, @updated_at
     )
     ON CONFLICT(google_sub) DO UPDATE SET
        user_id = excluded.user_id,
        email = excluded.email,
        name = excluded.name,
        avatar = excluded.avatar,
        refresh_token = excluded.refresh_token,
        access_token = excluded.access_token,
        token_expires_at = excluded.token_expires_at,
        updated_at = excluded.updated_at`
  ).run({ ...record, refresh_token: refreshToken });
}

export function findGoogleAccountByUserId(userId: string): GoogleAccountRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM google_accounts WHERE user_id = ?').get(userId) as GoogleAccountRecord | undefined;
}
