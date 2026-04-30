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
import { sendTelegramToAdmin, buildNewStreamerNotificationHtml } from '@/lib/telegram';

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
  const { fullName, tiktokUsernames, email, password } = parsed.data;

  // Ref code is generated server-side by the handle_new_user() trigger
  // using generate_unique_ref_code(full_name || email_prefix).
  const admin = createAdminClient();

  const supabase = createClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'streamer',
        full_name: fullName,
        tiktok_username: tiktokUsernames[0] ?? null,
        // No desired_ref_code → trigger derives a unique one.
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/streamer/login`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Persist all TikTok accounts using admin client (RLS would otherwise block — user not yet logged in).
  const userId = signUpData.user?.id;
  let createdRefCode: string | null = null;
  if (userId && tiktokUsernames.length > 0) {
    const { data: streamer } = await admin
      .from('streamers')
      .select('id, ref_code')
      .eq('user_id', userId)
      .maybeSingle();
    if (streamer) {
      createdRefCode = (streamer as { ref_code?: string | null }).ref_code ?? null;
      const rows = tiktokUsernames.map((username, idx) => ({
        streamer_id: streamer.id,
        username,
        is_primary: idx === 0,
      }));
      // Best-effort — fresh streamer has no accounts yet.
      await admin.from('streamer_tiktok_accounts').insert(rows);
    }
  } else if (userId) {
    const { data: streamer } = await admin
      .from('streamers')
      .select('ref_code')
      .eq('user_id', userId)
      .maybeSingle();
    createdRefCode = (streamer as { ref_code?: string | null } | null)?.ref_code ?? null;
  }

  // Best-effort: notify admin Telegram chat about the new pending streamer.
  void sendTelegramToAdmin(
    buildNewStreamerNotificationHtml({
      fullName,
      email,
      refCode: createdRefCode ?? '—',
      tiktokUsernames,
    }),
  );

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
