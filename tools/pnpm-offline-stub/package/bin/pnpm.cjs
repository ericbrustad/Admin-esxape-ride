#!/usr/bin/env node
/**
 * Offline pnpm shim that proxies core commands to npm while advertising pnpm 9.12.0.
 * This prevents Corepack from reaching the public registry when --version or other
 * simple commands are executed inside a sandbox that blocks outbound traffic.
 */
const { spawnSync } = require('child_process');

const VERSION = '9.12.0';
const args = process.argv.slice(2);

const wantsVersion = args.length === 0 || args.includes('--version') || args.includes('-v');
if (wantsVersion) {
  console.log(VERSION);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`pnpm v${VERSION} (offline shim)\n` +
    'Supported commands: install, add, update, remove, exec, run.\n' +
    'All other arguments are passed to npm directly.');
  process.exit(0);
}

const command = args[0];
const rest = args.slice(1);
let fallback = 'npm';
let mappedArgs = [];

switch (command) {
  case 'install':
  case 'i':
  case 'ci':
    mappedArgs = ['install', ...rest];
    break;
  case 'add':
    mappedArgs = ['install', ...rest];
    break;
  case 'remove':
  case 'rm':
  case 'uninstall':
    mappedArgs = ['uninstall', ...rest];
    break;
  case 'update':
  case 'up':
    mappedArgs = ['update', ...rest];
    break;
  case 'exec':
    mappedArgs = ['exec', ...rest];
    break;
  case 'run':
  case 'run-script':
    mappedArgs = ['run', ...rest];
    break;
  default:
    mappedArgs = args;
    break;
}

const result = spawnSync(fallback, mappedArgs, {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(`[pnpm offline shim] Failed to delegate to ${fallback}:`, result.error.message);
  process.exit(result.status ?? 1);
}

process.exit(result.status ?? 0);
