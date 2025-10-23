#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function loadPackageManifest() {
  const manifestPath = path.join(repoRoot, 'package.json');
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    process.stderr.write(`Unable to read package.json at ${manifestPath}: ${error?.message || error}\n`);
    return {};
  }
}

const manifest = loadPackageManifest();

function cleanVersion(version = '') {
  if (!version) return '';
  return version.startsWith('v') ? version.slice(1) : version;
}

function parseSemver(version = '') {
  const clean = cleanVersion(version);
  const [major, minor, patch] = clean.split('.').map((part) => Number.parseInt(part, 10));
  return {
    major: Number.isNaN(major) ? NaN : major,
    minor: Number.isNaN(minor) ? NaN : minor,
    patch: Number.isNaN(patch) ? NaN : patch,
    raw: clean,
  };
}

function resolvePinnedNodeVersion(pkg = {}) {
  if (pkg?.volta?.node && typeof pkg.volta.node === 'string') {
    return pkg.volta.node;
  }
  if (pkg?.engines?.node && typeof pkg.engines.node === 'string') {
    const match = pkg.engines.node.match(/(\d+\.\d+\.\d+)/);
    if (match) return match[1];
  }
  return '';
}

const pinnedNodeVersion = resolvePinnedNodeVersion(manifest);
const pinnedPnpmVersion = (() => {
  if (manifest?.volta?.pnpm && typeof manifest.volta.pnpm === 'string') {
    return manifest.volta.pnpm;
  }
  if (typeof manifest?.packageManager === 'string') {
    const [, version] = manifest.packageManager.split('@');
    return version || '';
  }
  return '';
})();

function log(message = '') {
  process.stdout.write(`${message}\n`);
}

function logError(message = '') {
  process.stderr.write(`${message}\n`);
}

function formatCommandError(error) {
  if (!error) return 'unknown error';
  const stderr = error.stderr ? String(error.stderr).trim() : '';
  const stdout = error.stdout ? String(error.stdout).trim() : '';
  const message = error.message ? String(error.message).trim() : '';
  const combined = [stderr, stdout, message]
    .flatMap((segment) => String(segment || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return combined.length === 0 ? 'unknown error' : combined[0];
}

function includesProxy403(error) {
  if (!error) return false;
  const stderr = error.stderr ? String(error.stderr) : '';
  const stdout = error.stdout ? String(error.stdout) : '';
  const message = error.message ? String(error.message) : '';
  return [stderr, stdout, message].some((segment) => segment.includes('Proxy response (403)'));
}

function runCommand(label, command) {
  try {
    const output = execSync(command, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();
    log(`${label}: ${output || '—'}`);
    return { ok: true, output };
  } catch (error) {
    const message = formatCommandError(error);
    logError(`${label}: unavailable (${message})`);
    if (includesProxy403(error)) {
      logError('Hint: The sandbox proxy blocked registry access. Use the offline pnpm shim or rerun once registry access is restored.');
    }
    return { ok: false, error };
  }
}

function ensureNode20(version, expectedVersion) {
  const { major, minor, raw } = parseSemver(version);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    logError(`Unable to parse Node.js version "${version}"`);
    process.exitCode = 1;
    return;
  }

  log(`node runtime: v${raw}`);
  if (expectedVersion) {
    log(`expected via Volta/engines: v${cleanVersion(expectedVersion)}`);
  }
  if (pinnedPnpmVersion) {
    log(`expected pnpm: v${cleanVersion(pinnedPnpmVersion)}`);
  }

  if (major !== 20) {
    logError('Expected Node.js 20.x runtime. Run `nvm use 20.19.4` (or install the Volta pin) before continuing.');
    process.exitCode = 1;
    return;
  }

  const minimumMinor = 18;
  if (minor < minimumMinor) {
    logError('Node.js 20 detected, but version must be at least 20.18.0.');
    process.exitCode = 1;
  }

  if (expectedVersion) {
    const { major: expectedMajor, minor: expectedMinor } = parseSemver(expectedVersion);
    if (!Number.isNaN(expectedMajor) && expectedMajor !== major) {
      logError(`Volta pin expects Node.js ${expectedMajor}.x but runtime is ${major}.x.`);
      process.exitCode = 1;
    }
    if (!Number.isNaN(expectedMinor) && expectedMinor > minor) {
      logError(`Volta pin expects Node.js >= ${expectedMajor}.${expectedMinor}.x but runtime is ${major}.${minor}.x.`);
      process.exitCode = 1;
    }
  }
}

const knownScopes = new Map([
  [
    'admin',
    {
      root: 'apps/admin',
      filters: ['--filter ./apps/admin'],
      build: 'pnpm -r --filter ./apps/admin build',
    },
  ],
  [
    'game-web',
    {
      root: 'apps/game-web',
      filters: ['--filter ./apps/game-web'],
      build: 'pnpm -r --filter ./apps/game-web build',
    },
  ],
]);

function parseCliScopes(argv) {
  const scopes = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--scope') {
      const next = argv[i + 1];
      if (!next) {
        logError('Missing value for --scope option.');
        process.exitCode = 1;
        break;
      }
      if (knownScopes.has(next)) {
        scopes.push(next);
      } else {
        logError(
          `Unknown scope "${next}". Known scopes: ${Array.from(knownScopes.keys()).join(', ')}`,
        );
        process.exitCode = 1;
      }
      i += 1;
    } else if (token === '--all-scopes') {
      knownScopes.forEach((_, key) => scopes.push(key));
    } else if (token === '--help') {
      log('Usage: node tools/vercel-info.mjs [--scope admin] [--scope game-web]');
      log('       node tools/vercel-info.mjs --all-scopes');
      process.exit(0);
    }
  }
  return Array.from(new Set(scopes));
}

