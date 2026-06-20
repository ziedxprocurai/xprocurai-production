# Netlify Deployment Fix for Next.js 16

## Problem Diagnosis

The issue is that Next.js 16 with the Netlify plugin isn't properly creating/serving serverless functions. The functions are built but not deployed/routed correctly.

## Root Causes

1. **Next.js 16 compatibility**: The `@netlify/plugin-nextjs` has partial compatibility issues with Next.js 16
2. **Monorepo structure**: The `apps/web` base directory causes path resolution issues
3. **CLI vs Git deployment**: CLI deploys don't properly trigger the plugin's post-build hooks

## Complete Fix

### Step 1: Update Dependencies

```bash
cd /mnt/c/xProcurAI/apps/web
npm install @netlify/plugin-nextjs@latest --save-dev
npm install
```

### Step 2: Configure Netlify Site (Dashboard)

1. Go to https://app.netlify.com/projects/xprocurai
2. Click **Site settings → Build & deploy → Build settings**
3. Update settings:
   - **Base directory**: `apps/web`
   - **Build command**: `npm install && npx prisma generate && npm run build`
   - **Publish directory**: `apps/web/.next`
   - **Functions directory**: Leave empty (auto-detected)

4. Go to **Site settings → Build & deploy → Environment**
5. Verify all environment variables are set (you already did this)

6. Go to **Site settings → Build & deploy → Build plugins**
7. If `@netlify/plugin-nextjs` is not listed:
   - Click **Add plugin**
   - Search for `@netlify/plugin-nextjs`
   - Install it

### Step 3: Connect Git Repository

1. Go to **Site settings → Build & deploy → Link repository**
2. Click **Link site to Git**
3. Choose GitHub
4. Select `ziedxprocurai/xprocurai-production`
5. Configure:
   - **Branch to deploy**: `main`
   - **Base directory**: `apps/web`
   - **Build command**: `npm install && npx prisma generate && npm run build`
   - **Publish directory**: `apps/web/.next`

### Step 4: Push and Deploy

```bash
cd /mnt/c/xProcurAI

# Commit the fixes
git add .
git commit -m "Fix Netlify deployment configuration for Next.js 16"

# Push to GitHub
git push github main
```

Netlify will automatically detect the push and start building.

### Step 5: Monitor the Build

1. Go to **Deploys** tab in Netlify dashboard
2. Watch the build logs
3. Look for these key indicators:

**Success indicators:**
```
✓ Next.js Plugin
✓ Packaging Next.js for Netlify
✓ Functions bundled successfully
✓ Edge functions bundled successfully
```

**Failure indicators:**
```
✗ Plugin failed
✗ Functions not found
✗ Build failed
```

### Step 6: Verify Deployment

After build completes:

```bash
# Check if functions exist
curl -I https://xprocurai.netlify.app/

# Should return 200 OK, not 404
```

Visit these URLs:
- https://xprocurai.netlify.app/ (landing page)
- https://xprocurai.netlify.app/auth/signin (sign-in page)
- https://xprocurai.netlify.app/api/auth/session (API route)

All should work without 404 errors.

## Alternative: Downgrade to Next.js 15

If Next.js 16 continues to have issues, downgrade to Next.js 15 (fully supported):

```bash
cd /mnt/c/xProcurAI/apps/web

npm install next@15.1.3 react@18.3.1 react-dom@18.3.1 --save
npm install @types/react@18.3.12 @types/react-dom@18.3.1 --save-dev
```

Then update `apps/web/src/middleware.ts` (no changes needed for Next.js 15).

## Troubleshooting

### Build succeeds but site shows 404

**Cause**: Functions aren't being created or routed correctly.

**Fix**:
1. Check Netlify function logs: https://app.netlify.com/projects/xprocurai/logs/functions
2. Verify the plugin ran: Look for "Next.js Plugin" in build logs
3. Check if edge functions exist: https://app.netlify.com/projects/xprocurai/logs/edge-functions

### Plugin not running

**Cause**: Plugin not installed or disabled.

**Fix**:
1. Go to **Site settings → Build & deploy → Build plugins**
2. Ensure `@netlify/plugin-nextjs` is listed and enabled
3. If not, click **Add plugin** and install it

### Functions created but not accessible

**Cause**: Redirect rules not working.

**Fix**:
1. Check `netlify.toml` has the redirect rule
2. Ensure no conflicting `_redirects` file
3. Try adding `force = true` to the redirect rule

### Environment variables not loading

**Cause**: Variables not set or wrong scope.

**Fix**:
```bash
netlify env:list
```
Ensure all variables show `Scope: All` or `Scope: Builds, Functions`

## Expected File Structure

```
apps/web/
├── .next/                    # Build output (gitignored)
├── .netlify/                 # Netlify build artifacts (gitignored)
│   ├── functions-internal/   # Serverless functions
│   └── edge-functions/       # Edge functions (middleware)
├── public/
│   └── _redirects           # Should be empty or removed
├── src/
├── netlify.toml             # Netlify configuration
├── next.config.ts           # Next.js configuration
└── package.json
```

## Final Checklist

- [ ] `netlify.toml` updated with correct settings
- [ ] `package.json` has `@netlify/plugin-nextjs@^5.15.0`
- [ ] All environment variables set in Netlify dashboard
- [ ] Git repository connected to Netlify
- [ ] Base directory set to `apps/web`
- [ ] Build command includes `npx prisma generate`
- [ ] Publish directory is `apps/web/.next`
- [ ] Plugin enabled in Netlify dashboard
- [ ] Code pushed to GitHub
- [ ] Build triggered and succeeded
- [ ] Site accessible without 404 errors

## Support

If issues persist after following all steps:
1. Check Netlify Support Forums: https://answers.netlify.com/
2. Check Next.js + Netlify docs: https://docs.netlify.com/frameworks/next-js/
3. File an issue: https://github.com/netlify/next-runtime/issues
