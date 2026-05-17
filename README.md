# xProcurAI

**Supplier Intelligence Platform — B2B SaaS**

A scalable monorepo architecture for enterprise procurement workflows. Runs natively on Linux servers — no Docker required.

---

## Tech Stack

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| **Frontend**   | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| **Backend**    | NestJS 10, Prisma ORM, PostgreSQL 16, Swagger                |
| **Auth**       | JWT (access + refresh tokens), Passport.js                   |
| **Cache**      | Redis 7                                                       |
| **Monorepo**   | npm Workspaces, Turborepo                                     |
| **Production** | Azure Linux VM, PM2 / systemd, Nginx, Let's Encrypt SSL     |

---

## Project Structure

```
xProcurAI/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/            # App Router pages & layouts
│   │   │   └── lib/            # Utilities, env config
│   │   ├── public/             # Static assets
│   │   ├── next.config.ts
│   │   ├── postcss.config.mjs
│   │   └── tsconfig.json
│   │
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── auth/           # JWT auth module (guards, strategies)
│       │   ├── health/         # Health check endpoint
│       │   ├── prisma/         # Prisma database service
│       │   ├── redis/          # Redis cache service
│       │   ├── app.module.ts   # Root module
│       │   └── main.ts         # Bootstrap & Swagger setup
│       ├── prisma/
│       │   └── schema.prisma   # Database schema
│       ├── nest-cli.json
│       └── tsconfig.json
│
├── packages/
│   ├── ui/                     # Shared React UI components (shadcn/ui)
│   │   └── src/
│   │       ├── components/     # Button, etc.
│   │       └── lib/            # cn() utility
│   ├── types/                  # Shared TypeScript types
│   │   └── src/
│   │       ├── api.ts          # API response types
│   │       ├── auth.ts         # Auth types
│   │       └── common.ts       # Base entity types
│   └── config/                 # Shared configuration constants
│       └── src/
│           ├── constants.ts    # App defaults
│           └── site.ts         # Site metadata
│
├── deploy/                     # Production deployment configs
│   ├── nginx.conf              # Nginx reverse proxy config
│   ├── xprocurai-api.service   # systemd unit for API
│   ├── xprocurai-web.service   # systemd unit for Web
│   ├── setup-server.sh         # One-time Azure VM setup script
│   └── deploy.sh               # Repeatable deployment script
│
├── ecosystem.config.js         # PM2 process manager config
├── turbo.json                  # Turborepo pipeline config
├── tsconfig.json               # Base TypeScript config
├── eslint.config.mjs           # Flat ESLint config
├── .prettierrc                 # Prettier config
├── .env.example                # Environment variable template
└── package.json                # Root workspace config
```

---

## Prerequisites

- **Node.js** >= 20.x
- **npm** >= 10.x
- **PostgreSQL** >= 16.x (installed natively)
- **Redis** >= 7.x (installed natively)

---

# Part 1 — Local Development Setup (Laptop)

Everything runs directly on your machine. No Docker.

## 1.1 Install PostgreSQL Locally

### Windows

1. Download installer from https://www.postgresql.org/download/windows/
2. Run the installer, keep default port `5432`
3. Set a password for the `postgres` superuser
4. After install, open **pgAdmin** or **psql** and run:

```sql
CREATE USER xprocurai WITH PASSWORD 'xprocurai_secret';
CREATE DATABASE xprocurai_db OWNER xprocurai;
GRANT ALL PRIVILEGES ON DATABASE xprocurai_db TO xprocurai;
```

### macOS

```bash
brew install postgresql@16
brew services start postgresql@16
createuser -s xprocurai
psql -U xprocurai -c "ALTER USER xprocurai PASSWORD 'xprocurai_secret';"
createdb -U xprocurai xprocurai_db
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16
sudo systemctl enable postgresql
sudo systemctl start postgresql

sudo -u postgres psql <<EOF
CREATE USER xprocurai WITH PASSWORD 'xprocurai_secret';
CREATE DATABASE xprocurai_db OWNER xprocurai;
GRANT ALL PRIVILEGES ON DATABASE xprocurai_db TO xprocurai;
EOF
```

### Verify

```bash
psql -h localhost -U xprocurai -d xprocurai_db -c "SELECT version();"
```

## 1.2 Install Redis Locally

### Windows

Redis doesn't natively support Windows. Use one of:
- **Memurai** (Redis-compatible): https://www.memurai.com/
- **WSL2**: Install Ubuntu in WSL2, then follow the Ubuntu instructions below

