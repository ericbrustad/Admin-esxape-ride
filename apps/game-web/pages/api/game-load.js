import { getDefaults, listFiles, getObjectJson } from "../../lib/supabaseHttp";

// Tries several common mission bundle locations for a given ?game=<id>
export default async function handler(req, res) {
  const game = String(req.query.game || "").trim() || "demo";
  const { bucket } = getDefaults(); // defaults to game-media
  const candidates = [
    `games/${game}/bundle.json`,
    `missions/${game}.json`,
    `${game}.json`,
  ];
  // If a fully qualified path is passed, honor it:
  if (req.query.path) candidates.unshift(String(req.query.path));

  // If we can list, prefer the first that exists; otherwise, just try to fetch each.
  for (const path of candidates) {
    const { data, error } = await getObjectJson(bucket, path);
    if (data && !error) {
      return res.status(200).json({ ok: true, bucket, path, bundle: data });
    }
  }
  // Optional hint: list the bucket root to help user see what's there
  try {
    const list = await listFiles(bucket, "", 100, { column: "name", order: "asc" });
    return res.status(200).json({
      ok: false,
      error: `No mission bundle found for game='${game}'. Tried: ${candidates.join(", ")}`,
      bucket,
      tried: candidates,
      root: Array.isArray(list.data) ? list.data.map((f) => f.name) : [],
    });
  } catch {
    return res.status(200).json({
      ok: false,
      error: `No mission bundle found for game='${game}'. Tried: ${candidates.join(", ")}`,
      bucket,
      tried: candidates,
    });
  }
}
