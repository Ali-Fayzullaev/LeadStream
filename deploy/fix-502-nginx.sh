#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# fix-502-nginx.sh — раз и навсегда чинит 502 на проде LeadStream
# ────────────────────────────────────────────────────────────────────────────
#
# Что делает скрипт:
#   1. Находит активный nginx-конфиг для сайта.
#   2. Добавляет (или обновляет) большие header- и proxy-буферы, чтобы
#      nginx не отдавал 502 на длинных Supabase auth-cookie.
#   3. Делает `nginx -t` (валидация) и `systemctl reload nginx`.
#
# Использование:
#   sudo bash deploy/fix-502-nginx.sh /etc/nginx/sites-available/leadstream
#
# Или (auto-detect):
#   sudo bash deploy/fix-502-nginx.sh
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

CONF="${1:-}"

if [[ -z "${CONF}" ]]; then
  # Попробуем автоопределить конфиг для нашего домена
  for candidate in \
      /etc/nginx/sites-enabled/leadstream \
      /etc/nginx/sites-available/leadstream \
      /etc/nginx/conf.d/leadstream.conf \
      /etc/nginx/conf.d/stream.comfort-time.kz.conf; do
    if [[ -f "$candidate" ]]; then CONF="$candidate"; break; fi
  done
fi

if [[ -z "${CONF}" || ! -f "${CONF}" ]]; then
  echo "❌ Не найден nginx-конфиг. Передай путь параметром:"
  echo "   sudo bash $0 /etc/nginx/sites-available/<your-site>"
  exit 1
fi

echo "→ Используется конфиг: $CONF"

# Бэкап
BACKUP="${CONF}.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$CONF" "$BACKUP"
echo "→ Бэкап сохранён: $BACKUP"

# Блок настроек для вставки. Идемпотентность достигается маркером.
MARKER="# >>> leadstream-502-fix >>>"
END_MARKER="# <<< leadstream-502-fix <<<"

read -r -d '' FIX_BLOCK <<'EOF' || true
    # >>> leadstream-502-fix >>>
    # Большие буферы заголовков — без этого длинные Supabase-cookie
    # (sb-*-auth-token.0 + .1 + ref/utm/cf) переполняют дефолтный
    # large_client_header_buffers и nginx возвращает 502.
    large_client_header_buffers 16 32k;
    client_header_buffer_size   16k;
    client_max_body_size        25m;

    proxy_buffer_size           128k;
    proxy_buffers               8  256k;
    proxy_busy_buffers_size     256k;
    proxy_temp_file_write_size  256k;

    proxy_connect_timeout       60s;
    proxy_send_timeout          300s;
    proxy_read_timeout          300s;
    # <<< leadstream-502-fix <<<
EOF

if grep -qF "$MARKER" "$CONF"; then
  echo "→ Маркер уже присутствует — обновляю существующий блок"
  # Удалим старый блок целиком
  sed -i "/$MARKER/,/$END_MARKER/d" "$CONF"
fi

# Вставим блок сразу после первой `listen 443` директивы.
# Если её нет — после первой `server {`.
if grep -qE 'listen[[:space:]]+443' "$CONF"; then
  ANCHOR=$(grep -nE 'listen[[:space:]]+443' "$CONF" | head -1 | cut -d: -f1)
else
  ANCHOR=$(grep -nE '^[[:space:]]*server[[:space:]]*\{' "$CONF" | head -1 | cut -d: -f1)
fi

if [[ -z "$ANCHOR" ]]; then
  echo "❌ Не нашёл место для вставки (ни listen 443, ни server {)."
  echo "   Проверь содержимое $CONF вручную."
  exit 1
fi

# Запишем во временный файл с inserted block после $ANCHOR
TMP=$(mktemp)
{
  head -n "$ANCHOR" "$CONF"
  echo ""
  echo "$FIX_BLOCK"
  tail -n +"$((ANCHOR + 1))" "$CONF"
} > "$TMP"

mv "$TMP" "$CONF"

echo "→ Блок 502-fix вставлен"

# Валидация
if ! nginx -t; then
  echo "❌ nginx -t не прошёл. Откатываюсь на $BACKUP"
  cp -a "$BACKUP" "$CONF"
  exit 1
fi

systemctl reload nginx
echo "✅ nginx перечитан. 502 на длинных Supabase-cookie должен исчезнуть."
echo "   Если что-то пошло не так, бэкап здесь: $BACKUP"
