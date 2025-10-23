# Admin Esxape Ride

Admin Control Panel and Game Web Application for the Esxape Ride project.

## 🚀 Quick Deploy

### Deploy This PR Branch to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **"Deployments"** → **"Deploy"**
4. Select branch: `copilot/deploy-pr-branch`
5. Click **"Deploy"**

📖 **Full deployment guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📦 Project Structure

```
Admin-esxape-ride/
├── apps/
│   ├── admin/          # Admin Control Panel (Next.js)
│   └── game-web/       # Game Web Application (Next.js)
├── packages/           # Shared packages
└── supabase/          # Supabase configuration
```

## 🛠️ Local Development

### Prerequisites

- Node.js 20.18.1+
- pnpm 9.11.0

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.local.example .env.local
# Edit .env.local with your values

# Run development servers
pnpm dev
```

### Build

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter admin build
pnpm --filter game-web build
```

## 📚 Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [README.txt](./README.txt) - Project update log
- [PROJECT_MEMORY.md](./apps/admin/docs/PROJECT_MEMORY.md) - Architecture details
- [README-ENGINE-API.md](./README-ENGINE-API.md) - Engine API documentation

## 🔧 Environment Variables

Required environment variables (see `.env.local.example`):

```bash
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_MEDIA_BUCKET=media
SUPABASE_IMPORTS_BUCKET=imports
```

## 🏗️ Tech Stack

- **Framework**: Next.js 15.5.5
- **Package Manager**: pnpm 9.11.0
- **Monorepo**: Turborepo
- **Deployment**: Vercel
- **Database**: Supabase
- **UI**: React 18.2.0

## 📝 License

Private repository - All rights reserved

---

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)
