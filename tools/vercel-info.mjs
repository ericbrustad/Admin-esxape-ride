#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';

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

function ensureNode20(version) {
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version;
  const [major, minor, patch] = cleanVersion.split('.').map(Number);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    logError(`Unable to parse Node.js version "${version}"`);
    process.exitCode = 1;
    return;
  }

  log(`node: v${cleanVersion}`);
  if (major !== 20) {
    logError('Expected Node.js 20.x runtime.');
    process.exitCode = 1;
    return;
  }

  if (minor < 18) {
    logError('Node.js 20 detected, but version must be at least 20.18.0.');
    process.exitCode = 1;
  }

  if (!Number.isNaN(patch) && minor === 18 && patch < 0) {
    // This branch is effectively unreachable because patch cannot be < 0,
    // but we keep it defensively in case parsing changes.
    process.exitCode = 1;
  }
}

function main() {
  const nodeVersion = process.version;
  ensureNode20(nodeVersion);
  runCommand('corepack', 'corepack --version');
  runCommand('pnpm', 'pnpm -v');
}

main();
