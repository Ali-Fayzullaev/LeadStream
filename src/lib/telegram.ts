import 'server-only';
import { getAppSettings } from '@/lib/settings';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ENV_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

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

/** Send to admin chat (resolved from settings/env). */
export async function sendTelegramToAdmin(html: string): Promise<void> {
  await sendTelegramMessage(html);
}

// ---------------------------------------------------------------------------
// Russian status labels
// ---------------------------------------------------------------------------

const STREAMER_STATUS_RU: Record<string, string> = {
  pending: '⏳ Ожидает проверки',
  active: '✅ Активен',
  blocked: '⛔ Заблокирован',
};

export function streamerStatusRu(status: string): string {
  return STREAMER_STATUS_RU[status] ?? status;
}

// ---------------------------------------------------------------------------
// Notification builders (HTML, Russian)
// ---------------------------------------------------------------------------

function formatRub(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n);
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
    '🛒 <b>Новая заявка</b>',
    `👤 <b>Клиент:</b> ${escapeHtml(o.customerName)}`,
    `📞 <b>Телефон:</b> ${escapeHtml(o.customerPhone)}`,
    `📦 <b>Товар:</b> ${escapeHtml(o.productName)} × ${o.quantity}`,
    `💵 <b>Сумма:</b> ${formatRub(o.amount)}`,
  ];
  if (o.streamerName || o.refCode) {
    lines.push(
      `🎬 <b>Стример:</b> ${escapeHtml(o.streamerName ?? '—')} (<code>${escapeHtml(o.refCode ?? '—')}</code>)`,
    );
  } else {
    lines.push('🎬 <i>Прямой заход — без реф-кода</i>');
  }
  lines.push(`🆔 <code>${escapeHtml(o.id)}</code>`);
  lines.push(`🔗 <a href="${APP_URL}/admin/orders">Открыть в дашборде</a>`);
  return lines.join('\n');
}

/** Friendlier variant for the streamer's own chat. */
export function buildStreamerOrderNotificationHtml(o: OrderNotificationPayload): string {
  return [
    '🎉 <b>Вам пришла новая заявка!</b>',
    `👤 ${escapeHtml(o.customerName)} · 📞 ${escapeHtml(o.customerPhone)}`,
    `📦 ${escapeHtml(o.productName)} × ${o.quantity}`,
    `💵 ${formatRub(o.amount)}`,
    `🔗 <a href="${APP_URL}/streamer/orders">Открыть кабинет</a>`,
  ].join('\n');
}

export interface NewStreamerNotificationPayload {
  fullName: string;
  email: string;
  refCode: string;
  tiktokUsernames?: string[];
}

export function buildNewStreamerNotificationHtml(s: NewStreamerNotificationPayload): string {
  const lines = [
    '🆕 <b>Новый стример зарегистрирован</b>',
    `👤 <b>Имя:</b> ${escapeHtml(s.fullName)}`,
    `📧 <b>Email:</b> ${escapeHtml(s.email)}`,
    `🔗 <b>Реф-код:</b> <code>${escapeHtml(s.refCode)}</code>`,
  ];
  if (s.tiktokUsernames && s.tiktokUsernames.length > 0) {
    lines.push(`🎵 <b>TikTok:</b> ${s.tiktokUsernames.map((u) => '@' + escapeHtml(u)).join(', ')}`);
  }
  lines.push('📊 <b>Статус:</b> ⏳ Ожидает проверки');
  lines.push(`🔧 <a href="${APP_URL}/admin/streamers">Проверить и активировать</a>`);
  return lines.join('\n');
}

export interface StreamerStatusChangePayload {
  fullName: string;
  refCode: string;
  oldStatus: string;
  newStatus: string;
}

export function buildStreamerStatusChangeHtml(s: StreamerStatusChangePayload): string {
  const isActivation = s.newStatus === 'active';
  const isBlock = s.newStatus === 'blocked';
  const head = isActivation
    ? '🎉 <b>Ваш аккаунт активирован!</b>'
    : isBlock
      ? '⛔ <b>Ваш аккаунт заблокирован</b>'
      : '🔄 <b>Статус вашего аккаунта изменён</b>';

  const lines = [
    head,
    `👤 ${escapeHtml(s.fullName)}`,
    `🔗 <code>${escapeHtml(s.refCode)}</code>`,
    `📊 <b>Было:</b> ${streamerStatusRu(s.oldStatus)}`,
    `📊 <b>Стало:</b> ${streamerStatusRu(s.newStatus)}`,
  ];
  if (isActivation) {
    lines.push('');
    lines.push('Можете начинать работать! Реферальная ссылка — в кабинете.');
    lines.push(`🚀 <a href="${APP_URL}/streamer">Перейти в кабинет</a>`);
  } else if (isBlock) {
    lines.push('');
    lines.push('Свяжитесь с администратором для уточнения деталей.');
  }
  return lines.join('\n');
}

export interface OrderStatusChangePayload {
  orderId: string;
  customerName: string;
  productName: string;
  amount: number;
  oldStatusLabel: string;
  newStatusLabel: string;
}

export function buildOrderStatusChangeHtml(o: OrderStatusChangePayload): string {
  return [
    '🔄 <b>Статус заявки обновлён</b>',
    `👤 ${escapeHtml(o.customerName)}`,
    `📦 ${escapeHtml(o.productName)}`,
    `💵 ${formatRub(o.amount)}`,
    `📊 <b>Было:</b> ${escapeHtml(o.oldStatusLabel)}`,
    `📊 <b>Стало:</b> ${escapeHtml(o.newStatusLabel)}`,
    `🆔 <code>${escapeHtml(o.orderId)}</code>`,
    `🔗 <a href="${APP_URL}/streamer/orders">Открыть кабинет</a>`,
  ].join('\n');
}
