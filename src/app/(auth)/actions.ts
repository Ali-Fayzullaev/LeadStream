'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loginSchema,
  registerStreamerSchema,
  registerStreamerVerifySchema,
  requestEmailCodeSchema,
  type LoginInput,
  type RegisterStreamerInput,
  type RegisterStreamerVerifyInput,
  type RequestEmailCodeInput,
} from '@/lib/validations';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sendTelegramToAdmin, buildNewStreamerNotificationHtml } from '@/lib/telegram';
import { generateOtp, hashOtp, sendVerificationCodeEmail } from '@/lib/email';

export type AuthResult = { ok: true } | { ok: false; error: string };

/**
 * Step 1 — request a 6-digit email code.
 * Stores a hashed code in `auth_codes` and emails it via Resend.
 * Always returns ok=true to prevent email enumeration (unless rate-limited).
 */
export async function requestRegistrationCodeAction(
  input: RequestEmailCodeInput,
): Promise<AuthResult> {
  const ip = getClientIp(headers());
  const rl = rateLimit(`otp:${ip}`, 6, 60 * 60 * 1000); // 6 / hour / IP
  if (!rl.ok) return { ok: false, error: 'Слишком много попыток. Попробуйте позже.' };

  const parsed = requestEmailCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Введите корректный email' };
  const email = parsed.data.email.toLowerCase();

  // Per-email cooldown: max 3 codes / 10 minutes.
  const rlEmail = rateLimit(`otp-email:${email}`, 3, 10 * 60 * 1000);
  if (!rlEmail.ok) return { ok: false, error: 'Код уже отправлен. Проверьте почту или подождите немного.' };

  const code = generateOtp();
  const code_hash = hashOtp(email, code);

  const admin = createAdminClient();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertErr } = await admin.from('auth_codes').insert({
    email,
    purpose: 'register',
    code_hash,
    expires_at,
  });
  if (insertErr) return { ok: false, error: 'Не удалось создать код. Попробуйте позже.' };

  const send = await sendVerificationCodeEmail(email, code);
  if (!send.ok) return { ok: false, error: send.error };
  return { ok: true };
}

async function verifyAndConsumeOtp(email: string, code: string): Promise<boolean> {
  const admin = createAdminClient();
  const code_hash = hashOtp(email.toLowerCase(), code);

  // Most recent unused, unexpired code with matching hash.
  const { data: row } = await admin
    .from('auth_codes')
    .select('id, expires_at, used_at')
    .eq('email', email.toLowerCase())
    .eq('purpose', 'register')
    .eq('code_hash', code_hash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return false;

  await admin.from('auth_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
  return true;
}

/**
 * Step 2 — verify code + create the streamer account.
 * Trigger handle_new_user creates profile (role='streamer') + streamer (status='pending').
 */
export async function registerStreamerAction(
  input: RegisterStreamerVerifyInput,
): Promise<AuthResult> {
  const ip = getClientIp(headers());
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000); // 5 / hour / IP
  if (!rl.ok) return { ok: false, error: 'Слишком много попыток регистрации. Попробуйте позже.' };

  const parsed = registerStreamerVerifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }
  const { fullName, tiktokUsernames, email, password, code } = parsed.data;

  const codeOk = await verifyAndConsumeOtp(email, code);
  if (!codeOk) return { ok: false, error: 'Код неверный или истёк. Запросите новый.' };

  const admin = createAdminClient();

  // Use admin.createUser with email_confirm:true so Supabase never sends its
  // own confirmation email — we already verified ownership via OTP above.
  const { data: signUpData, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'streamer',
      full_name: fullName,
      tiktok_username: tiktokUsernames[0] ?? null,
    },
  });

  if (error) return { ok: false, error: error.message };

  const userId = signUpData.user?.id;

  // Persist all TikTok accounts using admin client (RLS would otherwise block).
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

/** @deprecated kept only for backwards-compat with any imports — not used anymore. */
export type _UnusedRegisterStreamerInput = RegisterStreamerInput;

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
