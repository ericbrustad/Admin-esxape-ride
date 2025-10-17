// pages/api/games.js
// ------------------
// [1] GitHub API config + helpers
import { GAME_ENABLED } from '../../lib/game-switch.js';
const GH = 'https://api.github.com';
const owner  = process.env.REPO_OWNER;
const repo   = process.env.REPO_NAME;
const token  = process.env.GITHUB_TOKEN;
const branch = process.env.REPO_BRANCH || 'main';

const authHeaders = {
  Authorization: `Bearer ${token}`,
  'User-Agent': 'esx-admin',
  Accept: 'application/vnd.github+json',
};

async function getFile(path) {
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) return null;
  const json = await res.json();
  const text = Buffer.from(json.content || '', 'base64').toString('utf8');
  return { sha: json.sha, text };
}

async function putFile(path, text, message) {
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const head = await getFile(path);
  const body = {
    message,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch,
    ...(head ? { sha: head.sha } : {}),
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'game';

// [2] Defaults for a brand-new game
function defaultSuite(title, type) {
  return {
    version: '0.0.1',
    missions: [
      {
        id: 'm01',
        title: 'Welcome',
        type: 'statement',
        rewards: { points: 10 },
        content: { text: `Welcome to ${title}! Ready to play?` }
      }
    ],
  };
}

function defaultConfig(title, gameType, mode = 'single', slugTag = '', extras = {}) {
  const players = mode === 'head2head' ? 2 : mode === 'multi' ? 4 : 1;
  const normSlug = (slugTag || slugify(title)).toLowerCase();
  const tags = normSlug ? [normSlug] : [];
  if (normSlug === 'default' && !tags.includes('default-game')) tags.push('default-game');
  return {
    splash: { enabled: true, mode }, // single | head2head | multi
    game: {
      title,
      type: gameType || 'Mystery',
      tags,
      coverImage: extras.coverImage || '',
      shortDescription: extras.shortDescription || '',
      longDescription: extras.longDescription || '',
      slug: normSlug,
    },
    forms: { players },              // 1 | 2 | 4
    textRules: []
  };
}

// [3] Handler: GET (list), POST (create)
export default async function handler(req, res) {
  if (!GAME_ENABLED) {
    if (req.method === 'GET') return res.json({ ok: true, games: [] });
    return res.status(403).json({ ok: false, error: 'Game project disabled' });
  }

  if (!token || !owner || !repo) {
    return res.status(500).json({ ok: false, error: 'Missing env: GITHUB_TOKEN, REPO_OWNER, REPO_NAME' });
  }

  const indexPath = 'public/games/index.json';

  if (req.method === 'GET') {
    const file = await getFile(indexPath);
    const list = file ? JSON.parse(file.text || '[]') : [];
    return res.json({ ok: true, games: list });
  }

  if (req.method === 'POST') {
    try {
      const {
        title,
        type,
        mode = 'single',
        slug: requestedSlug,
        shortDescription = '',
        longDescription = '',
        coverImage = '',
      } = req.body || {};
      if (!title) return res.status(400).json({ ok: false, error: 'title required' });

      // load index & ensure unique slug
      const file = await getFile(indexPath);
      const list = file ? JSON.parse(file.text || '[]') : [];
      const taken = new Set(list.map(g => g.slug));

      let base = slugify(requestedSlug || title);
      let slug = base || 'game';
      let i = 2;
      while (taken.has(slug)) slug = `${base}-${i++}`;

      const trimmedShort = String(shortDescription || '').trim();
      const trimmedLong = String(longDescription || '').trim();
      const normalizedCover = String(coverImage || '').trim();

      // create suite + config
      const suite  = defaultSuite(title, type);
      const config = defaultConfig(title, type, mode, slug, {
        shortDescription: trimmedShort,
        longDescription: trimmedLong,
        coverImage: normalizedCover,
      });

      await putFile(`public/games/${slug}/missions.json`, JSON.stringify(suite, null, 2),
        `feat: create game ${slug} missions.json`);
      await putFile(`public/games/${slug}/config.json`, JSON.stringify(config, null, 2),
        `feat: create game ${slug} config.json`);

      // update index.json
      const item = {
        slug,
        title,
        type: type || 'Mystery',
        mode,
        shortDescription: trimmedShort,
        longDescription: trimmedLong,
        coverImage: normalizedCover,
        createdAt: new Date().toISOString(),
      };
      const next = [...list, item];
      await putFile(indexPath, JSON.stringify(next, null, 2), `chore: update games index (${slug})`);

      return res.json({ ok: true, slug, game: item });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
