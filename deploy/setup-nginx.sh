#!/usr/bin/env bash
set -euo pipefail

VIEWER_ROOT="/home/dm/apps/logic-command-center/viewer"
MANIFESTS_ROOT="/home/dm/apps/logic-command-center/manifests"
CONF_SRC="/home/dm/apps/logic-command-center/nginx-default.conf"
CONF_DST="/etc/nginx/sites-available/default"

if [ ! -f "${VIEWER_ROOT}/index.html" ]; then
  echo "ERROR: viewer not found: ${VIEWER_ROOT}/index.html" >&2
  exit 1
fi

if [ ! -d "${MANIFESTS_ROOT}" ]; then
  echo "ERROR: manifests dir not found: ${MANIFESTS_ROOT}" >&2
  exit 1
fi

if [ ! -f "${CONF_SRC}" ]; then
  echo "ERROR: nginx conf not found: ${CONF_SRC}" >&2
  exit 1
fi

ts="$(date +%F_%H%M%S)"

echo "[1/4] Backup nginx default site"
sudo cp "${CONF_DST}" "${CONF_DST}.bak.${ts}"

echo "[2/4] Install logic viewer default site"
sudo cp "${CONF_SRC}" "${CONF_DST}"

echo "[3/4] nginx -t"
sudo nginx -t

echo "[4/4] reload nginx"
sudo systemctl reload nginx

echo "DONE: open http://107.175.76.239/"

