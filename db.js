// db.js — SQLite database setup for sites + settings
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// DB_PATH lets you point this at a persistent disk on Render (see README).
// Defaults to a local file next to this script, which is fine for local dev
// but WILL be wiped on every deploy/restart unless you're on a paid Render
// plan with a persistent disk attached (the free tier does not support
// persistent disks at all).
const FALLBACK_DB_PATH = path.join(__dirname, 'data.db');
let DB_PATH = process.env.DB_PATH || FALLBACK_DB_PATH;

// better-sqlite3 throws synchronously (crashing the process) if the parent
// directory doesn't exist or isn't writable — this happens if DB_PATH points
// at a disk mount (e.g. /data) that isn't actually attached to the service,
// or a path the process doesn't have permission to create. Handle that
// gracefully instead of letting it take down the whole app on boot.
function ensureWritableDir(dbPath) {
  const dir = path.dirname(dbPath);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch (err) {
    console.warn(
      `[warning] Directory "${dir}" for DB_PATH is missing or not writable ` +
      `(${err.code}). If you expected a persistent Render disk here, check ` +
      'that it is attached under Disks in the Render dashboard — note the ' +
      'free tier does not support persistent disks at all.'
    );
    return false;
  }
}

if (!ensureWritableDir(DB_PATH)) {
  console.warn(`[warning] Falling back to local path: ${FALLBACK_DB_PATH}`);
  DB_PATH = FALLBACK_DB_PATH;
  ensureWritableDir(DB_PATH);
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
