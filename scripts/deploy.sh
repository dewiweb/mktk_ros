#!/usr/bin/env bash
# Deploy the AV-Router UI to a MikroTik router via SCP.
# Usage:
#   ROUTER_IP=192.168.88.1 ROUTER_USER=admin ./scripts/deploy.sh
# The router needs the ssh service enabled (/ip service set ssh disabled=no).
# RouterOS accepts SCP uploads into Files/ — files land at <file-system-root>/avui/...

set -euo pipefail

ROUTER_IP="${ROUTER_IP:-192.168.88.1}"
ROUTER_USER="${ROUTER_USER:-admin}"
DEST_DIR="${DEST_DIR:-avui}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Deploying to ${ROUTER_USER}@${ROUTER_IP} (Files/${DEST_DIR}/)"

# Directory must exist first (SCP can't mkdir on RouterOS)
ssh "${ROUTER_USER}@${ROUTER_IP}" \
  "/file add name=\"${DEST_DIR}\" type=directory" 2>/dev/null || true
ssh "${ROUTER_USER}@${ROUTER_IP}" \
  "/file add name=\"${DEST_DIR}/css\" type=directory" 2>/dev/null || true
ssh "${ROUTER_USER}@${ROUTER_IP}" \
  "/file add name=\"${DEST_DIR}/js\" type=directory" 2>/dev/null || true

scp "${HERE}/index.html" "${ROUTER_USER}@${ROUTER_IP}:${DEST_DIR}/index.html"
scp "${HERE}/css/style.css" "${ROUTER_USER}@${ROUTER_IP}:${DEST_DIR}/css/style.css"
scp "${HERE}/js/api.js" "${ROUTER_USER}@${ROUTER_IP}:${DEST_DIR}/js/api.js"
scp "${HERE}/js/views.js" "${ROUTER_USER}@${ROUTER_IP}:${DEST_DIR}/js/views.js"
scp "${HERE}/js/app.js" "${ROUTER_USER}@${ROUTER_IP}:${DEST_DIR}/js/app.js"

echo "Done. Open:  https://${ROUTER_IP}/${DEST_DIR}/index.html"
echo "(Login with your 'avui' user created by setup/routeros-setup.rsc)"
