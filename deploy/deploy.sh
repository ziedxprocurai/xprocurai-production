#!/bin/bash
# =============================================================
# xProcurAI - Deployment Script
# =============================================================
# Run this script to deploy or update the application on the
# Azure Linux VM. Can be run by the 'xprocurai' user.
#
# Usage: chmod +x deploy.sh && ./deploy.sh
# =============================================================

set -euo pipefail

APP_DIR="/opt/xprocurai"
BRANCH="${1:-main}"

echo "=========================================="
echo " xProcurAI - Deploying branch: $BRANCH"
echo "=========================================="

# ---- 1. Pull latest code ----
echo "[1/6] Pulling latest code..."
cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# ---- 2. Install dependencies ----
echo "[2/6] Installing dependencies..."
npm install --production=false

# ---- 3. Generate Prisma client ----
echo "[3/6] Generating Prisma client..."
npm run db:generate

# ---- 4. Run database migrations ----
echo "[4/6] Running database migrations..."
cd apps/api
npx prisma migrate deploy
cd "$APP_DIR"

# ---- 5. Build all apps ----
echo "[5/6] Building applications..."
npm run build

# ---- 6. Restart services ----
echo "[6/6] Restarting services..."

# Option A: PM2 (recommended)
if command -v pm2 &>/dev/null; then
  pm2 restart ecosystem.config.js --update-env
  pm2 save
  echo "Services restarted via PM2."
fi

# Option B: systemd (uncomment if using systemd instead of PM2)
# sudo systemctl restart xprocurai-api
# sudo systemctl restart xprocurai-web
# echo "Services restarted via systemd."

echo ""
echo "=========================================="
echo " Deployment Complete!"
echo "=========================================="
echo ""
echo "Verify:"
echo "  pm2 status"
echo "  curl -s http://localhost:4000/api/health | jq"
echo "  curl -s http://localhost:3000 | head -20"
echo ""
