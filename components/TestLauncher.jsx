// components/TestLauncher.jsx
import React, { useState } from "react";

/**
 * TestLauncher
 * Props:
 *  - slug (string) required
 *  - channel (string) optional 'published'|'draft' (default 'published')
 *  - preferPretty (bool) optional: try /<slug> path (default false)
 *  - popup (bool) optional: open small centered popup window (default false)
 *
 * Usage:
 *  <TestLauncher slug={currentSlug} channel="published" />
 */
export default function TestLauncher({ slug, channel = "published", preferPretty = false, popup = false }) {
  const [lastUrl, setLastUrl] = useState(null);
  const [status, setStatus] = useState(null);

  if (!slug || typeof slug !== "string" || !slug.trim()) {
    return <div style={{ color: "orange" }}>No slug set — set a slug to test the game.</div>;
  }

  // prefer environment variables (NEXT_PUBLIC accessible in client)
  const envOrigin = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_GAME_ORIGIN)
    || (typeof process !== "undefined" && process.env && process.env.GAME_ORIGIN)
    || null;

  // Fallback heuristic: switch subdomain admin -> game if same base domain
  function guessOrigin() {
    if (envOrigin) return envOrigin.replace(/\/+$/, "");
    try {
      const adminOrigin = window.location.origin;
      // replace admin.* with game.*
      const replaced = adminOrigin.replace(/^https?:\/\/admin\./i, (m) => m.replace('admin', 'game'));
      if (replaced !== adminOrigin) return replaced;
      // fallback to same host, game. prefix
      const urlObj = new URL(adminOrigin);
      return `${urlObj.protocol}//game.${urlObj.hostname.replace(/^www\./,'')}`;
    } catch (e) {
      return "";
    }
  }

  const origin = guessOrigin();

  function buildUrl() {
    const s = encodeURIComponent(slug.trim());
    const ch = encodeURIComponent(channel || "published");

    if (preferPretty) {
      // try pretty path with query as well (safe)
      // example: https://game.esxaperide.com/test?slug=test&channel=published&preview=1
      return `${origin}/${s}?slug=${s}&channel=${ch}&preview=1`;
    }

    // safe query URL that always works with current runner
    return `${origin}/?slug=${s}&channel=${ch}&preview=1`;
  }

  function openWindow(url) {
    setLastUrl(url);
    setStatus("opening");

    if (popup) {
      // open a centered small popup window
      const w = 1200;
      const h = 800;
      const left = window.screenX + Math.max(0, (window.innerWidth - w) / 2);
      const top = window.screenY + Math.max(0, (window.innerHeight - h) / 2);
      const opts = `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${w},height=${h},top=${top},left=${left}`;
      const win = window.open(url, `_blank`, opts);
      if (win) {
        try { win.focus(); } catch (e) {}
        setStatus("opened");
      } else {
        setStatus("blocked");
      }
    } else {
      const win = window.open(url, "_blank");
      if (win) {
        try { win.focus(); } catch (e) {}
        setStatus("opened");
      } else {
        setStatus("blocked");
      }
    }
  }

  const url = buildUrl();

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button
        onClick={() => openWindow(url)}
        style={{
          background: "#0a6",
          color: "#012",
          padding: "8px 12px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          fontWeight: 600
        }}
        title="Open the game preview in a new window"
      >
        Open Live Game
      </button>

      <button
        onClick={() => { navigator.clipboard?.writeText(url).then(()=>setStatus("copied")).catch(()=>setStatus("copy-failed")); }}
        style={{
          background: "#0cf",
          color: "#012",
          padding: "6px 10px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer"
        }}
        title="Copy game preview URL to clipboard"
      >
        Copy URL
      </button>

      <div style={{ fontSize: 13, color: "#cbd5e1" }}>
        {status === "opening" && "Opening…"}
        {status === "opened" && <span style={{ color: "#9ef" }}>Opened</span>}
        {status === "blocked" && <span style={{ color: "#f88" }}>Popup blocked — allow popups</span>}
        {status === "copied" && <span style={{ color: "#9ef" }}>URL copied</span>}
        {status === "copy-failed" && <span style={{ color: "#f88" }}>Copy failed</span>}
      </div>

      {/* reveal the URL for debugging */}
      <div style={{ marginLeft: 12, fontSize: 12, color: "#8ea0b2" }}>
        <div style={{ maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lastUrl || url}
        </div>
      </div>
    </div>
  );
}
