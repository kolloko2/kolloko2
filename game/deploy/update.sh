#!/usr/bin/env bash
# Обновить игру на сервере из git (запускать от root в папке с репозиторием):
#   bash game/deploy/update.sh
# Сохранения комнат (server-data) не трогаются.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
git -C "$SRC" pull --ff-only
rsync -a --delete --exclude server-data --exclude node_modules --exclude assets/icons/raw "$SRC/" /opt/magnat/
chown -R magnat:magnat /opt/magnat
systemctl restart magnat
echo "Обновлено. Логи: journalctl -u magnat -f"
