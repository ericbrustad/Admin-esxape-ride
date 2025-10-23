#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

function log(message = '') {
  process.stdout.write(`${message}\n`);
}

function logError(message = '') {
  process.stderr.write(`${message}\n`);
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
    const message = (error && error.message) ? error.message : 'unknown error';
    logError(`${label}: unavailable (${message})`);
    return { ok: false, error };
  }
}

function parseVersion(input = '') {
  if (!input) return { major: NaN, minor: NaN, patch: NaN };
  const clean = input.startsWith('v') ? input.slice(1) : input;
  const [major, minor, patch] = clean.split('.').map((value) => Number.parseInt(value, 10));
  return { clean, major, minor, patch: Number.isNaN(patch) ? 0 : patch };
}

function compareVersions(a, b) {
  if (Number.isNaN(a.major) || Number.isNaN(b.major)) return NaN;
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}

function ensureNode20(version) {
  const runtime = parseVersion(version);
  const pinnedNodeRaw = packageJson?.volta?.node || '';
  const pinned = parseVersion(pinnedNodeRaw);

  if (Number.isNaN(runtime.major)) {
    logError(`Unable to parse Node.js version "${version}"`);
    process.exitCode = 1;
    return;
  }

  log(`node: v${runtime.clean}`);

  if (runtime.major !== 20) {
    logError('Expected Node.js 20.x runtime.');
    process.exitCode = 1;
    return;
  }

  if (!Number.isNaN(pinned.major)) {
    if (pinned.major !== 20) {
      logError(`package.json pins Node ${pinnedNodeRaw}, expected a 20.x entry.`);
      process.exitCode = 1;
      return;
    }

    const comparison = compareVersions(runtime, pinned);
    if (Number.isNaN(comparison)) {
      logError(`Unable to compare runtime Node version against pinned ${pinnedNodeRaw}.`);
      process.exitCode = 1;
    } else if (comparison < 0) {
      logError(`Node runtime ${runtime.clean} is older than pinned ${pinnedNodeRaw}.`);
      process.exitCode = 1;
    }
  } else if (runtime.minor < 18) {
    logError('Node.js 20 detected, but version must be at least 20.18.0.');
    process.exitCode = 1;
  }
}

function main() {
  const nodeVersion = process.version;
  ensureNode20(nodeVersion);
  const environment = process.env.VERCEL ? 'Vercel sandbox' : (process.env.NODE_ENV || 'local runtime');
  const pinnedNodeRaw = packageJson?.volta?.node || '20.x';
  const pinnedPnpmRaw = packageJson?.volta?.pnpm || (typeof packageJson?.packageManager === 'string'
    ? packageJson.packageManager.split('@')[1] || ''
    : '');
  log(`environment: ${environment}`);
  log(`expected sandbox toolchain: Node.js ${pinnedNodeRaw} + pnpm ${pinnedPnpmRaw || '9.11.0'} (Volta pinned)`);
  runCommand('corepack', 'corepack --version');
  const pnpmResult = runCommand('pnpm', 'pnpm -v');
  if (pnpmResult.ok && pinnedPnpmRaw && pnpmResult.output !== pinnedPnpmRaw) {
    logError(`pnpm version mismatch — expected ${pinnedPnpmRaw}, received ${pnpmResult.output}`);
    process.exitCode = 1;
  }
}

main();
