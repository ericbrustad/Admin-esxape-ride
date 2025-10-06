// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      // Serve latest content from GitHub instead of static /public on Vercel
      beforeFiles: [
        { source: '/missions.json', destination: '/api/file?path=public/missions.json' },
        { source: '/config.json', destination: '/api/file?path=public/config.json' },
        { source: '/games/:slug/missions.json', destination: '/api/file?path=public/games/:slug/missions.json' },
        { source: '/games/:slug/config.json', destination: '/api/file?path=public/games/:slug/config.json' },
        { source: '/media/:path*', destination: '/api/file?path=public/media/:path*' },
      ],
    };
  },
};

module.exports = nextConfig;
