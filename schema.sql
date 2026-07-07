-- D1 Database Schema for Hiking 3D App
-- Run this in Cloudflare Dashboard → D1 → your-database → Console

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  raw_gpx_text TEXT NOT NULL,
  stats TEXT NOT NULL DEFAULT '{}',
  imported_at INTEGER NOT NULL,
  workout_date INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks(user_id, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
