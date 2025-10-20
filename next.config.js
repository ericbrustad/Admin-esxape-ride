const path = require('path');

/** @type {import('next').NextConfig} */
const rawGameEnabled = process.env.GAME_ENABLED ?? process.env.NEXT_PUBLIC_GAME_ENABLED ?? '0';

const repoRoot = __dirname;

const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  env: {
    GAME_ENABLED: rawGameEnabled,
    NEXT_PUBLIC_GAME_ENABLED: rawGameEnabled,
  },
  experimental: {
    extensionAlias: {
      '.js': ['.js', '.jsx'],
      '.jsx': ['.jsx', '.js'],
    },
  },
  turbopack: {
    root: repoRoot,
    resolveExtensions: ['.js', '.jsx', '.mjs', '.cjs', '.json', '.css'],
    resolveAlias: {
      '~': repoRoot,
      '~components': path.join(repoRoot, 'components'),
      '~styles': path.join(repoRoot, 'styles'),
    },
  },
};

module.exports = nextConfig;