### macOS

```bash
brew install redis
brew services start redis
redis-cli ping   # Should return PONG
```

### Ubuntu / Debian

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping   # Should return PONG
```

## 1.3 Clone & Configure

```bash
git clone <repo-url> xProcurAI
cd xProcurAI
cp .env.example .env
```

Edit `.env` — the defaults work for local development. Set strong values for `JWT_SECRET` and `JWT_REFRESH_SECRET`.

## 1.4 Install Dependencies

```bash
npm install
```

## 1.5 Initialize Database

```bash
npm run db:generate
npm run db:push
```

## 1.6 Start Development Servers

```bash
npm run dev
```

Turborepo runs both apps concurrently:

| Service          | URL                                                              |
| ---------------- | ---------------------------------------------------------------- |
| **Web**          | [http://localhost:3000](http://localhost:3000)                    |
| **API**          | [http://localhost:4000/api](http://localhost:4000/api)            |
| **Swagger Docs** | [http://localhost:4000/api/docs](http://localhost:4000/api/docs)  |
| **Prisma Studio**| Run `npm run db:studio` → [http://localhost:5555](http://localhost:5555) |

---

# Part 2 — Available Scripts

| Script                | Description                               |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | Start all apps in dev mode                |
| `npm run build`       | Build all apps and packages               |
| `npm run build:web`   | Build only the web app                    |
| `npm run build:api`   | Build only the API                        |
| `npm run lint`        | Lint all workspaces                       |
| `npm run format`      | Format code with Prettier                 |
| `npm run format:check`| Check formatting                          |
| `npm run type-check`  | Run TypeScript type checking              |
| `npm run clean`       | Remove all build artifacts & node_modules |
| `npm run db:generate` | Generate Prisma client                    |
| `npm run db:push`     | Push schema to database (dev)             |
| `npm run db:migrate`  | Run Prisma migrations (production)        |
| `npm run db:studio`   | Open Prisma Studio GUI                    |
| `npm run pm2:start`   | Start production services via PM2         |
| `npm run pm2:stop`    | Stop PM2 services                         |
| `npm run pm2:restart` | Restart PM2 services                      |
| `npm run pm2:status`  | Show PM2 process status                   |
| `npm run pm2:logs`    | Tail PM2 logs                             |

---

# Part 3 — Environment Variables

All variables are defined in `.env.example`. Copy to `.env` for local dev.

| Variable                   | Description                          | Default                         |
| -------------------------- | ------------------------------------ | ------------------------------- |
| `NODE_ENV`                 | Environment mode                     | `development`                   |
| `DATABASE_HOST`            | PostgreSQL host                      | `localhost`                     |
| `DATABASE_PORT`            | PostgreSQL port                      | `5432`                          |
| `DATABASE_USER`            | PostgreSQL user                      | `xprocurai`                     |
| `DATABASE_PASSWORD`        | PostgreSQL password                  | `xprocurai_secret`              |
| `DATABASE_NAME`            | PostgreSQL database name             | `xprocurai_db`                  |
| `DATABASE_URL`             | Full connection string               | Composed from above             |
| `REDIS_HOST`               | Redis hostname                       | `localhost`                     |
| `REDIS_PORT`               | Redis port                           | `6379`                          |
| `REDIS_PASSWORD`           | Redis password (empty for local)     | _(empty)_                       |
| `JWT_SECRET`               | Access token secret                  | **Must be changed**             |
| `JWT_EXPIRATION`           | Access token TTL (seconds)           | `3600`                          |
| `JWT_REFRESH_SECRET`       | Refresh token secret                 | **Must be changed**             |
| `JWT_REFRESH_EXPIRATION`   | Refresh token TTL (seconds)          | `604800`                        |
| `API_PORT`                 | API server port                      | `4000`                          |
| `API_PREFIX`               | API route prefix                     | `api`                           |
| `API_CORS_ORIGINS`         | Allowed CORS origins                 | `http://localhost:3000`         |
| `NEXT_PUBLIC_API_URL`      | Frontend API base URL                | `http://localhost:4000/api`     |
| `NEXT_PUBLIC_APP_NAME`     | Application display name             | `xProcurAI`                     |
| `NEXT_PUBLIC_APP_URL`      | Frontend URL                         | `http://localhost:3000`         |

### Production-only variables

