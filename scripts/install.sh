#!/bin/bash
set -e

echo "[ServerCtrl] Starting installation..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js 20+ required. Found: $(node -v)"
    exit 1
fi

# Install pnpm if not available
if ! command -v pnpm &> /dev/null; then
    echo "[ServerCtrl] Installing pnpm..."
    npm install -g pnpm@9
fi

# Install dependencies
echo "[ServerCtrl] Installing dependencies..."
pnpm install

# Build the project
echo "[ServerCtrl] Building..."
pnpm build

# Create serverctrl user if not exists
if ! id -u serverctrl &> /dev/null; then
    echo "[ServerCtrl] Creating serverctrl user..."
    sudo useradd -r -s /sbin/nologin serverctrl
fi

# Create necessary directories
echo "[ServerCtrl] Creating directories..."
sudo mkdir -p /var/serverctrl/backups
sudo mkdir -p /var/log/serverctrl
sudo mkdir -p /opt/serverctrl
sudo chown -R serverctrl:serverctrl /var/serverctrl
sudo chown -R serverctrl:serverctrl /var/log/serverctrl

# Copy project to /opt/serverctrl
echo "[ServerCtrl] Deploying to /opt/serverctrl..."
sudo cp -r . /opt/serverctrl/
sudo chown -R serverctrl:serverctrl /opt/serverctrl

# Setup PM2 startup
echo "[ServerCtrl] Configuring PM2 startup..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u serverctrl --hp /home/serverctrl 2>/dev/null || true

# Start the application
echo "[ServerCtrl] Starting application..."
sudo -u serverctrl env PATH=$PATH:/usr/bin pm2 start /opt/serverctrl/ecosystem.config.js
sudo -u serverctrl env PATH=$PATH:/usr/bin pm2 save

echo "[ServerCtrl] Installation complete!"
echo "[ServerCtrl] Access the panel at http://localhost:4000"