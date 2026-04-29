/**
 * Telegram notification helper.
 *
 * Posts a message to the configured chat. Silently no-ops if env vars are missing,
 * so the order flow keeps working even without Telegram configured.
 */
const TG_API = 'https://api.telegram.org';

export interface TelegramMessage {
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
}

export async function sendTelegramMessage({ text, parseMode = 'HTML' }: TelegramMessage) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return { ok: false, skipped: true as const };

  try {
    const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
      // Avoid blocking the request for too long if Telegram is slow.
      signal: AbortSignal.timeout(5_000),
    });
    return { ok: res.ok };
  } catch (err) {
    console.error('[telegram] send failed:', err);
    return { ok: false };
  }
}

/** Escape user-controlled content for HTML parse mode. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatNewOrderMessage(order: {
  id: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  quantity: number;
  amount: number | string;
  streamer?: { name: string; refCode: string } | null;
}): string {
  const stream = order.streamer
    ? `${escapeHtml(order.streamer.name)} <code>(${escapeHtml(order.streamer.refCode)})</code>`
    : '<i>direct</i>';
  return [
    '🛒 <b>New order</b>',
    `👤 ${escapeHtml(order.customerName)}`,
    `📞 <code>${escapeHtml(order.customerPhone)}</code>`,
    `📦 ${escapeHtml(order.productName)} × ${order.quantity}`,
    `💵 ${order.amount}`,
    `🎬 ${stream}`,
    `🆔 <code>${order.id}</code>`,
  ].join('\n');
}
