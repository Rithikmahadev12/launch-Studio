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

// Render (and most hosts) terminate HTTPS at a proxy in front of your app,
// so Express sees the incoming request as plain HTTP unless it's told to
// trust the proxy's "X-Forwarded-Proto" header. Without this, cookie.secure
// below can't reliably detect that the connection actually is HTTPS, which
// causes the session cookie to silently fail to persist — the classic
// symptom being "login succeeds but immediately bounces back to the login
// page." This line fixes that.
app.set('trust proxy', 1);

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
      // 'auto' looks at the (now-trusted) X-Forwarded-Proto header to
      // decide whether the connection is really HTTPS, instead of just
      // assuming based on NODE_ENV. Works correctly both on Render (HTTPS)
      // and in local dev (HTTP).
      secure: 'auto',
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
  'id, slug, client_name, site_name, status, progress, live_url, category, description, featured, updated_at';
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
    category = '',
    description = '',
    featured = false,
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
      category,
      description,
      featured: Boolean(featured),
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
    category = existing.category,
    description = existing.description,
    featured = existing.featured,
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
      category,
      description,
      featured: Boolean(featured),
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

// --- Pricing plans (homepage pricing section) ----------------------------

// Public: list all 3 pricing tiers, in display order.
app.get('/api/pricing', asyncHandler(async (req, res) => {
  const { data, error } = await db
    .from('pricing_plans')
    .select('slug, name, price, subtitle, features, good_for, cta_label, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  res.json(data);
}));

// Admin: update one pricing tier's content (tiers themselves are fixed —
// this only edits price/copy, not the number of tiers).
app.put('/api/pricing/:slug', requireAdmin, asyncHandler(async (req, res) => {
  const { price, subtitle, features, good_for, cta_label } = req.body || {};
  const updates = {};
  if (price !== undefined) updates.price = String(price);
  if (subtitle !== undefined) updates.subtitle = String(subtitle);
  if (features !== undefined) updates.features = String(features);
  if (good_for !== undefined) updates.good_for = String(good_for);
  if (cta_label !== undefined) updates.cta_label = String(cta_label);

  const { data, error } = await db
    .from('pricing_plans')
    .update(updates)
    .eq('slug', req.params.slug)
    .select('slug, name, price, subtitle, features, good_for, cta_label, sort_order')
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
}));

// --- Reviews (public reviews page) ---------------------------------------

// Public: published reviews only. Admins (logged in) get everything,
// including unpublished drafts, so they can preview before publishing.
app.get('/api/reviews', asyncHandler(async (req, res) => {
  const isAdmin = Boolean(req.session && req.session.isAdmin);
  let query = db.from('reviews').select('id, client_name, rating, quote, published, created_at');
  if (!isAdmin) query = query.eq('published', true);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

// Admin: add a new review.
app.post('/api/reviews', requireAdmin, asyncHandler(async (req, res) => {
  const { client_name, rating = 5, quote, published = true } = req.body || {};
  if (!client_name || !quote) {
    return res.status(400).json({ error: 'client_name and quote are required' });
  }
  const clampedRating = Math.max(1, Math.min(5, Number(rating) || 5));

  const { data, error } = await db
    .from('reviews')
    .insert({
      client_name,
      rating: clampedRating,
      quote,
      published: Boolean(published),
    })
    .select('id, client_name, rating, quote, published, created_at')
    .single();
  if (error) throw error;

  res.status(201).json(data);
}));

// Admin: update an existing review (e.g. toggle published, fix a typo).
app.put('/api/reviews/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { data: existing, error: fetchError } = await db
    .from('reviews')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    client_name = existing.client_name,
    rating = existing.rating,
    quote = existing.quote,
    published = existing.published,
  } = req.body || {};

  const clampedRating = Math.max(1, Math.min(5, Number(rating) || 5));

  const { data, error } = await db
    .from('reviews')
    .update({
      client_name,
      rating: clampedRating,
      quote,
      published: Boolean(published),
    })
    .eq('id', req.params.id)
    .select('id, client_name, rating, quote, published, created_at')
    .single();
  if (error) throw error;

  res.json(data);
}));

// Admin: delete a review.
app.delete('/api/reviews/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await db
    .from('reviews')
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
