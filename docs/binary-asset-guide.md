# Media Storage Without Git Binaries

As of 2025-10-20 the Admin Escape Ride repository no longer tracks binary assets.
All images, audio, video, and AR models must be hosted outside of GitHub and
referenced through `public/media/manifest.json`. This guide explains the new
workflow so uploads still appear in the Media Pool without introducing large
blobs into the git history.

## 1. How the manifest works

* `public/media/manifest.json` lists every media entry the dashboard should
  display. Each entry includes:
  * `folder` — the logical Media Pool directory (for example
    `mediapool/Images/uploads`).
  * `type` — normalized media type (`image`, `audio`, `video`, `gif`,
    `ar-overlay`, `other`).
  * `url` — the externally hosted asset. When absent the item is flagged as
    `pending-external` in the UI.
  * Optional notes, tags, and timestamps for auditing.
* `/api/list-media` merges the manifest with any local files that exist in
  `.gitignored` directories, classifies each entry, and exposes the combined
  inventory to the Media Pool, Assigned Media tab, and mission editors.
* Because the manifest is plain JSON it can be reviewed, diffed, and versioned
  without storing binary payloads.

## 2. Registering new media

1. Upload the binary to an external provider (S3, GCS, Azure Blob, Dropbox,
   Google Drive, etc.) and obtain a public URL. The dashboard will rewrite
   common hosts (Dropbox, Drive) into direct-download links automatically.
2. In the Media Pool, drop the file you want to register. The new upload API
   (`pages/api/upload.js`) records metadata, ignores the raw payload, and appends
   a manifest entry pointing at the external URL you supplied in the "Paste URL"
   field.
3. The Media Pool refreshes automatically and routes the entry into the correct
   media type tab. If you omit the URL the item remains in a
   `pending external` state until you edit the manifest with the real link.

> **Tip:** you can edit `public/media/manifest.json` manually when bulk-updating
> links. Each commit should explain where the assets live so QA can verify.

## 3. Local development shortcuts

* Drop assets into the `public/media/mediapool/...` directories while testing.
  They are `.gitkeep` placeholders, so anything you place there remains
  untracked. `/api/list-media` still surfaces them in the UI alongside manifest
  entries.
* Add temporary notes to manifest items when you delete or migrate assets. The
  Media Pool surfaces those notes directly in the card UI.

## 4. Verifying the repository is binary-free

Run a quick audit before committing:

```bash
npm run verify:binaries
```

The command exits with status `0` when no tracked binaries are found. If you do
intend to keep a binary checked in (for example, a design token screenshot)
explain why in the commit message and attach a follow-up task to migrate it off
GitHub.

## 5. Troubleshooting checklist

| Symptom | Fix |
| --- | --- |
| Media card shows `pending external` | Update the manifest entry with a valid public `url`. |
| "Open" button disabled | Provide an external URL or drop a local file inside the `.gitignored` media folder while testing. |
| Manifest write fails on upload | The API now falls back to `.next/cache/admin-media/manifest.json` (or `MEDIA_MANIFEST_FALLBACK_PATH`). If you still see errors, set `MEDIA_MANIFEST_PATH` or point `MEDIA_STORAGE_ROOT` at a writable volume such as `/tmp`. |
| Need a historical asset | Check prior commits or the external storage provider; binaries are no longer in git history after 2025-10-20. |

## 6. Preparing Supabase storage

The admin upload flow is ready to target Supabase Storage for persistent media.

1. Provision a Supabase project and create a storage bucket (for example,
   `escape-ride-media`). Enable public access or generate signed URLs for the
   admin dashboard to surface thumbnails.
2. Supply the following environment variables to the Next.js runtime:

   * `SUPABASE_URL` — the Supabase project URL.
   * `SUPABASE_ANON_KEY` — the client key used for public uploads/listing.
   * `SUPABASE_SERVICE_ROLE_KEY` — optional; unlocks server-side management
     tasks (keep it secret and only expose it on the API layer).
   * `SUPABASE_MEDIA_BUCKET` — bucket name that will store admin media.
   * `SUPABASE_MEDIA_PREFIX` — optional folder prefix inside the bucket (for
     example, `mediapool/`).

3. Once credentials are available, update `/api/upload` to write the incoming
   binary payload to the Supabase bucket and persist the returned public URL in
   the manifest entry. `/api/list-media` is already structured so you can merge
   Supabase listings with the manifest data without further schema changes.

> **Request:** Share the Supabase bucket name, region, and access policy (public
> vs signed URLs). With those details we can wire the API to stream uploads to
> Supabase while keeping the manifest as the source of truth.

Following this flow keeps the repository lightweight, satisfies the "no binary"
requirement, and still presents a full media catalog inside the admin dashboard.
