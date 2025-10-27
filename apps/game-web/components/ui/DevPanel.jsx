import React, { useMemo } from "react";
import { emit, Events } from "../../lib/eventBus";

export default function DevPanel({ overlays = [], missionTitle = "" }) {
  const items = useMemo(
    () => (Array.isArray(overlays) ? overlays : []).map((f) => ({
      id: f.id,
      type: f.type,
      radius: f.radius,
      coordinates: f.coordinates,
      title: f?.dialog?.title || f?.prompt?.title || ""
    })),
    [overlays]
  );
  if (!items.length) return null;
  return (
    <div style={wrap}>
      <div style={head}>
        <strong>Dev Panel</strong>
        <span style={{ opacity: 0.7, marginLeft: 8 }}>{missionTitle || ""}</span>
      </div>
      <div style={{ maxHeight: 260, overflow: "auto" }}>
        {items.map((it) => (
          <div key={it.id} style={row}>
            <div style={{ fontWeight: 600 }}>{it.id}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{it.type} · R={it.radius || 100}m</div>
            <button
              style={btn}
              onClick={() => {
                emit(Events.GEO_ENTER, { feature: overlays.find((o) => o.id === it.id), distance: 0 });
                emit(Events.UI_OPEN_DIALOG, {
                  title: it.title || "Zone reached",
                  message: `Manual enter: ${it.id}`,
                  continueLabel: "Continue"
                });
              }}
            >
              Trigger Enter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
const wrap = {
  position: "fixed",
  right: 12,
  bottom: 12,
  zIndex: 10002,
  width: 280,
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 12,
  boxShadow: "0 12px 30px rgba(0,0,0,.25)",
  fontFamily: "system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
};
const head = { padding: "10px 12px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center" };
const row = { padding: "10px 12px", borderBottom: "1px solid #f3f3f3", display: "grid", gap: 4 };
const btn = {
  marginTop: 6,
  alignSelf: "start",
  padding: "6px 10px",
  border: "1px solid #333",
  borderRadius: 8,
  background: "#111",
  color: "#fff",
  cursor: "pointer"
};
