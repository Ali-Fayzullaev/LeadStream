'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loginSchema,
  registerStreamerSchema,
  type LoginInput,
  type RegisterStreamerInput,
} from '@/lib/validations';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * Streamer self-registration.
 * Trigger handle_new_user creates profile (role='streamer') + streamer (status='pending').
 */
export async function registerStreamerAction(input: RegisterStreamerInput): Promise<AuthResult> {
  const ip = getClientIp(headers());
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000); // 5 / hour / IP
  if (!rl.ok) return { ok: false, error: 'Too many registration attempts. Try again later.' };

  const parsed = registerStreamerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }
  const { fullName, tiktokUsername, email, password, desiredRefCode } = parsed.data;

  // Pre-check ref_code uniqueness for a friendly error.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('streamers')
    .select('id')
    .ilike('ref_code', desiredRefCode)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `Ref-code "${desiredRefCode}" is already taken. Try another.` };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'streamer',
        full_name: fullName,
        tiktok_username: tiktokUsername ?? null,
        desired_ref_code: desiredRefCode,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/streamer/login`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Streamer or admin login. Redirects on success based on profile.role. */
export async function loginAction(input: LoginInput, expectedRole: 'admin' | 'streamer'): Promise<AuthResult> {
  const ip = getClientIp(headers());
  const rl = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000); // 10 / 5min / IP
  if (!rl.ok) return { ok: false, error: 'Too many login attempts. Try again in a few minutes.' };

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid email or password' };
  }
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Login failed' };
  }

  // Verify role matches the form
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, error: 'Profile not found' };
  }
  if (profile.role !== expectedRole) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        expectedRole === 'admin'
          ? 'This account is not an admin.'
          : 'This account is not a streamer. Use the admin login.',
    };
  }
  return { ok: true };
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
