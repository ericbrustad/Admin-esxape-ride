import { promises as fs } from 'fs';
import path from 'path';

const ADMIN_PROTECTION_PATH = path.join(process.cwd(), 'public', 'admin-protection.json');
const GAME_PROTECTION_PATH = path.join(process.cwd(), 'game', 'public', 'admin-protection.json');

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function readProtection(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return {
      protected: !!data.protected,
      updatedAt: data.updatedAt || null,
    };
  } catch (err) {
    return { protected: false, updatedAt: null };
  }
}

async function writeProtection(filePath, state) {
  await ensureDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
}

async function syncGameProtection(nowIso) {
  const current = await readProtection(GAME_PROTECTION_PATH);
  if (!current.protected && current.updatedAt && !nowIso) {
    return current;
  }
  const nextState = { protected: false, updatedAt: nowIso || new Date().toISOString() };
  await writeProtection(GAME_PROTECTION_PATH, nextState);
  return nextState;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const adminState = await readProtection(ADMIN_PROTECTION_PATH);
    const gameState = await syncGameProtection(null);
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
      const target = !!body.protected;
      const nowIso = new Date().toISOString();
      const adminState = { protected: target, updatedAt: nowIso };
      await writeProtection(ADMIN_PROTECTION_PATH, adminState);
      const gameState = await syncGameProtection(nowIso);
      return res.status(200).json({ ...adminState, gameProtected: gameState.protected });
    } catch (err) {
      return res.status(400).json({ error: err?.message || 'Invalid request body' });
    }
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
