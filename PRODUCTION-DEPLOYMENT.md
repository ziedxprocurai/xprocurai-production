# xProcurAI — Production Deployment Guide

## Netlify + Supabase Stack

---

## 1. Executive Summary

This document provides a complete production deployment procedure for xProcurAI using:

| Layer | Service |
|-------|---------|
| **Frontend + API Routes** | Netlify (Next.js SSR + Serverless Functions) |
| **Database** | Supabase (Managed PostgreSQL) |
| **Authentication** | NextAuth v5 + Google OAuth |
| **ORM** | Prisma (connecting to Supabase PostgreSQL) |

### Architecture Change from Development

The development setup used a separate NestJS API server (`apps/api`) with Redis. The production architecture eliminates this by:

1. Moving all database operations into Next.js API routes (serverless functions on Netlify)
2. Using Prisma directly in API routes to connect to Supabase's managed PostgreSQL
3. Using `jose` for JWT operations (serverless-compatible, no native dependencies)
4. Removing the Redis dependency entirely

The `apps/api` folder remains in the repository for reference/development but is **not deployed** to production.

---

## 2. Environment Variables

### 2.1 Complete Variable Reference

| Variable | Where Set | Public? | Description |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | Netlify env vars | ❌ No | Supabase pooled connection string (port 6543) |
| `DIRECT_DATABASE_URL` | Netlify env vars | ❌ No | Supabase direct connection string (port 5432, for migrations) |
| `NEXTAUTH_SECRET` | Netlify env vars | ❌ No | Random 32+ character secret for session encryption |
| `NEXTAUTH_URL` | Netlify env vars | ❌ No | Production URL: `https://your-domain.com` |
| `GOOGLE_CLIENT_ID` | Netlify env vars | ❌ No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Netlify env vars | ❌ No | Google OAuth client secret |
| `JWT_SECRET` | Netlify env vars | ❌ No | Secret for signing internal access tokens |
| `JWT_REFRESH_SECRET` | Netlify env vars | ❌ No | Secret for signing refresh tokens |
| `JWT_EXPIRATION` | Netlify env vars | ❌ No | Access token TTL in seconds (default: 3600) |
| `JWT_REFRESH_EXPIRATION` | Netlify env vars | ❌ No | Refresh token TTL in seconds (default: 604800) |
| `NEXT_PUBLIC_APP_NAME` | Netlify env vars | ✅ Yes | Display name: `xProcurAI` |
| `NEXT_PUBLIC_APP_URL` | Netlify env vars | ✅ Yes | Production URL: `https://your-domain.com` |
| `NODE_ENV` | Auto-set by Netlify | — | `production` (set automatically) |

### 2.2 Generating Secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# JWT_SECRET
openssl rand -base64 64

# JWT_REFRESH_SECRET
openssl rand -base64 64
```

### 2.3 Supabase Connection Strings

Found in: **Supabase Dashboard → Settings → Database → Connection string**

**Pooled connection (for Netlify serverless — use port 6543):**
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct connection (for migrations only — use port 5432):**
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

> ⚠️ **CRITICAL**: Always use the **pooled** connection (`port 6543` with `?pgbouncer=true`) for `DATABASE_URL` in Netlify. Serverless functions open/close connections frequently — without pooling, you'll exhaust database connections.

---

## 3. Supabase Production Setup

### 3.1 Create Production Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose your organization
4. Set:
   - **Name**: `xprocurai-production`
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
   - **Plan**: Pro (recommended for production)
5. Click **Create new project**
6. Wait for provisioning (~2 minutes)

### 3.2 Get Connection Strings

1. Go to **Settings → Database**
2. Under **Connection string**, select **URI**
3. Copy the **Session mode** URI (pooled, port 6543) → This is your `DATABASE_URL`
4. Copy the **Direct connection** URI (port 5432) → This is your `DIRECT_DATABASE_URL`
5. Replace `[YOUR-PASSWORD]` with the database password you set

### 3.3 Apply Database Schema

From your local machine with the repository cloned:

```bash
cd apps/web

# Set the direct connection URL for migrations
export DIRECT_DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
export DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Push schema to production database
npx prisma db push

# Verify tables were created
npx prisma studio
```

### 3.4 Create Initial Migration (Recommended)

For production, use proper migrations instead of `db push`:

```bash
cd apps/web

# Create initial migration from existing schema
npx prisma migrate dev --name init

