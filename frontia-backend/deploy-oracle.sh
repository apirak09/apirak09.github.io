#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash deploy-oracle.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git openssl
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

PUBLIC_IP="$(curl -4 -fsS https://api.ipify.org)"
DASH_IP="${PUBLIC_IP//./-}"
DOMAIN="${DASH_IP}.nip.io"
APP_PASSWORD="$(openssl rand -hex 18)"

cat > .env <<EOF
DOMAIN=${DOMAIN}
APP_PASSWORD=${APP_PASSWORD}
ALLOWED_ORIGIN=https://apirak09.github.io
EOF
chmod 600 .env

# Ubuntu firewall, if enabled.
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

docker compose up -d --build

echo
echo "============================================================"
echo "Cinematic Play backend is starting."
echo "Backend URL: https://${DOMAIN}"
echo "Private app password: ${APP_PASSWORD}"
echo
echo "IMPORTANT: OCI Security List / NSG must allow inbound TCP 80 and 443."
echo "Then open https://apirak09.github.io/frontia/ -> Settings"
echo "and paste the Backend URL + password above."
echo "============================================================"
