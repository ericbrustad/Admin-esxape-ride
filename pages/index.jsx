async function uploadToRepo(file, subfolder = 'uploads') {
  if (!file) return '';
  const array = await file.arrayBuffer();
  const contentBase64 = btoa(String.fromCharCode(...new Uint8Array(array)));
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `public/media/${subfolder}/${Date.now()}-${safeName}`;

  setUploadStatus(`Uploading ${safeName}…`);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // keep basic auth
    body: JSON.stringify({ path, contentBase64, message: `upload ${safeName}` }),
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    setUploadStatus(`❌ ${j?.error || 'Upload failed'}`);
    return '';
  }
  setUploadStatus(`✅ Uploaded ${safeName}`);
  // Served by Next from /public → /media/...
  return `/${path.replace(/^public\//, '')}`;
}
