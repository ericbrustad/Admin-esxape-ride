import { spawnSync } from 'node:child_process';

const REQUIRED_NODE_MAJOR = 20;
const REQUIRED_NODE_MINOR = 18;
const REQUIRED_PNPM_MAJOR = 9;
const REQUIRED_PNPM_MINOR = 12;
const REQUIRED_PNPM_PATCH = 0;

const override = [
  process.env.ALLOW_UNSUPPORTED_TOOLCHAIN,
  process.env.FORCE_INSTALL_WITH_UNSUPPORTED_TOOLCHAIN,
]
  .map((value) => String(value || '').toLowerCase())
  .some((value) => value === '1' || value === 'true');

if (override) {
  process.exit(0);
}

function parseVersion(raw) {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    toString() {
      return `${this.major}.${this.minor}.${this.patch}`;
    },
  };
}

function detectPnpmVersion() {
  const ua = process.env.npm_config_user_agent || '';
  const uaMatch = ua.match(/pnpm\/(\d+\.\d+\.\d+)/);
  if (uaMatch) {
    const version = parseVersion(uaMatch[1]);
    if (version) return version;
  }

  const execPath = process.env.npm_execpath || '';
  if (execPath.includes('pnpm')) {
    const execMatch = execPath.match(/pnpm-(\d+\.\d+\.\d+)/);
    if (execMatch) {
      const version = parseVersion(execMatch[1]);
      if (version) return version;
    }
  }

  const pnpmResult = spawnSync('pnpm', ['--version'], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (pnpmResult.status === 0) {
    const version = parseVersion(pnpmResult.stdout);
    if (version) return version;
  }

  return null;
}

const nodeVersion = parseVersion(process.versions.node);
const pnpmVersion = detectPnpmVersion();

const nodeOk =
  nodeVersion &&
  nodeVersion.major === REQUIRED_NODE_MAJOR &&
  nodeVersion.minor === REQUIRED_NODE_MINOR;

const pnpmOk =
  pnpmVersion &&
  pnpmVersion.major === REQUIRED_PNPM_MAJOR &&
  pnpmVersion.minor === REQUIRED_PNPM_MINOR &&
  (pnpmVersion.patch ?? REQUIRED_PNPM_PATCH) >= REQUIRED_PNPM_PATCH;

if (nodeOk && pnpmOk) {
  process.exit(0);
}

const problems = [];
if (!nodeOk) {
  problems.push(
    `- Node.js ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR}.x required (found ${nodeVersion ? nodeVersion.toString() : 'unknown'})`,
  );
}
if (!pnpmOk) {
  problems.push(
    `- pnpm ${REQUIRED_PNPM_MAJOR}.${REQUIRED_PNPM_MINOR}.${REQUIRED_PNPM_PATCH} required (found ${pnpmVersion ? pnpmVersion.toString() : 'unknown'})`,
  );
}

const guidance = [
  'corepack enable',
  `corepack prepare pnpm@${REQUIRED_PNPM_MAJOR}.${REQUIRED_PNPM_MINOR}.${REQUIRED_PNPM_PATCH} --activate`,
  'node scripts/install-offline-pnpm.mjs',
  'pnpm --version',
];

console.error('\nToolchain mismatch detected. Please align with the workspace requirements before installing dependencies.');
console.error(problems.join('\n'));
console.error('\nRecommended fix:');
console.error(guidance.map((line) => `  ${line}`).join('\n'));
console.error('\nIf you intentionally need to bypass this check, set ALLOW_UNSUPPORTED_TOOLCHAIN=1 (not recommended).');
process.exit(1);
