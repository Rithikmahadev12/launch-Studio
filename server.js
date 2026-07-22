// server.js — Launch Studio site + client progress tracker backend
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Config -----------------------------------------------------------
// Set these in your environment (Render dashboard > Environment) in production.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    '[warning] ADMIN_PASSWORD is not set — using an insecure default. ' +
    'Set ADMIN_PASSWORD in your environment before going live.'
  );
}

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
    },
  })
);

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function uniqueSlug(base) {
  let slug = base || 'site';
  let n = 1;
  const exists = db.prepare('SELECT id FROM sites WHERE slug = ?');
  while (exists.get(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

// --- Auth routes --------------------------------------------------------

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || !timingSafeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ isAdmin: Boolean(req.session && req.session.isAdmin) });
});

// --- Settings (studio contact email / phone) ----------------------------

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach((r) => (settings[r.key] = r.value));
  res.json(settings);
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const { contact_email, contact_phone } = req.body || {};
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  if (contact_email !== undefined) upsert.run('contact_email', String(contact_email));
  if (contact_phone !== undefined) upsert.run('contact_phone', String(contact_phone));
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach((r) => (settings[r.key] = r.value));
  res.json(settings);
});

// --- Sites (client projects) --------------------------------------------

const PUBLIC_FIELDS =
  'id, slug, client_name, site_name, status, progress, live_url, updated_at';
const FULL_FIELDS = `${PUBLIC_FIELDS}, email, phone, notes, created_at`;

// Public: list all sites. Admins (logged in) get the extra contact fields too.
app.get('/api/sites', (req, res) => {
  const isAdmin = Boolean(req.session && req.session.isAdmin);
  const fields = isAdmin ? FULL_FIELDS : PUBLIC_FIELDS;
  const rows = db
    .prepare(`SELECT ${fields} FROM sites ORDER BY updated_at DESC`)
    .all();
  res.json(rows);
});

// Public: single site by slug.
app.get('/api/sites/:slug', (req, res) => {
  const isAdmin = Boolean(req.session && req.session.isAdmin);
  const fields = isAdmin ? FULL_FIELDS : PUBLIC_FIELDS;
  const row = db
    .prepare(`SELECT ${fields} FROM sites WHERE slug = ?`)
    .get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Admin: create a new client site entry.
app.post('/api/sites', requireAdmin, (req, res) => {
  const {
    client_name,
    site_name,
    status = 'In Design',
    progress = 0,
    live_url = '',
    email = '',
    phone = '',
    notes = '',
  } = req.body || {};

  if (!client_name || !site_name) {
    return res.status(400).json({ error: 'client_name and site_name are required' });
  }

  const baseSlug = slugify(req.body.slug || site_name);
  const slug = uniqueSlug(baseSlug || 'site');
  const clampedProgress = Math.max(0, Math.min(100, Number(progress) || 0));

  const info = db
    .prepare(
      `INSERT INTO sites (slug, client_name, site_name, status, progress, live_url, email, phone, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(slug, client_name, site_name, status, clampedProgress, live_url, email, phone, notes);

  const row = db
    .prepare(`SELECT ${FULL_FIELDS} FROM sites WHERE id = ?`)
    .get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Admin: update an existing site entry.
app.put('/api/sites/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    client_name = existing.client_name,
    site_name = existing.site_name,
    status = existing.status,
    progress = existing.progress,
    live_url = existing.live_url,
    email = existing.email,
    phone = existing.phone,
    notes = existing.notes,
  } = req.body || {};

  const clampedProgress = Math.max(0, Math.min(100, Number(progress) || 0));

  db.prepare(
    `UPDATE sites SET
       client_name = ?, site_name = ?, status = ?, progress = ?,
       live_url = ?, email = ?, phone = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(client_name, site_name, status, clampedProgress, live_url, email, phone, notes, req.params.id);

  const row = db
    .prepare(`SELECT ${FULL_FIELDS} FROM sites WHERE id = ?`)
    .get(req.params.id);
  res.json(row);
});

// Admin: delete a site entry.
app.delete('/api/sites/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// --- Static files ---------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// Friendly clean URL for individual client progress pages: /progress/some-slug
app.get('/progress/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'progress.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`Launch Studio server running on port ${PORT}`);
});
