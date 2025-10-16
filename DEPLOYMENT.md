# Deployment Information

## Online Version Branch

**The online/production version is deployed from the `main` branch.**

## How to Check Current Deployment

When you visit the admin dashboard, you'll see a banner at the top of the page that displays:
- **Branch:** The current branch deployed (should show `main` for production)
- **Commit:** The short commit hash (first 7 characters)
- **Repository:** The GitHub repository (ericbrustad/Admin-esxape-ride)
- **Deployment:** The deployment state and URL
- **Checked:** The last time this information was refreshed

This banner automatically updates every 60 seconds.

## Deployment Configuration

### Admin Application
- **Vercel Project:** admin-esxape-ride
- **Production Branch:** main
- **URL:** (configured via VERCEL_URL environment variable)

### Game Application
- **Vercel Project:** game-esxape-ride
- **Production Branch:** main
- **URL:** https://game.esxaperide.com

## Environment Variables

The deployment branch is detected via these environment variables (in order of priority):
1. `REPO_BRANCH`
2. `GITHUB_BRANCH`
3. `VERCEL_GIT_COMMIT_REF`
4. `COMMIT_REF`
5. Default: `main`

For production deployments, ensure `GITHUB_BRANCH=main` is set in the Vercel environment variables.

## Related Files
- `pages/api/admin-meta.js` - API endpoint that provides deployment metadata
- `pages/index.jsx` - Admin dashboard that displays the deployment banner
- `docs/PROJECT_MEMORY.md` - Architecture and configuration details