# Deploy migration to production
export DATABASE_URL="<direct-connection-string>"
npx prisma migrate deploy
```

### 3.5 Verify Database

1. Go to **Supabase Dashboard → Table Editor**
2. Verify these tables exist:
   - `users`
   - `companies`
   - `products`
   - `rfqs`
   - `erp_connections`
   - `provider_import_documents`
   - `provider_import_records`
   - `imported_providers`
   - `admin_settings`

### 3.6 Row Level Security (RLS)

> **Current Status**: The application uses Prisma for all database access through authenticated API routes. RLS is NOT currently enabled because all access goes through server-side code (Next.js API routes) which authenticates users before making queries.

**Recommendation for production:**

Since all database access is through server-side Prisma (not the Supabase client library), RLS is not strictly required. However, as a defense-in-depth measure:

1. Keep RLS **disabled** for now (Prisma uses the `postgres` role which bypasses RLS)
2. If you later add direct Supabase client access from the browser, enable RLS on all tables
3. Do NOT expose the Supabase `anon` key to the frontend unless you implement RLS policies

### 3.7 Configure Auth Providers (Optional)

If you want to use Supabase Auth in the future (currently using NextAuth):

1. Go to **Authentication → Providers**
2. Enable **Google**
3. Add Google OAuth credentials

> **Current implementation uses NextAuth v5**, not Supabase Auth. Google OAuth is configured through NextAuth callbacks in the Next.js application.

---

## 4. Google OAuth Production Setup

### 4.1 Google Cloud Console Configuration

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Select your project (or create a new one for production)
3. Go to **OAuth consent screen**:
   - Set **User Type** to **External**
   - Fill in app name: `xProcurAI`
   - Add authorized domain: `your-domain.com`
   - Add authorized domain: `netlify.app` (if using Netlify subdomain)
   - Save

### 4.2 Create OAuth Client ID

1. Go to **Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: `xProcurAI Production`
4. **Authorized JavaScript origins**:
   ```
   https://your-domain.com
   https://your-site-name.netlify.app
   ```
5. **Authorized redirect URIs**:
   ```
   https://your-domain.com/api/auth/callback/google
   https://your-site-name.netlify.app/api/auth/callback/google
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### 4.3 Development vs Production Credentials

| Environment | JavaScript Origins | Redirect URIs |
|-------------|-------------------|---------------|
| Development | `http://localhost:3000` | `http://localhost:3000/api/auth/callback/google` |
| Production | `https://your-domain.com` | `https://your-domain.com/api/auth/callback/google` |

**Recommendation**: Use separate OAuth client IDs for development and production.

### 4.4 How NextAuth Handles Google OAuth

The flow is:
1. User clicks "Sign in with Google"
2. NextAuth redirects to Google's consent screen
3. Google redirects back to `/api/auth/callback/google`
4. NextAuth creates/updates the user in the database via Prisma
5. A JWT session token is set in a secure cookie

The callback URL is automatically constructed by NextAuth based on `NEXTAUTH_URL`.

---

## 5. Netlify Production Setup

### 5.1 Connect Repository

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site → Import an existing project**
3. Connect your Git provider (GitHub/GitLab/Bitbucket)
4. Select the `xProcurAI` repository
5. Configure build settings:

| Setting | Value |
|---------|-------|
| **Base directory** | `apps/web` |
| **Build command** | `cd ../.. && npm install && cd apps/web && npx prisma generate && npx next build` |
| **Publish directory** | `apps/web/.next` |
| **Functions directory** | _(leave empty — Next.js handles this)_ |

> **Note**: Netlify's `@netlify/plugin-nextjs` automatically detects Next.js and configures serverless functions for API routes and SSR pages.

### 5.2 Set Node.js Version

In Netlify Dashboard → Site settings → Build & deploy → Environment:

| Variable | Value |
|----------|-------|
| `NODE_VERSION` | `20` |

### 5.3 Add Environment Variables

In Netlify Dashboard → Site settings → Environment variables, add ALL variables from Section 2.1:

```
DATABASE_URL = postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_DATABASE_URL = postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres
NEXTAUTH_SECRET = <generated-secret>
NEXTAUTH_URL = https://your-domain.com
GOOGLE_CLIENT_ID = <your-google-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = <your-google-client-secret>
JWT_SECRET = <generated-secret>
JWT_REFRESH_SECRET = <generated-secret>
JWT_EXPIRATION = 3600
JWT_REFRESH_EXPIRATION = 604800
NEXT_PUBLIC_APP_NAME = xProcurAI
NEXT_PUBLIC_APP_URL = https://your-domain.com
```

### 5.4 Deploy

