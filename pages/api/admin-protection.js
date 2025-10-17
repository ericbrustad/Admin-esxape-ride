import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { commitJsonWithMerge } from '../../lib/secureStore.js';

const ADMIN_PROTECTION_PATH = path.join(process.cwd(), 'public', 'admin-protection.json');
const GAME_PROTECTION_PATHS = [
  path.join(process.cwd(), 'public', 'game', 'public', 'admin-protection.json'),
  path.join(process.cwd(), 'game', 'public', 'admin-protection.json'),
];

const hasGitHub = Boolean(
  process.env.GITHUB_TOKEN &&
  process.env.REPO_OWNER &&
  process.env.REPO_NAME
);

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

function isReadonlyError(err) {
  if (!err || typeof err !== 'object') return false;
  return ['EROFS', 'EACCES', 'EPERM'].includes(err.code);
}

async function writeViaGitHub(relPath, state) {
  if (!hasGitHub || !relPath) {
    const missing = !hasGitHub ? 'GitHub credentials missing' : 'relative path unavailable';
    const error = new Error(`Read-only filesystem and ${missing}`);
    error.code = 'READONLY_NO_GH';
    throw error;
  }

  const message = state?.protected
    ? 'admin-protection: enable password'
    : 'admin-protection: disable password';

  await commitJsonWithMerge(relPath, state, message);
  return { method: 'github' };
}

function normalizeProtectedFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  }
  if (value == null) return fallback;
  return Boolean(value);
}

async function readProtection(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return {
      protected: normalizeProtectedFlag(data.protected),
      updatedAt: data.updatedAt || null,
      passwordHash: typeof data.passwordHash === 'string' ? data.passwordHash : '',
    };
  } catch (err) {
    return { protected: false, updatedAt: null, passwordHash: '' };
  }
}

async function readFirstAvailable(paths) {
  for (const filePath of paths) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(raw);
      return {
        protected: normalizeProtectedFlag(data.protected),
        updatedAt: data.updatedAt || null,
        passwordHash: typeof data.passwordHash === 'string' ? data.passwordHash : '',
      };
    } catch (err) {
      // Continue trying other candidates when the file is missing or invalid.
    }
  }

  return { protected: false, updatedAt: null, passwordHash: '' };
}

async function readGameProtection() {
  return readFirstAvailable(GAME_PROTECTION_PATHS);
}

async function writeProtection(filePath, state) {
  const relPath = path.relative(process.cwd(), filePath).split(path.sep).join('/');

  try {
    await ensureDir(filePath);
  } catch (err) {
    if (isReadonlyError(err)) {
      return writeViaGitHub(relPath, state);
    }
    throw err;
  }

  try {
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
    return { method: 'fs' };
  } catch (err) {
    if (isReadonlyError(err)) {
      return writeViaGitHub(relPath, state);
    }
    throw err;
  }
}

async function syncGameProtection(targetState, nowIso) {
  const current = await readGameProtection();

  if (typeof targetState === 'undefined') {
    return current;
  }

  const requestedProtected = typeof targetState === 'object' && targetState !== null
    ? targetState.protected
    : targetState;
  const requestedHash = typeof targetState === 'object' && targetState !== null
    ? targetState.passwordHash
    : undefined;

  const nextState = {
    protected: normalizeProtectedFlag(requestedProtected),
    updatedAt: nowIso || new Date().toISOString(),
    passwordHash: typeof requestedHash === 'string'
      ? requestedHash
      : current.passwordHash || '',
  };

  if (
    current.protected === nextState.protected &&
    current.updatedAt === nextState.updatedAt &&
    current.passwordHash === nextState.passwordHash
  ) {
    return current;
  }

  await Promise.all(
    GAME_PROTECTION_PATHS.map(async (filePath) => {
      try {
        await writeProtection(filePath, nextState);
      } catch (err) {
        // Ignore missing optional paths so the primary copy is still updated.
      }
    }),
  );

  return nextState;
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function passwordsMatch(hash, password) {
  if (!hash) return false;
  const compare = hashPassword(password);
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(compare, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const adminState = await readProtection(ADMIN_PROTECTION_PATH);
    const gameState = await syncGameProtection();
    return res.status(200).json({
      protected: adminState.protected,
      updatedAt: adminState.updatedAt,
      gameProtected: !!gameState.protected,
      gameUpdatedAt: gameState.updatedAt,
      passwordSet: !!adminState.passwordHash,
    });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (err) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
      const target = normalizeProtectedFlag(body.protected, false);
      const password = typeof body.password === 'string' ? body.password : '';
      const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

      const current = await readProtection(ADMIN_PROTECTION_PATH);
      const nowIso = new Date().toISOString();

      if (!password.trim()) {
        return res.status(400).json({ error: 'Password required' });
      }

      if (target) {
        if (current.passwordHash) {
          if (!passwordsMatch(current.passwordHash, password)) {
            return res.status(401).json({ error: 'Incorrect password' });
          }
        } else {
          if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
          }
          if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
          }
        }
      } else {
        if (!current.passwordHash) {
          return res.status(400).json({ error: 'Protection has no password set yet' });
        }
        if (!passwordsMatch(current.passwordHash, password)) {
          return res.status(401).json({ error: 'Incorrect password' });
        }
      }

      const passwordHash = current.passwordHash || hashPassword(password);
      const adminState = { protected: target, updatedAt: nowIso, passwordHash };
      await writeProtection(ADMIN_PROTECTION_PATH, adminState);
      const gameState = await syncGameProtection(adminState, nowIso);
      return res.status(200).json({
        protected: adminState.protected,
        updatedAt: adminState.updatedAt,
        gameProtected: gameState.protected,
        passwordSet: true,
      });
    } catch (err) {
      if (err?.code === 'READONLY_NO_GH') {
        return res.status(500).json({ error: 'Read-only filesystem detected. Configure GitHub credentials to allow saving.' });
      }
      if (isReadonlyError(err)) {
        return res.status(500).json({ error: 'Read-only filesystem prevented saving admin-protection.json' });
      }
      return res.status(500).json({ error: err?.message || 'Unable to update protection' });
    }
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
