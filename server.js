// server.js — Launch Studio site + client progress tracker backend
// Loads variables from a local .env file if one exists (for local dev).
// On Render, env vars are set in the dashboard instead, so this is a no-op
// there — safe to leave in for both environments.
require('dotenv').config();

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

// Wraps an async route handler so rejected promises (e.g. a Supabase error)
// are caught and turned into a 500 response instead of crashing the process
// or hanging the request.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    });
  };
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function uniqueSlug(base) {
  let slug = base || 'site';
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await db
      .from('sites')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
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

app.get('/api/settings', asyncHandler(async (req, res) => {
  const { data, error } = await db.from('settings').select('key, value');
  if (error) throw error;
  const settings = {};
  data.forEach((r) => (settings[r.key] = r.value));
  res.json(settings);
}));

app.put('/api/settings', requireAdmin, asyncHandler(async (req, res) => {
  const { contact_email, contact_phone } = req.body || {};
  const rowsToUpsert = [];
  if (contact_email !== undefined) rowsToUpsert.push({ key: 'contact_email', value: String(contact_email) });
  if (contact_phone !== undefined) rowsToUpsert.push({ key: 'contact_phone', value: String(contact_phone) });

  if (rowsToUpsert.length > 0) {
    const { error } = await db.from('settings').upsert(rowsToUpsert, { onConflict: 'key' });
    if (error) throw error;
  }

  const { data, error } = await db.from('settings').select('key, value');
  if (error) throw error;
  const settings = {};
  data.forEach((r) => (settings[r.key] = r.value));
  res.json(settings);
}));

// --- Sites (client projects) --------------------------------------------

const PUBLIC_FIELDS =
  'id, slug, client_name, site_name, status, progress, live_url, updated_at';
const FULL_FIELDS = `${PUBLIC_FIELDS}, email, phone, notes, created_at`;

// Public: list all sites. Admins (logged in) get the extra contact fields too.
app.get('/api/sites', asyncHandler(async (req, res) => {
  const isAdmin = Boolean(req.session && req.session.isAdmin);
  const fields = isAdmin ? FULL_FIELDS : PUBLIC_FIELDS;
  const { data, error } = await db
    .from('sites')
    .select(fields)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

// Public: single site by slug.
app.get('/api/sites/:slug', asyncHandler(async (req, res) => {
  const isAdmin = Boolean(req.session && req.session.isAdmin);
  const fields = isAdmin ? FULL_FIELDS : PUBLIC_FIELDS;
  const { data, error } = await db
    .from('sites')
    .select(fields)
    .eq('slug', req.params.slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
}));

// Admin: create a new client site entry.
app.post('/api/sites', requireAdmin, asyncHandler(async (req, res) => {
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
  const slug = await uniqueSlug(baseSlug || 'site');
  const clampedProgress = Math.max(0, Math.min(100, Number(progress) || 0));

  const { data, error } = await db
    .from('sites')
    .insert({
      slug,
      client_name,
      site_name,
      status,
      progress: clampedProgress,
      live_url,
      email,
      phone,
      notes,
    })
    .select(FULL_FIELDS)
    .single();
  if (error) throw error;

  res.status(201).json(data);
}));

// Admin: update an existing site entry.
app.put('/api/sites/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { data: existing, error: fetchError } = await db
    .from('sites')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (fetchError) throw fetchError;
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

  const { data, error } = await db
    .from('sites')
    .update({
      client_name,
      site_name,
      status,
      progress: clampedProgress,
      live_url,
      email,
      phone,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select(FULL_FIELDS)
    .single();
  if (error) throw error;

  res.json(data);
}));

// Admin: delete a site entry.
app.delete('/api/sites/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await db
    .from('sites')
    .delete()
    .eq('id', req.params.id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));

// --- Static files ---------------------------------------------------------
// Everything (index.html, styles.css, admin.js, login.html, etc.) lives
// directly in the project root alongside server.js/db.js/data.db, so before
// serving the root as static we block anything that isn't meant to be
// public (source files, config, and — critically — the SQLite database,
// which contains client names/emails/phone numbers).
const BLOCKED_FILES = new Set([
  'server.js',
  'db.js',
  'data.db',
  'data.db-wal',
  'data.db-shm',
  'package.json',
  'package-lock.json',
  '.npmrc',
  '.env',
  'render.yaml',
  'readme.md',
  '.gitignore',
]);

app.use((req, res, next) => {
  const requested = path.basename(req.path).toLowerCase();
  if (BLOCKED_FILES.has(requested) || requested.startsWith('.')) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(__dirname));

// Exact /admin (no trailing path) should serve the dashboard page itself.
// This must come BEFORE the '/admin' static alias below, otherwise
// express.static sees an existing __dirname folder for the '/admin' mount
// and issues a directory redirect instead of ever reaching this route.
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// dashboard.html / login.html reference /admin/admin.css and /admin/admin.js
// (as if there were an /admin subfolder). Alias /admin/* to the same root
// folder so those requests still resolve to the flat admin.css / admin.js.
app.use('/admin', express.static(__dirname));

// Friendly clean URL for individual client progress pages: /progress/some-slug
app.get('/progress/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'progress.html'));
});

app.listen(PORT, () => {
  console.log(`Launch Studio server running on port ${PORT}`);
});
