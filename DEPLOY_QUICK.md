# Quick Deploy Cheat Sheet

## Deploy PR Branch to Vercel (Web UI)

```
1. Open: https://vercel.com/dashboard
2. Select: Your project (admin-esxape-ride)
3. Click: "Deployments" tab
4. Click: "Deploy" button
5. Select: Branch "copilot/deploy-pr-branch"
6. Click: "Deploy"
7. Wait: 2-5 minutes
8. Done: Get preview URL
```

## Deploy via Vercel CLI

```bash
# Install Vercel CLI (one time)
npm i -g vercel

# Login (one time)
vercel login

# Deploy preview
vercel

# Deploy to production
vercel --prod
```

## Deploy via Git Push (Auto)

```bash
# If Vercel GitHub integration is enabled:
git push origin copilot/deploy-pr-branch

# Vercel automatically deploys the branch
# Check PR for deployment link
```

## Local Development

```bash
# First time setup
pnpm install
cp .env.local.example .env.local

# Run dev servers
pnpm dev

# Build for production
pnpm build
```

## Troubleshooting

### Build fails - pnpm not found
```bash
npm install -g pnpm@9.11.0
```

### Build fails - wrong Node version
```bash
nvm install 20.18.1
nvm use 20.18.1
```

### Environment variables missing
```
1. Go to Vercel Project Settings
2. Click "Environment Variables"
3. Add all vars from .env.local.example
4. Redeploy
```

### Port 3000 already in use
```bash
lsof -ti:3000 | xargs kill -9
```

## Quick Links

- 📖 Full Guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- 🏠 Main README: [README.md](./README.md)
- 🔧 Project Memory: [apps/admin/docs/PROJECT_MEMORY.md](./apps/admin/docs/PROJECT_MEMORY.md)
