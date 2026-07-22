// db.js — SQLite database setup for sites + settings
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// DB_PATH lets you point this at a persistent disk on Render (see README).
// Defaults to a local file next to this script, which is fine for local dev
// but WILL be wiped on every deploy unless you mount a persistent disk.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

// better-sqlite3 throws synchronously (crashing the process) if the parent
// directory doesn't exist yet — this happens if DB_PATH points at a Render
// disk mount (e.g. /data) that isn't actually attached to the service. Create
// it defensively so a missing/unmounted path degrades gracefully instead of
// crashing the whole app on boot.
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  console.warn(
    `[warning] Directory "${dbDir}" for DB_PATH did not exist — creating it. ` +
    'If you expected a persistent Render disk here, check that it is attached ' +
    'to this service under Disks in the Render dashboard (render.yaml alone ' +
    'does not retroactively attach disks to an already-existing service).'
  );
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    site_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'In Design',
    progress INTEGER NOT NULL DEFAULT 0,
    live_url TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Seed default studio contact info if not already set.
const seedSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
seedSetting.run('contact_email', 'hello@launchstudio.co');
seedSetting.run('contact_phone', '');

module.exports = db;
