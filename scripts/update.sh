#!/bin/bash
set -e

echo "[ServerCtrl] Starting update..."

cd /opt/serverctrl

# Pull latest changes
echo "[ServerCtrl] Pulling latest changes..."
git pull

# Install dependencies
echo "[ServerCtrl] Installing dependencies..."
pnpm install

# Build
echo "[ServerCtrl] Building..."
pnpm build

# Restart PM2
echo "[ServerCtrl] Restarting application..."
pm2 reload serverctrl

echo "[ServerCtrl] Update complete!"