1. Push to your production branch (usually `main`)
2. Netlify will automatically build and deploy
3. Check deployment logs for errors
4. Visit your site URL to verify

### 5.5 Custom Domain

1. Go to **Domain management → Add custom domain**
2. Enter your domain: `your-domain.com`
3. Follow DNS configuration instructions:
   - Add a CNAME record pointing to your Netlify site
   - Or configure Netlify DNS
4. Enable HTTPS (automatic with Let's Encrypt)
5. After domain is active, update:
   - `NEXTAUTH_URL` → `https://your-domain.com`
   - `NEXT_PUBLIC_APP_URL` → `https://your-domain.com`
   - Google OAuth redirect URIs

### 5.6 Deploy Previews

Netlify automatically creates deploy previews for pull requests. For these to work with auth:

1. Add the Netlify deploy preview URL pattern to Google OAuth:
   - Authorized JavaScript origins: `https://deploy-preview-*--your-site.netlify.app`
   - Authorized redirect URIs: Not supported with wildcards — deploy previews may not have working OAuth

**Recommendation**: Use branch deploys for staging instead of deploy previews for auth testing.

### 5.7 netlify.toml

The `apps/web/netlify.toml` file is already configured with:
- Build settings
- Security headers
- Cache control for static assets
- Next.js plugin

---

## 6. Domain Change Procedure

When the production domain changes, update these locations:

### 6.1 Netlify
- [ ] Site settings → Domain management → Update/add new domain
- [ ] Environment variables → Update `NEXTAUTH_URL`
- [ ] Environment variables → Update `NEXT_PUBLIC_APP_URL`

### 6.2 Google OAuth Console
- [ ] OAuth consent screen → Authorized domains → Add new domain
- [ ] Credentials → OAuth Client ID → Authorized JavaScript origins → Add new origin
- [ ] Credentials → OAuth Client ID → Authorized redirect URIs → Add new callback URL

### 6.3 Supabase (if using Supabase Auth in future)
- [ ] Authentication → URL Configuration → Site URL
- [ ] Authentication → URL Configuration → Redirect URLs

### 6.4 Codebase
- No code changes needed. All domain references use environment variables.

### 6.5 DNS
- [ ] Update DNS records to point to Netlify
- [ ] Wait for propagation (up to 48 hours)
- [ ] Verify HTTPS certificate is issued

---

## 7. Security Checklist

### 7.1 Secrets & Keys
- [ ] All secrets generated with cryptographically secure randomness
- [ ] No secrets committed to Git (`.env` is in `.gitignore`)
- [ ] `GOOGLE_CLIENT_SECRET` is server-side only (no `NEXT_PUBLIC_` prefix)
- [ ] `DATABASE_URL` is server-side only
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are server-side only
- [ ] No hardcoded secrets in source code

### 7.2 Authentication
- [ ] NextAuth session uses JWT strategy with 7-day expiry
- [ ] Access tokens expire in 1 hour
- [ ] Refresh tokens expire in 7 days
- [ ] Failed auth attempts don't leak user existence
- [ ] Debug/session endpoint disabled in production

### 7.3 API Routes
- [ ] All protected routes check authentication via `getAuthenticatedUser()`
- [ ] Admin routes check `requireAdmin()`
- [ ] No raw database errors exposed to clients
- [ ] Input validation on all POST/PATCH routes

### 7.4 Database
- [ ] Using Supabase's managed PostgreSQL (automated backups)
- [ ] Connection pooling via PgBouncer (port 6543)
- [ ] Database password is strong and unique
- [ ] No public access to database (only through Supabase connection strings)

### 7.5 Netlify Security Headers
Applied via `netlify.toml`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 7.6 Dependency Security
```bash
# Run audit before deploying
npm audit
# Fix if possible
npm audit fix
```

---

## 8. Local Production Simulation

### 8.1 Prerequisites
- Node.js >= 20
- npm >= 10
- Local PostgreSQL (or Supabase dev project)

### 8.2 Setup

```bash
# Clone and install
git clone <repo-url> xProcurAI
cd xProcurAI
npm install

# Configure environment
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local with your values

# Generate Prisma client
cd apps/web
npx prisma generate

# Push schema to database
npx prisma db push

# Build for production
npx next build

# Start production server
npx next start
```

### 8.3 Testing Checklist

| Test | How |
|------|-----|
| Landing page loads | Visit `http://localhost:3000` |
| Google sign-in works | Click "Sign in with Google" |
| Session persists | Refresh page after login |
| Onboarding works | Complete company registration |
| Dashboard loads | Visit `/dashboard` after onboarding |
| Products CRUD | Create/view products |
| RFQs work | Create/view RFQs |
| Admin panel | Visit `/admin` with admin user |
| Logout works | Sign out and verify redirect |
| Protected routes redirect | Visit `/dashboard` while logged out |

---

## 9. Final Deployment Procedure (Zero to Production)

### Step 1: Prerequisites
- [ ] Supabase account (Pro plan recommended)
- [ ] Netlify account
- [ ] Google Cloud Console project with OAuth configured
- [ ] Git repository with latest code pushed
- [ ] Domain name (optional — can use Netlify subdomain initially)

### Step 2: Supabase Setup
- [ ] Create production project
- [ ] Note the database password
- [ ] Copy pooled connection string (port 6543) → `DATABASE_URL`
- [ ] Copy direct connection string (port 5432) → `DIRECT_DATABASE_URL`
- [ ] Apply schema: `cd apps/web && DATABASE_URL="<direct-url>" npx prisma db push`
- [ ] Verify tables in Supabase Table Editor

### Step 3: Google OAuth Setup
- [ ] Create OAuth consent screen (External, add production domain)
- [ ] Create OAuth client ID (Web application)
- [ ] Add authorized JavaScript origins
- [ ] Add authorized redirect URIs
- [ ] Copy Client ID and Client Secret

### Step 4: Netlify Setup
- [ ] Import repository
- [ ] Set base directory: `apps/web`
- [ ] Set build command: `cd ../.. && npm install && cd apps/web && npx prisma generate && npx next build`
- [ ] Set publish directory: `apps/web/.next`
- [ ] Set `NODE_VERSION=20`
- [ ] Add all environment variables (Section 2.1)

### Step 5: First Deployment
- [ ] Trigger deploy (push to main or manual deploy)
- [ ] Monitor build logs for errors
- [ ] Verify site loads at Netlify URL
- [ ] Test Google sign-in
- [ ] Test database operations (create company, etc.)

### Step 6: Custom Domain (when ready)
- [ ] Add domain in Netlify
- [ ] Configure DNS records
- [ ] Wait for HTTPS provisioning
- [ ] Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL`
- [ ] Update Google OAuth redirect URIs
- [ ] Redeploy

### Step 7: Post-Deployment Verification
- [ ] Landing page loads correctly
- [ ] Google OAuth login works end-to-end
- [ ] User is created in Supabase database
- [ ] Onboarding flow completes
- [ ] Dashboard shows correct data
- [ ] API routes return expected responses
- [ ] Admin panel accessible to admin users
- [ ] Logout works correctly
- [ ] Protected routes redirect to sign-in

---

## 10. Rollback Procedure

### Netlify Rollback
1. Go to **Deploys** tab in Netlify
2. Find the last known good deployment
3. Click **Publish deploy**
4. Site immediately reverts to that version

### Database Rollback
1. Supabase provides **daily automated backups** (Pro plan)
2. Go to **Settings → Database → Backups**
3. Select a backup point
4. Restore (creates a new project — you'll need to update connection strings)

### Emergency: Disable Site
1. Netlify → Site settings → Danger zone → Disable site
2. Or: Remove environment variables to prevent database access

---

## 11. Maintenance Checklist

### Weekly
- [ ] Check Netlify deployment logs for errors
- [ ] Review Supabase database size and usage
- [ ] Check for npm security advisories: `npm audit`

### Monthly
- [ ] Update dependencies: `npm update`
- [ ] Review and rotate JWT secrets (if policy requires)
- [ ] Check Supabase billing/usage
- [ ] Review Google OAuth consent screen status

### Quarterly
- [ ] Full security audit
- [ ] Load testing
- [ ] Dependency major version updates
- [ ] Review and clean up unused database records

---

## 12. Troubleshooting

### Build Fails on Netlify

**"Cannot find module '@prisma/client'"**
- Ensure `prisma generate` runs before `next build`
- Check that `prisma` is in `devDependencies` and `@prisma/client` in `dependencies`

**"prisma schema not found"**
- Verify `apps/web/prisma/schema.prisma` exists
- Check the base directory is set to `apps/web`

### Database Connection Errors

**"Too many connections"**
- Ensure `DATABASE_URL` uses port `6543` with `?pgbouncer=true`
- This enables connection pooling

**"Connection timeout"**
- Check Supabase project is not paused (free tier pauses after 7 days)
- Verify the region matches your Netlify deployment region

### Auth Issues

**"NEXTAUTH_URL mismatch"**
- Ensure `NEXTAUTH_URL` exactly matches your deployment URL (including `https://`)
- No trailing slash

**"Google OAuth redirect mismatch"**
- The callback URL must be exactly: `https://your-domain.com/api/auth/callback/google`
- Check both Authorized redirect URIs in Google Console

**"Session not persisting"**
- Check `NEXTAUTH_SECRET` is set and consistent across deploys
- Clear browser cookies and retry

### Prisma Issues in Serverless

**"PrismaClient is not configured to run in this environment"**
- Use the pooled connection string
- Ensure `prisma/schema.prisma` has `directUrl` configured
- The schema should use `datasourceUrl` for runtime and `directUrl` for migrations

---

## 13. Files Changed for Production

| File | Change |
|------|--------|
| `.env.example` | Updated for Supabase/Netlify stack |
| `.gitignore` | Added Netlify and web Prisma entries |
| `apps/web/package.json` | Added Prisma, jose, AI, xlsx deps; updated scripts |
| `apps/web/netlify.toml` | **NEW** — Netlify deployment config |
| `apps/web/prisma/schema.prisma` | **NEW** — Prisma schema with `directUrl` |
| `apps/web/src/lib/auth.ts` | Refactored to use Prisma directly |
| `apps/web/src/lib/prisma.ts` | **NEW** — Prisma client singleton |
| `apps/web/src/lib/jwt.ts` | **NEW** — JWT utilities using `jose` |
| `apps/web/src/lib/api-auth.ts` | **NEW** — Auth helper for API routes |
| `apps/web/src/lib/env.ts` | Removed `API_URL`, simplified |
| `apps/web/src/lib/backend-token.ts` | Deprecated (no longer needed) |
| `apps/web/src/app/api/companies/route.ts` | Uses Prisma directly |
| `apps/web/src/app/api/companies/me/route.ts` | Uses Prisma directly |
| `apps/web/src/app/api/products/route.ts` | Uses Prisma directly |
| `apps/web/src/app/api/rfqs/route.ts` | Uses Prisma directly |
| `apps/web/src/app/api/rfqs/sent/route.ts` | Uses Prisma directly |
| `apps/web/src/app/api/rfqs/received/route.ts` | Uses Prisma directly |
| `apps/web/src/app/api/rfqs/[id]/route.ts` | Uses Prisma directly |
| `apps/web/src/app/api/debug/session/route.ts` | Disabled in production |
| `packages/config/src/site.ts` | Uses env var for URL |
| `packages/database/` | **NEW** — Shared database package (optional) |

---

## 14. Remaining API Routes to Refactor

The following routes still use the old NestJS proxy pattern and should be refactored following the same pattern as the routes above:

| Route | Status |
|-------|--------|
| `api/products/[id]/route.ts` | Needs refactoring |
| `api/products/search/route.ts` | Needs refactoring |
| `api/erp/route.ts` | Needs refactoring |
| `api/admin/companies/route.ts` | Needs refactoring |
| `api/admin/companies/[id]/verification-status/route.ts` | Needs refactoring |
| `api/admin/provider-import-settings/route.ts` | Needs refactoring |
| `api/admin/provider-import-settings/test/route.ts` | Needs refactoring |
| `api/provider-import/documents/route.ts` | Needs refactoring |
| `api/provider-import/documents/[id]/route.ts` | Needs refactoring |
| `api/provider-import/documents/[id]/import/route.ts` | Needs refactoring |
| `api/provider-import/records/[id]/route.ts` | Needs refactoring |
| `api/provider-import/upload/route.ts` | Needs refactoring |
| `api/provider-import/imported-providers/route.ts` | Needs refactoring |

**Pattern to follow:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  // Direct Prisma query instead of fetch to NestJS
  const data = await prisma.someModel.findMany({ ... });
  return NextResponse.json(data);
}
```

---

## 15. What Stays in Development Only

| Component | Purpose | Production Status |
|-----------|---------|-------------------|
| `apps/api/` | NestJS backend | **NOT DEPLOYED** — replaced by Next.js API routes |
| Redis | Caching layer | **NOT NEEDED** — removed from architecture |
| PM2 / ecosystem.config.js | Process manager | **NOT NEEDED** — Netlify manages processes |
| `deploy/` folder | Azure VM configs | **NOT NEEDED** — Netlify handles deployment |
| Nginx config | Reverse proxy | **NOT NEEDED** — Netlify handles routing |

---
