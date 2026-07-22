// db.js — Supabase client setup
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[fatal] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your ' +
    'environment. Locally, copy .env.example to .env and fill in your ' +
    'Supabase project values. On Render, set them under Settings > Environment.'
  );
  process.exit(1);
}

// Server-side only: the service_role key has full read/write access and
// bypasses Row Level Security. NEVER expose it to the browser or commit it
// to git — it belongs in environment variables only.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

module.exports = supabase;
