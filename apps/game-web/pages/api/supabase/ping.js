// fd00ff7: comment placeholder — feel free to use this block for quick deploy checks.
/**
 * Simple health check endpoint for uptime monitors and smoke tests.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    ok: true,
    message: 'pong',
    time: new Date().toISOString(),
    requestId: req.headers['x-vercel-id'] || null,
  });
}

