#!/usr/bin/env node
// Create or promote an admin user in Supabase using the service-role key.
// Usage:
//   npm run create-admin -- --email admin@example.com --password "S3cret!"
//   npm run create-admin -- --email admin@example.com --password "S3cret!" --name "Owner"
//
// Loads env from .env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
// Idempotent: if the user already exists, it just promotes them to admin.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ---- tiny .env loader ------------------------------------------------------
function loadEnv() {
  const file = resolve(process.cwd(), '.env');
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// ---- args ------------------------------------------------------------------
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const email = arg('email');
const password = arg('password');
const fullName = arg('name') ?? 'Admin';

if (!email || !password) {
  console.error('Usage: npm run create-admin -- --email <email> --password <password> [--name "Full Name"]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// ---- find or create user ---------------------------------------------------
async function findUserByEmail(emailQ) {
  // listUsers paginates; for small projects 1 page is enough.
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === emailQ.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 50) return null;
  }
}

const existing = await findUserByEmail(email);

let userId;
if (existing) {
  console.log(`✓ User already exists: ${existing.id}`);
  userId = existing.id;
  // Make sure password is updated and email is confirmed.
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { ...(existing.user_metadata ?? {}), role: 'admin', full_name: fullName },
  });
  if (error) {
    console.error('Failed to update existing user:', error.message);
    process.exit(1);
  }
  console.log('✓ Password updated and email confirmed');
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin', full_name: fullName },
  });
  if (error || !data.user) {
    console.error('Failed to create user:', error?.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`✓ Created auth user: ${userId}`);
}

// ---- ensure profile is admin ----------------------------------------------
const { error: profErr } = await admin
  .from('profiles')
  .upsert({ id: userId, email, role: 'admin', full_name: fullName }, { onConflict: 'id' });
if (profErr) {
  console.error('Failed to upsert profile:', profErr.message);
  process.exit(1);
}
console.log('✓ Profile set to role=admin');

// ---- remove auto-created streamer row, if any -----------------------------
const { error: delErr } = await admin.from('streamers').delete().eq('user_id', userId);
if (delErr && delErr.code !== 'PGRST116') {
  console.warn('Note: could not delete streamer row:', delErr.message);
} else {
  console.log('✓ Removed any auto-created streamer row');
}

console.log('');
console.log('Done. Sign in at /admin/login with:');
console.log(`  email:    ${email}`);
console.log(`  password: ${password}`);
