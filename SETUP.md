# Setup Guide - Admin-esxape-ride

## Prerequisites

- **Node.js**: v20.x (currently using v20.19.5)
- **pnpm**: v9.11.0

## Quick Start

### 1. Install Node.js 20.x

The project requires Node.js version 20 or higher. You can use nvm to install the correct version:

```bash
# If using nvm
nvm install 20
nvm use 20

# Verify Node version
node --version  # Should show v20.x.x
```

### 2. Install pnpm

Install pnpm globally:

```bash
npm install -g pnpm@9.11.0

# Verify pnpm version
pnpm --version  # Should show 9.11.0
```

### 3. Install Dependencies

From the project root:

```bash
pnpm install
```

This will install dependencies for all workspaces:
- Root workspace
- `apps/admin` (Admin panel - esx-admin-control-panel-map)
- `apps/game-web` (Game web - game-esxape-ride)
- `packages/shared`

### 4. Development

To run the development server:

```bash
# Run all apps in parallel
pnpm dev

# Run admin app only
pnpm --filter esx-admin-control-panel-map dev

# Run game-web app only
pnpm --filter game-web dev
```

The servers will start on:
- Admin: http://localhost:3000
- Game: http://localhost:3000 (if running separately)

### 5. Building

#### Option 1: Offline pnpm build (Recommended)
Uses a custom shim to avoid Corepack downloads:

```bash
npm run build
```

#### Option 2: Standard pnpm build
Uses pnpm directly (may fail in restricted environments):

```bash
npm run build:standard
# or
pnpm --filter game-web build
pnpm --filter esx-admin-control-panel-map build
```

#### Option 3: Turbo build
Builds all apps using Turborepo:

```bash
npm run build:turbo
```

## Workspace Structure

This is a monorepo using pnpm workspaces:

```
Admin-esxape-ride/
├── apps/
│   ├── admin/          # Admin panel (esx-admin-control-panel-map)
│   └── game-web/       # Game web app (game-esxape-ride)
├── packages/
│   └── shared/         # Shared code between apps
├── tools/
│   └── offline-pnpm.mjs  # Custom build shim
├── pnpm-workspace.yaml  # Workspace configuration
└── package.json         # Root workspace
```

## Version Information

- **Node.js**: >=20.0.0 (specified in all package.json files)
- **pnpm**: 9.11.0 (specified in packageManager field)
- **Next.js**: 15.5.5 (used by both apps)
- **React**: 18.2.0
- **Turbo**: 2.5.8

## Troubleshooting

### "pnpm: command not found"
Install pnpm globally: `npm install -g pnpm@9.11.0`

### Build fails with "Cannot find executable"
Make sure you've run `pnpm install` from the project root first.

### Wrong Node version
Check your Node version with `node --version`. It should be 20.x.x.
Use nvm to switch: `nvm use 20`

### Corepack issues
The project uses an offline pnpm shim to avoid Corepack. Use `npm run build` instead of direct pnpm commands in restricted environments.

## Additional Resources

- [pnpm Documentation](https://pnpm.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
