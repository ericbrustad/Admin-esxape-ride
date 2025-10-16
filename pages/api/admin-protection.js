import { promises as fs } from 'fs';
import path from 'path';

const ADMIN_PROTECTION_PATH = path.join(process.cwd(), 'public', 'admin-protection.json');
const GAME_PROTECTION_PATHS = [
  path.join(process.cwd(), 'public', 'game', 'public', 'admin-protection.json'),
  path.join(process.cwd(), 'game', 'public', 'admin-protection.json'),
];

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
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
    };
  } catch (err) {
    return { protected: false, updatedAt: null };
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
      };
    } catch (err) {
      // Continue trying other candidates when the file is missing or invalid.
    }
  }

  return { protected: false, updatedAt: null };
}

async function readGameProtection() {
  return readFirstAvailable(GAME_PROTECTION_PATHS);
}

async function writeProtection(filePath, state) {
  await ensureDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
}

async function syncGameProtection(targetState, nowIso) {
  const current = await readGameProtection();

  if (typeof targetState === 'undefined') {
    return current;
  }

  const nextState = {
    protected: normalizeProtectedFlag(targetState),
    updatedAt: nowIso || new Date().toISOString(),
  };

  if (
    current.protected === nextState.protected &&
    current.updatedAt === nextState.updatedAt
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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const adminState = await readProtection(ADMIN_PROTECTION_PATH);
    const gameState = await syncGameProtection();
    return res.status(200).json({
      protected: adminState.protected,
      updatedAt: adminState.updatedAt,
      gameProtected: !!gameState.protected,
      gameUpdatedAt: gameState.updatedAt,
    });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const target = normalizeProtectedFlag(body.protected, false);
      const nowIso = new Date().toISOString();
      const adminState = { protected: target, updatedAt: nowIso };
      await writeProtection(ADMIN_PROTECTION_PATH, adminState);
      const gameState = await syncGameProtection(target, nowIso);
      return res.status(200).json({ ...adminState, gameProtected: gameState.protected });
    } catch (err) {
      return res.status(400).json({ error: err?.message || 'Invalid request body' });
    }
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