function renderScopeGuidance(scopes) {
  if (!scopes.length) return;

  log('');
  log('--- Scoped pnpm install guidance ---');
  scopes.forEach((scope) => {
    const details = knownScopes.get(scope);
    if (!details) return;
    const installFilters = details.filters.join(' ');

    log('');
    log(`[${scope}] Option A – point Vercel Root Directory at ${details.root}`);
    log('  Install Command:');
    log(`    echo "---VERS---" && node -v \\`);
    log('    && corepack disable || true && npm i -g pnpm@4.0.0 && pnpm -v \\');
    log('    && pnpm install --fetch-retries=5 --fetch-timeout=60000 --network-concurrency=1');
    log('  Build Command:');
    log('    pnpm build');

    log('');
    log(`[${scope}] Option B – keep repo root but filter installs to ${scope}`);
    log('  Install Command:');
    log(`    echo "---VERS---" && node -v \\`);
    log('    && corepack disable || true && npm i -g pnpm@4.0.0 && pnpm -v \\');
    log(
      `    && pnpm -r ${installFilters} install --fetch-retries=5 --fetch-timeout=60000 --network-concurrency=1`,
    );
    log('  Build Command:');
    log(`    ${details.build}`);
    if (scope === 'game-web') {
      log('  If shared packages are required:');
      log(
        '    pnpm -r --filter ./apps/game-web --filter ./packages/shared install --fetch-retries=5 --fetch-timeout=60000 --network-concurrency=1',
      );
    }
    if (scope === 'admin') {
      log('  Add shared filters as needed, for example:');
      log(
        '    pnpm -r --filter ./apps/admin --filter ./packages/shared install --fetch-retries=5 --fetch-timeout=60000 --network-concurrency=1',
      );
    }
  });

  log('');
  log('Shared environment variables:');
  log('  NPM_CONFIG_REGISTRY=https://registry.npmjs.org/');
  log('  NODE_OPTIONS=--dns-result-order=ipv4first');
  log('Ensure the Vercel project Node.js Version is pinned to 20.x (LTS).');
  log('First build log lines should report node -v v20.18.x and pnpm -v 4.0.0.');
}

function main() {
  const argv = process.argv.slice(2);
  const scopes = parseCliScopes(argv);
  const nodeVersion = process.version;
  ensureNode20(nodeVersion, pinnedNodeVersion);
  runCommand('corepack', 'corepack --version');
  runCommand('pnpm', 'pnpm -v');
  renderScopeGuidance(scopes);
}

main();
