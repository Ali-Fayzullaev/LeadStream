// Run a migration SQL file directly against Supabase via the REST API.
// Usage: node scripts/run-migration.mjs supabase/migrations/0008_auth_codes.sql

import { readFileSync } from 'fs';
import { resolve } from 'path';

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node scripts/run-migration.mjs <path-to-sql>');
  process.exit(1);
}

// Load .env manually (no external deps needed).
const envText = readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      const key = l.slice(0, idx).trim();
      const val = l.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      return [key, val];
    }),
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sql = readFileSync(resolve(sqlFile), 'utf8');

console.log(`Running: ${sqlFile}`);
console.log(`Target:  ${supabaseUrl}`);

const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
  method: 'POST',
  headers: {
    'Content-Type':  'application/json',
    'apikey':         serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Prefer':        'return=minimal',
  },
  body: JSON.stringify({ query: sql }),
});

// Supabase REST doesn't expose raw SQL execution — use the pg REST proxy instead.
// We'll call the management API via pg connection string approach:
const pgRes = await fetch(`${supabaseUrl}/pg`, {
  method: 'POST',
  headers: {
    'Content-Type':  'application/json',
    'apikey':         serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (!pgRes.ok) {
  // Fall back: use the Supabase SQL API (v1 management API requires project ref + personal token).
  // Extract project ref from URL: https://<ref>.supabase.co
  const ref = supabaseUrl.replace('https://', '').split('.')[0];
  console.log(`\nProject ref: ${ref}`);
  console.log('\n⚠ Cannot run SQL via REST directly. Please run this SQL in the Supabase Dashboard:');
  console.log('→ https://supabase.com/dashboard/project/' + ref + '/sql/new\n');
  console.log('--- SQL START ---');
  console.log(sql);
  console.log('--- SQL END ---');
  process.exit(0);
}

const json = await pgRes.json().catch(() => ({}));
console.log('Result:', json);
console.log('✅ Migration applied!');
