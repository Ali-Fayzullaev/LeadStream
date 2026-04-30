import 'server-only';
import { createHash, randomInt } from 'node:crypto';

/**
 * Email delivery via Resend (https://resend.com).
 *
 * Required env:
 *   RESEND_API_KEY     — re_xxxxxxxx (from https://resend.com/api-keys)
 *   RESEND_FROM        — "LeadStream <noreply@yourdomain.kz>"
 *                        (the domain MUST be verified in Resend dashboard;
 *                         until then you may use "onboarding@resend.dev").
 *   NEXT_PUBLIC_APP_URL — used for branding links inside the email.
 *
 * The lib is fire-and-forget tolerant: returns { ok: false } on failure
 * so action handlers can show a friendly error instead of crashing.
 */

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM ?? 'LeadStream <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const BRAND = process.env.EMAIL_BRAND_NAME ?? 'LeadStream';

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!API_KEY) {
    // In dev without an API key we log the code so you can still test.
    // eslint-disable-next-line no-console
    console.warn('[email] RESEND_API_KEY is missing. Email NOT sent. Preview:\n', input.text);
    return { ok: false, error: 'Email service is not configured (RESEND_API_KEY missing).' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Email send failed' };
  }
}

// ---------------------------------------------------------------------------
// 6-digit verification codes
// ---------------------------------------------------------------------------

/** Cryptographically random 6-digit code as a zero-padded string. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Hash a code together with the (lowercased) email — defends against DB leaks. */
export function hashOtp(email: string, code: string): string {
  return createHash('sha256').update(`${email.toLowerCase()}:${code}`).digest('hex');
}

export async function sendVerificationCodeEmail(
  to: string,
  code: string,
): Promise<SendResult> {
  const subject = `${code} — ваш код подтверждения · ${BRAND}`;
  const text = [
    `Здравствуйте!`,
    ``,
    `Ваш код подтверждения для регистрации в ${BRAND}: ${code}`,
    ``,
    `Код действует 10 минут. Если вы не запрашивали регистрацию — просто проигнорируйте это письмо.`,
    ``,
    `${BRAND} · ${APP_URL}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="ru">
<body style="margin:0;padding:0;background:#f7f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1206;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(245,158,11,0.08);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:28px 32px;color:#fff;">
          <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">${BRAND}</div>
          <div style="font-size:22px;font-weight:700;margin-top:6px;">Подтверждение email</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">
            Здравствуйте! Чтобы завершить регистрацию, введите этот код на странице подтверждения:
          </p>
          <div style="margin:24px 0;text-align:center;">
            <div style="display:inline-block;padding:18px 28px;background:#fff7ed;border:2px dashed #f59e0b;border-radius:12px;font-size:32px;font-weight:700;letter-spacing:.4em;color:#92400e;">
              ${escapeHtml(code)}
            </div>
          </div>
          <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;line-height:1.55;">
            Код действителен <strong>10 минут</strong>. Не делитесь им ни с кем.
          </p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.55;">
            Если вы не запрашивали регистрацию — просто проигнорируйте это письмо.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#faf8f3;border-top:1px solid #f3eee0;font-size:12px;color:#9ca3af;">
          © ${new Date().getFullYear()} ${BRAND}. <a href="${APP_URL}" style="color:#b45309;text-decoration:none;">${APP_URL}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail({ to, subject, html, text });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
