#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const usage = `Usage: node tools/offline-pnpm.mjs --filter <workspace> <command> [args...]`;

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(usage);
  process.exit(1);
}

let filter = '';
let command = '';
let commandArgs = [];

if (args[0] === '--filter') {
  if (args.length < 3) {
    console.error('Error: --filter requires a workspace name and a command.');
    console.error(usage);
    process.exit(1);
  }
  filter = args[1];
  command = args[2];
  commandArgs = args.slice(3);
} else {
  command = args[0];
  commandArgs = args.slice(1);
}

const WORKSPACES = new Map([
  ['game-web', {
    cwd: path.join(repoRoot, 'apps', 'game-web'),
    commands: {
      build: ['next', 'build'],
      dev: ['next', 'dev'],
      start: ['next', 'start'],
    },
  }],
  ['admin', {
    cwd: path.join(repoRoot, 'apps', 'admin'),
    commands: {
      build: ['next', 'build'],
      dev: ['next', 'dev'],
      start: ['next', 'start'],
    },
  }],
]);

function resolveBin(binName, workspaceCwd) {
  // Try workspace's node_modules first, then root
  const candidates = [
    path.join(workspaceCwd, 'node_modules', '.bin'),
    path.join(repoRoot, 'node_modules', '.bin'),
  ];
  
  const exe = process.platform === 'win32' ? `${binName}.cmd` : binName;
  
  for (const binDir of candidates) {
    const fullPath = path.join(binDir, exe);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  throw new Error(`Cannot find executable "${binName}" in workspace or root node_modules/.bin. Install dependencies locally to continue.`);
}

function runCommand(binName, argv, workspaceCwd, options = {}) {
  const executable = resolveBin(binName, workspaceCwd);
  const child = spawn(executable, argv, { stdio: 'inherit', cwd: workspaceCwd, ...options });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
}

if (!command) {
  console.error('Error: Missing command.');
  console.error(usage);
  process.exit(1);
}

if (!filter) {
  console.error('Error: Offline pnpm shim currently requires --filter to select a workspace.');
  console.error(usage);
  process.exit(1);
}

const workspace = WORKSPACES.get(filter);
if (!workspace) {
  console.error(`Error: Unknown workspace "${filter}". Known workspaces: ${Array.from(WORKSPACES.keys()).join(', ')}`);
  process.exit(1);
}

const mapped = workspace.commands[command];
if (!mapped) {
  console.error(`Error: Workspace "${filter}" does not support command "${command}" via the offline pnpm shim.`);
  console.error(`Supported commands: ${Object.keys(workspace.commands).join(', ')}`);
  process.exit(1);
}
try {
  runCommand(mapped[0], mapped.slice(1).concat(commandArgs), workspace.cwd);
} catch (err) {
  console.error(`Offline pnpm shim error: ${err?.message || err}`);
  process.exit(1);
}
