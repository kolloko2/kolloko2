#!/usr/bin/env bash
# Установка МАГНАТ на чистый Ubuntu 24.04 (запускать от root):
#   bash install.sh nkodzaev.ru
# Ставит Node.js 22, nginx и бесплатный HTTPS (Let's Encrypt), запускает игру как службу systemd.
# Игра слушает 127.0.0.1:8080, наружу её отдаёт nginx (с поддержкой WebSocket для мультиплеера).
set -euo pipefail
DOMAIN="${1:?Укажите домен: bash install.sh example.ru}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"   # папка game/
APP=/opt/magnat

echo "== Пакеты"
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx ufw rsync
if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "== Файлы игры → $APP"
id magnat >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin magnat
mkdir -p "$APP"
rsync -a --delete --exclude server-data --exclude node_modules --exclude assets/icons/raw "$SRC/" "$APP/"
mkdir -p "$APP/server-data"
chown -R magnat:magnat "$APP"

echo "== Служба systemd"
cat > /etc/systemd/system/magnat.service <<UNIT
[Unit]
Description=МАГНАТ: Империя — игровой сервер
After=network.target

[Service]
User=magnat
WorkingDirectory=$APP
Environment=HOST=127.0.0.1 PORT=8080 NODE_ENV=production
ExecStart=/usr/bin/node server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now magnat
systemctl restart magnat

echo "== nginx"
cat > /etc/nginx/sites-available/magnat <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN www.$DOMAIN;
  client_max_body_size 5m;
  location /ws {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_read_timeout 3600s;
  }
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }
}
NGINX
# старые сайты с этим доменом (например, редирект) отключаются, копия — в /root/nginx-backup-*
BACKUP="/root/nginx-backup-$(date +%Y%m%d-%H%M%S)"
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [ -e "$f" ] && [ "$(basename "$f")" != magnat ] || continue
  if grep -qE "server_name[^;]*[[:space:]](www\.)?${DOMAIN//./\\.}[[:space:];]" "$f"; then
    mkdir -p "$BACKUP"; cp -L "$f" "$BACKUP/"; rm -f "$f"
    echo "Отключён старый сайт $f (копия в $BACKUP)"
  fi
done
ln -sf /etc/nginx/sites-available/magnat /etc/nginx/sites-enabled/magnat
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "== Автообновление из GitHub (каждые 5 минут)"
REPO="$(cd "$SRC/.." && pwd)"
cat > /etc/systemd/system/magnat-update.service <<UNIT
[Unit]
Description=МАГНАТ: обновление из git

[Service]
Type=oneshot
ExecStart=/bin/bash $REPO/game/deploy/update.sh --if-changed
UNIT
cat > /etc/systemd/system/magnat-update.timer <<UNIT
[Unit]
Description=МАГНАТ: проверка обновлений

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now magnat-update.timer

echo "== Брандмауэр"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "== HTTPS"
# www — только если для него тоже есть DNS-запись
DOMAINS="-d $DOMAIN"
if getent hosts "www.$DOMAIN" >/dev/null; then DOMAINS="$DOMAINS -d www.$DOMAIN"; fi
certbot --nginx $DOMAINS --non-interactive --agree-tos --register-unsafely-without-email --redirect \
  || echo "!! Сертификат не получен: проверьте, что A-запись $DOMAIN указывает на этот сервер, и запустите: certbot --nginx -d $DOMAIN"

echo
echo "Готово: https://$DOMAIN"
echo "Логи: journalctl -u magnat -f    Перезапуск: systemctl restart magnat"
echo "Новые версии из ветки подтягиваются сами каждые 5 минут (журнал: journalctl -u magnat-update)."