| Variable                   | Description                          | Example                         |
| -------------------------- | ------------------------------------ | ------------------------------- |
| `DOMAIN`                   | Production domain                    | `yourdomain.com`                |
| `SSL_CERT_PATH`            | SSL certificate path                 | `/etc/letsencrypt/live/.../...` |
| `SSL_KEY_PATH`             | SSL private key path                 | `/etc/letsencrypt/live/.../...` |
| `PM2_INSTANCES`            | PM2 cluster instances                | `max` or `2`                    |

---

# Part 4 — Azure Linux VM Production Deployment

## 4.1 Provision Azure VM

1. Create an **Azure Virtual Machine**:
   - **Image**: Ubuntu 22.04 LTS or 24.04 LTS
   - **Size**: Standard_B2s (2 vCPU, 4 GB RAM) minimum
   - **Disk**: 30 GB SSD minimum
   - **Networking**: Allow inbound ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
2. SSH into the VM: `ssh your-user@your-vm-ip`

## 4.2 Run Server Setup Script

The `deploy/setup-server.sh` script installs everything on a fresh Ubuntu VM:

```bash
# Copy the repo to the server (or git clone)
cd /opt
sudo git clone <repo-url> xprocurai
cd xprocurai

# Run setup (installs Node.js 20, PostgreSQL 16, Redis 7, Nginx, PM2, Certbot)
sudo chmod +x deploy/setup-server.sh
sudo ./deploy/setup-server.sh
```

This script:
- Installs Node.js 20 LTS, PM2, PostgreSQL 16, Redis 7, Nginx, Certbot
- Creates the `xprocurai` system user
- Creates the PostgreSQL database and user
- Configures Redis for production (memory limits, eviction policy)
- Sets up UFW firewall (SSH + HTTP + HTTPS only)
- Creates `/opt/xprocurai` app directory and `/var/log/xprocurai` log directory

## 4.3 Self-Managed PostgreSQL Strategy

PostgreSQL is installed directly on the VM (not Azure Database for PostgreSQL).

**Post-setup hardening:**

