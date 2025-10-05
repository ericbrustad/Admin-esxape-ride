// pages/api/runs/[slug].js
// Store a completed run with answers & score. CORS-enabled for Game origin.

export const config = { api: { bodyParser: true } };

const {
  REPO_OWNER,
  REPO_NAME,
  GITHUB_TOKEN,
  GITHUB_BRANCH = 'main',
  GITHUB_BASE_DIR = '',
  NEXT_PUBLIC_GAME_ORIGIN, // for CORS
} = process.env;

const GH_ROOT = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

function normBaseDir(s) { if (!s || s === '(empty)') return ''; return s.replace(/^\/+|\/+$/g, ''); }
const BASE_DIR = normBaseDir(GITHUB_BASE_DIR);
function joinPath(p) { const clean = p.replace(/^\/+/, ''); return BASE_DIR ? `${BASE_DIR}/${clean}` : clean; }

function cors(res) {
  const allow = NEXT_PUBLIC_GAME_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function getFileSha(path) {
  const url = `${GH_ROOT}/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'esx-admin' },
  });
  if (r.ok) { const j = await r.json(); return j.sha || null; }
  return null;
}
async function putFile(path, contentText, message) {
  const sha = await getFileSha(path);
  const body = {
    message,
    content: Buffer.from(contentText, 'utf8').toString('base64'),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  };
  const url = `${GH_ROOT}/${encodeURIComponent(path)}`;
  const r = await fetch(url, {
    method:'PUT',
    headers:{ Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json', 'User-Agent':'esx-admin' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GitHub PUT failed: ${r.status} ${t}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });

  try {
    const slug = String(req.query.slug || '').trim();
    if (!slug) return res.status(400).json({ ok:false, error:'Missing slug' });

    const { answers, score, player, meta } = req.body || {};
    if (!answers) return res.status(400).json({ ok:false, error:'Missing answers map' });

    // Build the run record
    const ts = new Date();
    const stamp = ts.toISOString().replace(/[-:.TZ]/g,'').slice(0,14); // YYYYMMDDHHMMSS
    const run = {
      slug,
      score: Number(score || 0),
      answers,        // { "m01": "lucy", "m02": "A", ... }
      player: player || {}, // { email, phone, name, ... }
      meta:   meta   || {}, // any client-side info you want
      savedAt: ts.toISOString(),
      savedBy: 'admin-esxaperide',
      version: 1,
    };
    const text = JSON.stringify(run, null, 2);

    const rootPath = joinPath(`public/games/${slug}/runs/${stamp}.json`);
    const gamePath = joinPath(`game/public/games/${slug}/runs/${stamp}.json`);

    const wrote = [];
    await putFile(rootPath, text, `run(${slug}): ${stamp}`); wrote.push(rootPath);
    await putFile(gamePath, text, `run(${slug} game): ${stamp}`); wrote.push(gamePath);

    // OPTIONAL: trigger SMS/email here if you want (Twilio / provider)
    // Example (pseudo):
    // if (process.env.TWILIO_ACCOUNT_SID && player?.phone) { ...send SMS... }
    // if (process.env.RESEND_API_KEY && player?.email) { ...send email... }

    return res.json({ ok:true, slug, wrote, id: stamp });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
