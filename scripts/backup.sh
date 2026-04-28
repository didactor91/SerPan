#!/bin/bash
set -e

BACKUP_DIR="${BACKUP_DIR:-/var/serverctrl/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "[ServerCtrl] Starting backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup SQLite database
if [ -f "/opt/serverctrl/apps/api/data/serverctrl.db" ]; then
    echo "[ServerCtrl] Backing up database..."
    cp "/opt/serverctrl/apps/api/data/serverctrl.db" "$BACKUP_DIR/serverctrl_${TIMESTAMP}.db"
fi

# Backup environment file
if [ -f "/opt/serverctrl/.env" ]; then
    echo "[ServerCtrl] Backing up environment..."
    cp "/opt/serverctrl/.env" "$BACKUP_DIR/.env_${TIMESTAMP}"
fi

# Backup Caddy config
if [ -f "/etc/caddy/Caddyfile" ]; then
    echo "[ServerCtrl] Backing up Caddy config..."
    sudo cp /etc/caddy/Caddyfile "$BACKUP_DIR/Caddyfile_${TIMESTAMP}"
fi

# Cleanup old backups (keep last 7)
echo "[ServerCtrl] Cleaning up old backups..."
find "$BACKUP_DIR" -name "serverctrl_*.db" -mtime +7 -delete
find "$BACKUP_DIR" -name ".env_*" -mtime +7 -delete
find "$BACKUP_DIR" -name "Caddyfile_*" -mtime +7 -delete

echo "[ServerCtrl] Backup complete: $BACKUP_DIR"