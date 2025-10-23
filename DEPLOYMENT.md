# Deployment Guide

This guide covers how to deploy this PR branch (or any branch) to Vercel for the Admin Esxape Ride project.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Environment Variables](#environment-variables)
5. [Deploy to Vercel](#deploy-to-vercel)
6. [Local Development](#local-development)
7. [Troubleshooting](#troubleshooting)

## Quick Start

**To deploy this PR branch:**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Deployments** tab
4. Click **"Deploy"** and select the branch `copilot/deploy-pr-branch`
5. Click **"Deploy"** to start the deployment

## Project Structure

This is a monorepo with two main applications:

```
Admin-esxape-ride/
├── apps/
│   ├── admin/          # Admin Control Panel (Main deployment)
│   └── game-web/       # Game Web Application
├── packages/           # Shared packages
├── package.json        # Root configuration
├── pnpm-workspace.yaml # pnpm workspace config
├── turbo.json          # Turborepo configuration
└── vercel.json         # Vercel deployment config
```

## Prerequisites

### Required Tools

- **Node.js**: v20.18 or higher (specified in `.node-version` and `.nvmrc`)
- **pnpm**: v9.11.0 (specified in `package.json`)
- **Vercel Account**: For deployment

### Install Tools

```bash
# Install Node.js 20.18.1 (using nvm)
nvm install 20.18.1
nvm use 20.18.1

# Install pnpm
npm install -g pnpm@9.11.0

# Or use corepack (recommended)
corepack enable
corepack prepare pnpm@9.11.0 --activate
```

## Environment Variables

### Required Variables

Create a `.env.local` file in the root directory (use `.env.local.example` as template):

```bash
# Supabase Configuration
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_MEDIA_BUCKET=media
SUPABASE_IMPORTS_BUCKET=imports
```

### Vercel Environment Variables

Set these in your Vercel project settings:

1. Go to **Project Settings** → **Environment Variables**
2. Add all variables from `.env.local.example`
3. Make sure to add them for:
   - Production
   - Preview (for PR deployments)
   - Development (optional)

## Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Navigate to Vercel Dashboard**:
   - Go to https://vercel.com/dashboard
   - Select your project (`admin-esxape-ride`)

2. **Deploy a specific branch**:
   - Click on the **"Deployments"** tab
   - Click **"Deploy"** button (top right)
   - Select branch: `copilot/deploy-pr-branch`
   - Click **"Deploy"** to start

3. **Monitor the deployment**:
   - Watch the build logs in real-time
   - Deployment typically takes 2-5 minutes
   - You'll get a preview URL once complete

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy the current branch
vercel --prod  # For production
vercel         # For preview deployment
```

### Option 3: Automatic Deployment (GitHub Integration)

If you have Vercel GitHub integration enabled:

1. Push your changes to the branch
2. Vercel automatically creates a preview deployment
3. Check the PR for deployment links

### Deploy Specific Apps

The project uses Turborepo to build multiple apps. By default, Vercel builds all apps.

**Admin app only:**
```bash
vercel --build-env TURBO_SCOPE=admin
```

**Game web app only:**
```bash
vercel --build-env TURBO_SCOPE=game-web
```

## Local Development

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/ericbrustad/Admin-esxape-ride.git
cd Admin-esxape-ride

# Checkout your branch
git checkout copilot/deploy-pr-branch

# Install dependencies
pnpm install

# Copy environment variables
cp .env.local.example .env.local
# Edit .env.local with your actual values
```

### Run Development Servers

```bash
# Run all apps in development mode
pnpm dev

# Or run specific apps:
pnpm --filter admin dev        # Admin only
pnpm --filter game-web dev     # Game only
```

**Access the apps:**
- Admin: http://localhost:3000
- Game: http://localhost:3000 (if running game-web separately)

### Build for Production

```bash
# Build all apps
pnpm build

# Or build specific apps:
pnpm --filter admin build
pnpm --filter game-web build
```

## Troubleshooting

### Build Failures

**Issue: pnpm not found**
```bash
# Solution: Install pnpm
npm install -g pnpm@9.11.0
# Or use corepack
corepack enable
corepack prepare pnpm@9.11.0 --activate
```

**Issue: Node version mismatch**
```bash
# Solution: Use correct Node version
nvm install 20.18.1
nvm use 20.18.1
```

**Issue: Build fails with "MODULE_NOT_FOUND"**
```bash
# Solution: Clean install
rm -rf node_modules apps/*/node_modules packages/*/node_modules
rm -rf .next apps/*/.next
pnpm install
pnpm build
```

### Deployment Issues

**Issue: Environment variables not set**
- Go to Vercel Project Settings → Environment Variables
- Add all required variables from `.env.local.example`
- Redeploy the project

**Issue: Deployment stuck or taking too long**
- Check Vercel status page: https://www.vercel-status.com/
- Cancel and retry the deployment
- Check build logs for specific errors

**Issue: Preview deployment not created for PR**
- Ensure Vercel GitHub integration is enabled
- Check that the branch is not ignored in Vercel settings
- Verify the repository has proper permissions

### Local Development Issues

**Issue: Port already in use**
```bash
# Solution: Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port
PORT=3001 pnpm dev
```

**Issue: Changes not reflecting**
```bash
# Solution: Clear Next.js cache
rm -rf .next apps/*/.next
pnpm dev
```

## Additional Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **Turborepo Documentation**: https://turbo.build/repo/docs
- **pnpm Documentation**: https://pnpm.io/

## Support

For project-specific questions:
- Check the [README.txt](./README.txt) for project notes
- Review [PROJECT_MEMORY.md](./apps/admin/docs/PROJECT_MEMORY.md) for architecture details
- Contact the repository maintainers

---

**Last Updated**: 2025-10-23
