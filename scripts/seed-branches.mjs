/**
 * seed-branches.mjs
 * Creates managers (Венера, Фарида) and their brokers in Supabase.
 *
 * Usage:
 *   node scripts/seed-branches.mjs
 *
 * Requirements:
 *   - .env must have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Run AFTER migration 0017 is applied in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

// Load .env manually
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  env[key] = val;
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Branch data ──────────────────────────────────────────────────────────────
const BRANCHES = [
  {
    city: 'Астана',
    manager: {
      email:    'venera.astana@leadstream.kz',
      name:     'Венера',
      phone:    '+77002552437',
      telegram: '@venerazhb',
    },
    brokers: [
      { email: 'gulnur.astana@leadstream.kz',   name: 'Гульнур',  phone: '+77003999326', telegram: '@Gulnur' },
      { email: 'marzhan.astana@leadstream.kz',  name: 'Маржан',   phone: '+77476113225', telegram: '@MmSs019' },
      { email: 'meruert.astana@leadstream.kz',  name: 'Меруерт',  phone: '+77763624434', telegram: '@Меру' },
      { email: 'aisana.astana@leadstream.kz',   name: 'Айсана',   phone: '+77053111599', telegram: '@444' },
      { email: 'altyn.astana@leadstream.kz',    name: 'Алтын',    phone: '+77051850305', telegram: '@Altyn_ip' },
    ],
  },
  {
    city: 'Алматы',
    manager: {
      email:    'farida.almaty@leadstream.kz',
      name:     'Фарида',
      phone:    '+77472902245',
      telegram: null,
    },
    brokers: [
      { email: 'dina.almaty@leadstream.kz', name: 'Дина', phone: '+77760149228', telegram: '@DINA_NURPEYSOVA' },
    ],
  },
];

function genPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let p = '';
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

async function getCityId(cityName) {
  const { data, error } = await admin.from('cities').select('id').eq('name', cityName).maybeSingle();
  if (error || !data) {
    console.error(`❌ City "${cityName}" not found. Run migration 0017 first.`);
    return null;
  }
  return data.id;
}

async function createManagerUser(email, name) {
  // Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === email);
  if (found) {
    console.log(`  ℹ️  Auth user already exists: ${email}`);
    return found.id;
  }

  const password = genPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'streamer', full_name: name, is_manager: true },
  });
  if (error) {
    console.error(`  ❌ Failed to create auth user ${email}:`, error.message);
    return null;
  }
  console.log(`  ✅ Created auth user: ${email} | password: ${password}`);
  return data.user.id;
}

async function createBrokerUser(email, name) {
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === email);
  if (found) {
    console.log(`    ℹ️  Auth user already exists: ${email}`);
    return found.id;
  }

  const password = genPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'broker', full_name: name },
  });
  if (error) {
    console.error(`    ❌ Failed to create auth user ${email}:`, error.message);
    return null;
  }
  console.log(`    ✅ Created auth user: ${email} | password: ${password}`);
  return data.user.id;
}

async function main() {
  console.log('🚀 Seeding branches...\n');

  for (const branch of BRANCHES) {
    console.log(`\n📍 City: ${branch.city}`);

    const cityId = await getCityId(branch.city);
    if (!cityId) continue;

    // ── Create manager ──────────────────────────────────────────────────────
    console.log(`\n  👤 Manager: ${branch.manager.name} (${branch.manager.email})`);

    const managerUserId = await createManagerUser(branch.manager.email, branch.manager.name);
    if (!managerUserId) continue;

    // Check if manager record exists
    const { data: existingMgr } = await admin.from('managers').select('id').eq('user_id', managerUserId).maybeSingle();
    let managerId = existingMgr?.id;

    if (!managerId) {
      const { data: mgr, error: mgrErr } = await admin.from('managers').insert({
        user_id:      managerUserId,
        email:        branch.manager.email,
        display_name: branch.manager.name,
        phone:        branch.manager.phone,
        city_id:      cityId,
        status:       'active',
        telegram_chat_id: branch.manager.telegram,
      }).select('id').single();

      if (mgrErr) {
        console.error(`  ❌ Failed to create manager record:`, mgrErr.message);
        continue;
      }
      managerId = mgr.id;
      console.log(`  ✅ Manager record created: ${managerId}`);
    } else {
      // Update city_id if missing
      await admin.from('managers').update({ city_id: cityId }).eq('id', managerId);
      console.log(`  ℹ️  Manager record already exists: ${managerId}`);
    }

    // ── Create brokers ──────────────────────────────────────────────────────
    for (const broker of branch.brokers) {
      console.log(`\n    🧑‍💼 Broker: ${broker.name} (${broker.email})`);

      const brokerUserId = await createBrokerUser(broker.email, broker.name);
      if (!brokerUserId) continue;

      const { data: existingBroker } = await admin.from('brokers').select('id').eq('user_id', brokerUserId).maybeSingle();
      if (existingBroker) {
        console.log(`    ℹ️  Broker record already exists`);
        continue;
      }

      const { error: bErr } = await admin.from('brokers').insert({
        user_id:      brokerUserId,
        manager_id:   managerId,
        email:        broker.email,
        display_name: broker.name,
        phone:        broker.phone,
        status:       'active',
        telegram_chat_id: broker.telegram,
      });

      if (bErr) {
        console.error(`    ❌ Failed to create broker record:`, bErr.message);
      } else {
        console.log(`    ✅ Broker record created`);
      }
    }
  }

  console.log('\n\n✅ Done! Check the output above for generated passwords.');
  console.log('📝 Share these credentials with the respective managers and brokers.');
  console.log('   They can change their passwords after first login at /login\n');
}

main().catch(console.error);
