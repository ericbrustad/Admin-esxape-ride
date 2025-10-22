import {
  chmodSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const VERSION = '9.12.0';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const stubRoot = join(projectRoot, 'tools', 'pnpm-offline-stub');
const stubPackageDir = join(stubRoot, 'package');

function ensureTarball() {
  const expectedName = `pnpm-${VERSION}.tgz`;
  const destination = join(stubRoot, expectedName);

  if (existsSync(destination)) {
    try {
      rmSync(destination);
    } catch {}
  }

  const packResult = spawnSync('npm', ['pack', '--pack-destination', stubRoot], {
    cwd: stubPackageDir,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (packResult.status !== 0) {
    const stdout = (packResult.stdout || '').trim();
    const stderr = (packResult.stderr || '').trim();
    throw new Error(
      `npm pack failed${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`,
    );
  }

  const output = (packResult.stdout || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .pop();
  const tarballName = output || expectedName;
  return join(stubRoot, tarballName);
}

function ensureOfflineBundle() {
  const corepackHome = process.env.COREPACK_HOME || join(os.homedir(), '.local', 'share', 'corepack');
  const targetDir = join(corepackHome, 'cache', 'v1', 'pnpm', VERSION);
  const targetFile = join(targetDir, 'package.tgz');

  mkdirSync(targetDir, { recursive: true });

  const tarballPath = ensureTarball();
  copyFileSync(tarballPath, targetFile);

  try {
    rmSync(tarballPath);
  } catch {}

  const shimDir = join(corepackHome, 'shims');
  mkdirSync(shimDir, { recursive: true });
  const shimFile = join(shimDir, 'pnpm.cjs');
  copyFileSync(join(projectRoot, 'tools', 'pnpm-offline-stub', 'package', 'bin', 'pnpm.cjs'), shimFile);
  chmodSync(shimFile, 0o755);

  const nvmRoot = join(os.homedir(), '.nvm', 'versions', 'node');
  try {
    const nodeVersions = existsSync(nvmRoot) ? readdirSync(nvmRoot) : [];
    nodeVersions.forEach((versionDir) => {
      const pnpmBin = join(nvmRoot, versionDir, 'bin', 'pnpm');
      if (!existsSync(pnpmBin)) return;

      const backupPath = `${pnpmBin}.corepack`;
      if (!existsSync(backupPath)) {
        const original = readFileSync(pnpmBin);
        writeFileSync(backupPath, original);
      }

      const shimLauncher = `#!/usr/bin/env node\nrequire('${shimFile.replace(/\\/g, '\\\\')}');\n`;
      writeFileSync(pnpmBin, shimLauncher);
      chmodSync(pnpmBin, 0o755);
    });
  } catch (err) {
    console.warn('Warning: unable to update pnpm shim binaries:', err?.message || err);
  }

  const manifestDir = join(corepackHome, 'last-used');
  mkdirSync(manifestDir, { recursive: true });
  const manifestFile = join(manifestDir, 'pnpm.json');
  const manifestData = {
    version: VERSION,
    modified: new Date().toISOString(),
    source: 'offline-stub',
  };
  writeFileSync(manifestFile, JSON.stringify(manifestData, null, 2));

  return { corepackHome, targetFile };
}

try {
  const result = ensureOfflineBundle();
  console.log(`Offline pnpm ${VERSION} shim installed to ${result.targetFile}`);
  process.exit(0);
} catch (err) {
  console.error('Failed to install offline pnpm shim:', err?.message || err);
  process.exit(1);
}
