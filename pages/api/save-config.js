// pages/api/save-config.js
// Single-commit save endpoint that uses bulkCommitMixed to avoid per-file SHA conflicts.
// Mirrors saved content into game/public/games/<slug>/... so the Game app can preview drafts.

import { joinPath, bulkCommitMixed } from '../../lib/github.js';

const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

// Helper to detect legacy "root" game slug behavior (if your admin has a legacy root game)
function isLegacySlug(s) {
  const slug = String(s || '').trim().toLowerCase();
  return !slug || slug === '(legacy root)' || slug === 'legacy-root' || slug === 'root';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const slugRaw = body.slug;
    const channel = body.channel || 'draft'; // 'draft' or 'published'
    const config = body.config;
    const missions = body.missions;

    // Validate
    const legacy = isLegacySlug(slugRaw);
    if (!legacy && (!slugRaw || typeof slugRaw !== 'string')) {
      return res.status(400).json({ ok: false, error: 'Missing slug' });
    }
    const slug = legacy ? '' : String(slugRaw).trim();

    // Build target paths:
    // Admin writes to public/games/<slug>[/draft]/...
    // Mirror writes to game/public/games/<slug>[/draft]/...
    let adminBase;
    let gameBase;
    if (legacy) {
      // legacy root handling (if your app used a root public/draft)
      adminBase = channel === 'draft' ? joinPath('public', 'draft') : 'public';
      gameBase = null; // don't mirror legacy root into game/ by default
    } else {
      adminBase = channel === 'draft' ? joinPath('public/games', slug, 'draft') : joinPath('public/games', slug);
      gameBase = joinPath('game/public/games', slug, channel === 'draft' ? 'draft' : '');
    }

    // Build list of files to write in one commit
    const files = [];
    if (config) {
      files.push({ path: joinPath(adminBase, 'config.json'), content: pretty(config) });
      if (gameBase) files.push({ repoPath: joinPath(gameBase, 'config.json'), content: pretty(config) });
    }
    if (missions) {
      files.push({ path: joinPath(adminBase, 'missions.json'), content: pretty(missions) });
      if (gameBase) files.push({ repoPath: joinPath(gameBase, 'missions.json'), content: pretty(missions) });
    }

    if (files.length === 0) {
      return res.status(400).json({ ok: false, error: 'Nothing to save' });
    }

    // Write a single commit with all files (admin + mirror)
    const commit = await bulkCommitMixed(files, `save ${slug || 'root'} [${channel}]`);
    return res.status(200).json({
      ok: true,
      slug: slug || '(root)',
      wrote: files.map(f => f.repoPath || f.path),
      commitUrl: commit.htmlUrl
    });
  } catch (err) {
    console.error('save-config error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
