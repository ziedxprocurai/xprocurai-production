#!/bin/bash
# =============================================================
# xProcurAI - Azure Linux VM Server Setup Script
# =============================================================
# Run this script ONCE on a fresh Ubuntu 22.04/24.04 Azure VM.
# Usage: chmod +x setup-server.sh && sudo ./setup-server.sh
# =============================================================

set -euo pipefail

echo "=========================================="
echo " xProcurAI - Server Setup"
echo "=========================================="

# ---- 1. System update ----
echo "[1/9] Updating system packages..."
apt update && apt upgrade -y

# ---- 2. Install Node.js 20 LTS ----
echo "[2/9] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# ---- 3. Install PM2 globally ----
echo "[3/9] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u xprocurai --hp /home/xprocurai || true

# ---- 4. Install PostgreSQL 16 ----
echo "[4/9] Installing PostgreSQL 16..."
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
apt update
apt install -y postgresql-16 postgresql-client-16

# Start and enable PostgreSQL
systemctl enable postgresql
systemctl start postgresql

echo "PostgreSQL version: $(psql --version)"

# ---- 5. Configure PostgreSQL ----
echo "[5/9] Configuring PostgreSQL..."
sudo -u postgres psql <<EOF
CREATE USER xprocurai WITH PASSWORD 'CHANGE_THIS_PASSWORD';
CREATE DATABASE xprocurai_db OWNER xprocurai;
GRANT ALL PRIVILEGES ON DATABASE xprocurai_db TO xprocurai;
\q
EOF

# Allow password authentication for local connections
PG_HBA=$(find /etc/postgresql -name pg_hba.conf | head -1)
if [ -n "$PG_HBA" ]; then
  # Add rule before the default local rules
  sed -i '/^local\s\+all\s\+all/i local   xprocurai_db    xprocurai                               md5' "$PG_HBA"
  systemctl restart postgresql
fi

echo "PostgreSQL configured with user 'xprocurai' and database 'xprocurai_db'"

# ---- 6. Install Redis 7 ----
echo "[6/9] Installing Redis 7..."
apt install -y redis-server

# Configure Redis for production
sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf

systemctl enable redis-server
systemctl restart redis-server
echo "Redis version: $(redis-server --version)"

# ---- 7. Install Nginx ----
echo "[7/9] Installing Nginx..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx

# ---- 8. Install Certbot for SSL ----
echo "[8/9] Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# ---- 9. Create application user and directories ----
echo "[9/9] Creating application user and directories..."

# Create system user if it doesn't exist
if ! id -u xprocurai &>/dev/null; then
  useradd --system --create-home --shell /bin/bash xprocurai
fi

# Create application directory
mkdir -p /opt/xprocurai
chown -R xprocurai:xprocurai /opt/xprocurai

# Create log directory
mkdir -p /var/log/xprocurai
chown -R xprocurai:xprocurai /var/log/xprocurai

# Create certbot webroot
mkdir -p /var/www/certbot

# ---- Firewall ----
echo "Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Edit /opt/xprocurai/.env with production values"
echo "  2. Update PostgreSQL password in .env (change CHANGE_THIS_PASSWORD above)"
echo "  3. Deploy application code to /opt/xprocurai/"
echo "  4. Run: cd /opt/xprocurai && npm install && npm run build"
echo "  5. Run: npm run db:generate && npm run db:push"
echo "  6. Configure Nginx: cp deploy/nginx.conf /etc/nginx/sites-available/xprocurai"
echo "  7. Enable Nginx site: ln -s /etc/nginx/sites-available/xprocurai /etc/nginx/sites-enabled/"
echo "  8. Remove default: rm /etc/nginx/sites-enabled/default"
echo "  9. Get SSL cert: sudo certbot --nginx -d yourdomain.com"
echo " 10. Start app: npm run pm2:start"
echo " 11. Save PM2 config: pm2 save"
echo ""
