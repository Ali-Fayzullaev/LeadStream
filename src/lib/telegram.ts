import 'server-only';
import { getAppSettings } from '@/lib/settings';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ENV_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

async function resolveAdminChatId(): Promise<string | undefined> {
  try {
    const settings = await getAppSettings();
    if (settings.admin_telegram_chat_id) return settings.admin_telegram_chat_id;
  } catch {
    // ignore
  }
  return ENV_CHAT_ID;
}

/**
 * Fire-and-forget Telegram message. Silently no-ops if token/chat are missing.
 * If `chatId` is omitted, falls back to admin chat from app_settings (or env).
 */
export async function sendTelegramMessage(html: string, chatId?: string): Promise<void> {
  if (!TOKEN) return;
  const target = chatId ?? (await resolveAdminChatId());
  if (!target) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: target,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // swallow — notifications are best-effort
  }
}

export interface OrderNotificationPayload {
  id: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  quantity: number;
  amount: number;
  streamerName?: string | null;
  refCode?: string | null;
}

export function buildOrderNotificationHtml(o: OrderNotificationPayload): string {
  const lines = [
    '🛒 <b>New order</b>',
    `👤 ${escapeHtml(o.customerName)}`,
    `📞 ${escapeHtml(o.customerPhone)}`,
    `📦 ${escapeHtml(o.productName)} × ${o.quantity}`,
    `💵 ${o.amount.toFixed(2)}`,
  ];
  if (o.streamerName || o.refCode) {
    lines.push(`🎬 ${escapeHtml(o.streamerName ?? '—')} (${escapeHtml(o.refCode ?? '—')})`);
  } else {
    lines.push('🎬 <i>direct visit (no ref)</i>');
  }
  lines.push(`🆔 <code>${escapeHtml(o.id)}</code>`);
  return lines.join('\n');
}
