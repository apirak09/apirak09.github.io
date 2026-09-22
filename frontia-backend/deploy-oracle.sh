#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
umask 077

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

if [ ! -f .env ]; then
  PUBLIC_IP="$(curl -4 --connect-timeout 10 --max-time 20 -fsS https://api.ipify.org)"
  if [[ ! "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    echo "Could not determine public IPv4. Create .env from .env.example."
    exit 1
  fi
  DASH_IP="${PUBLIC_IP//./-}"
  DOMAIN="${DASH_IP}.nip.io"
  APP_PASSWORD="$(openssl rand -hex 24)"
  cat > .env <<EOF
DOMAIN=${DOMAIN}
APP_PASSWORD=${APP_PASSWORD}
ALLOWED_ORIGIN=https://apirak09.github.io
EOF
else
  echo "Keeping the existing .env and persistent saves."
fi
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
echo "Backend URL and private password are in ${SCRIPT_DIR}/.env"
echo
echo "IMPORTANT: OCI Security List / NSG must allow inbound TCP 80 and 443."
echo "Then open https://apirak09.github.io/frontia/ -> Settings"
echo "and enter the HTTPS domain and password from that file."
echo "============================================================"
