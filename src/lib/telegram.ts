import 'server-only';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/**
 * Fire-and-forget Telegram message. Silently no-ops if env vars are missing.
 */
export async function sendTelegramMessage(html: string, chatId?: string): Promise<void> {
  const target = chatId ?? CHAT_ID;
  if (!TOKEN || !target) return;
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
