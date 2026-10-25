#!/usr/bin/env bash
# Обновить игру на сервере из git (запускать от root):
#   bash game/deploy/update.sh              — обновить и перезапустить
#   bash game/deploy/update.sh --if-changed — только если в ветке есть новое (так делает таймер magnat-update)
# Сохранения комнат (server-data) не трогаются.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$SRC/.." && pwd)"
git -C "$REPO" fetch -q origin
if [ "${1:-}" = --if-changed ] && [ "$(git -C "$REPO" rev-parse HEAD)" = "$(git -C "$REPO" rev-parse '@{u}')" ]; then exit 0; fi
git -C "$REPO" merge -q --ff-only '@{u}'
rsync -a --delete --exclude server-data --exclude node_modules --exclude assets/icons/raw "$SRC/" /opt/magnat/
chown -R magnat:magnat /opt/magnat
systemctl restart magnat
echo "Обновлено до $(git -C "$REPO" log -1 --format='%h %s'). Логи: journalctl -u magnat -f"
