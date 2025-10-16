#!/usr/bin/env node
const { spawn } = require('node:child_process');

if (!process.env.NEXT_IGNORE_INCORRECT_LOCKFILE) {
  process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = '1';
}

const args = process.argv.slice(2);

const child = spawn('node', [require.resolve('next/dist/bin/next'), ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