```bash
# Edit PostgreSQL config for production
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Key settings to adjust:
```
max_connections = 100
shared_buffers = 1GB            # 25% of RAM
effective_cache_size = 3GB      # 75% of RAM
maintenance_work_mem = 256MB
work_mem = 16MB
wal_buffers = 64MB
checkpoint_completion_target = 0.9
```

**Backups** — add a daily cron job:
```bash
# /etc/cron.d/xprocurai-backup
0 3 * * * xprocurai pg_dump -h localhost -U xprocurai xprocurai_db | gzip > /var/backups/xprocurai/db-$(date +\%Y\%m\%d).sql.gz
```

## 4.4 Self-Managed Redis Strategy

Redis is installed directly on the VM.

**Production config** (already applied by setup script):
- `supervised systemd` — managed by systemd
- `maxmemory 256mb` — adjust based on your VM RAM
- `maxmemory-policy allkeys-lru` — evict least recently used keys

**Optional password protection:**
```bash
sudo nano /etc/redis/redis.conf
# Set: requirepass YOUR_REDIS_PASSWORD
sudo systemctl restart redis-server
```
Then update `REDIS_PASSWORD` in your `.env`.

## 4.5 Configure Environment

```bash
sudo -u xprocurai cp /opt/xprocurai/.env.example /opt/xprocurai/.env
sudo -u xprocurai nano /opt/xprocurai/.env
```

Set production values:
```
NODE_ENV=production
DATABASE_PASSWORD=<strong-password-from-setup>
JWT_SECRET=<generate-with: openssl rand -base64 64>
JWT_REFRESH_SECRET=<generate-with: openssl rand -base64 64>
API_CORS_ORIGINS=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_APP_URL=https://yourdomain.com
DOMAIN=yourdomain.com
```

## 4.6 Build & Deploy

```bash
cd /opt/xprocurai
sudo -u xprocurai npm install
sudo -u xprocurai npm run db:generate
sudo -u xprocurai npm run db:migrate
sudo -u xprocurai npm run build
```

## 4.7 Process Management — PM2 (Recommended)

```bash
cd /opt/xprocurai
sudo -u xprocurai pm2 start ecosystem.config.js
sudo -u xprocurai pm2 save
sudo -u xprocurai pm2 startup    # generates systemd auto-start
```

PM2 runs the API in **cluster mode** (2+ instances) and the web app in fork mode.

**Useful commands:**
```bash
pm2 status              # process list
pm2 logs                # tail all logs
pm2 restart all         # restart everything
pm2 reload all          # zero-downtime reload
pm2 monit               # real-time dashboard
```

### Alternative: systemd (instead of PM2)

If you prefer systemd over PM2:

```bash
sudo cp deploy/xprocurai-api.service /etc/systemd/system/
sudo cp deploy/xprocurai-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable xprocurai-api xprocurai-web
sudo systemctl start xprocurai-api xprocurai-web
```

Check status: `sudo systemctl status xprocurai-api xprocurai-web`

## 4.8 Nginx Reverse Proxy

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/xprocurai
sudo ln -sf /etc/nginx/sites-available/xprocurai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

**Replace** `yourdomain.com` in the Nginx config with your actual domain.

## 4.9 SSL with Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot auto-configures Nginx and sets up automatic renewal.

Verify auto-renewal: `sudo certbot renew --dry-run`

## 4.10 Verify Deployment

```bash
curl -s http://localhost:4000/api/health | python3 -m json.tool
curl -s https://yourdomain.com/api/health
curl -s https://yourdomain.com
```

## 4.11 Subsequent Deployments

Use the deploy script for updates:

```bash
cd /opt/xprocurai
sudo -u xprocurai chmod +x deploy/deploy.sh
sudo -u xprocurai ./deploy/deploy.sh main
```

This pulls latest code, installs deps, runs migrations, builds, and restarts PM2.

---

# Part 5 — Adding New Features

### Backend module

```bash
cd apps/api
npx nest generate module <module-name>
npx nest generate controller <module-name>
npx nest generate service <module-name>
```

### Shared UI component

Add components to `packages/ui/src/components/` and export from `packages/ui/src/index.ts`.

### Shared types

Add type definitions to `packages/types/src/` and export from `packages/types/src/index.ts`.

---

# Part 6 — Architecture Decisions

- **No Docker** — the platform runs directly on Linux servers (local dev and Azure VMs), which avoids container orchestration complexity for a self-managed setup
- **Turborepo** for incremental builds and task orchestration across workspaces
- **npm Workspaces** for dependency hoisting and package linking
- **Global Prisma module** so any NestJS module can inject `PrismaService`
- **Global Redis module** for shared caching across all services
- **ConfigModule** (global) reads from `.env` files at the monorepo root and app level
- **JWT dual-token strategy**: short-lived access tokens + long-lived refresh tokens
- **PM2 cluster mode** for the API to utilize multiple CPU cores
- **Nginx reverse proxy** handles SSL termination, static asset caching, and rate limiting
- **systemd service files** provided as an alternative to PM2

---

# Part 7 — Migration Note (Docker → Native)

If you previously had the Docker-based version of this scaffold, here is what changed:

### Files deleted

| File                       | Reason                                        |
| -------------------------- | --------------------------------------------- |
| `docker-compose.yml`       | Replaced by native PostgreSQL + Redis install |
| `.dockerignore`            | No longer needed                              |
| `apps/api/Dockerfile`      | Replaced by PM2 / systemd process management  |
| `apps/web/Dockerfile`      | Replaced by PM2 / systemd process management  |

### Files modified

| File              | Change                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `package.json`    | Removed `docker:*` scripts, added `pm2:*` and `build:web`/`build:api` |
| `.gitignore`      | Replaced Docker entries with PM2 and deploy entries                    |
| `.env.example`    | Added production vars (`DOMAIN`, `SSL_*`, `PM2_INSTANCES`)            |

### Files added

| File                              | Purpose                                      |
| --------------------------------- | -------------------------------------------- |
| `ecosystem.config.js`             | PM2 process configuration                    |
| `deploy/nginx.conf`               | Nginx reverse proxy with SSL + rate limiting |
| `deploy/xprocurai-api.service`    | systemd unit for NestJS API                  |
| `deploy/xprocurai-web.service`    | systemd unit for Next.js web                 |
| `deploy/setup-server.sh`          | One-time Azure VM server provisioning        |
| `deploy/deploy.sh`                | Repeatable deployment / update script        |

### How to migrate

1. Delete the 4 Docker files listed above (already done in this commit)
2. Install PostgreSQL and Redis natively on your dev machine (see Part 1 above)
3. Create the database and user manually (see Section 1.1)
4. Update your `.env` — the defaults in `.env.example` already point to `localhost`
5. Run `npm install && npm run db:generate && npm run db:push && npm run dev`
6. For production: follow Part 4 (Azure VM deployment) instead of `docker-compose up`

---

## License

Private — All rights reserved.
