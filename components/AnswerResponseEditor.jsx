import React, { useEffect, useState } from "react";
import OutcomeModal from "./OutcomeModal";

/**
 * AnswerResponseEditor.jsx
 *
 * - Clean, multi-line JSX (no huge single-line expressions) to avoid parser errors.
 * - Two inline buttons: Open Correct Response / Open Wrong Response.
 * - Overlays open only when those buttons are clicked.
 * - Optional createResponseMission(editing, type, payload) callback: if provided,
 *   the component will call it before opening the overlay so the host app can
 *   insert a mission stub beneath the current mission.
 */

export default function AnswerResponseEditor({ editing, setEditing, inventory = [], createResponseMission , openInitial}) {
  if (!editing || !setEditing) return null;

  const imagesVideos = inventory.filter((it) => {
    const t = (it.type || "").toLowerCase();
    return /^(image|gif|video)$/i.test(t) ||
      /\.(png|jpg|jpeg|gif|webp|avif|mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(it.url || "");
  });

  const audios = inventory.filter((it) => {
    const t = (it.type || "").toLowerCase();
    return /^audio$/i.test(t) || /\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/i.test(it.url || "");
  });

  const [openCorrect, setOpenCorrect] = useState(false);
  const [openWrong, setOpenWrong] = useState(false);

  const [localCorrect, setLocalCorrect] = useState(normalizeResponse(editing.onCorrect));
  const [localWrong, setLocalWrong] = useState(normalizeResponse(editing.onWrong));

  useEffect(() => {
    setLocalCorrect(normalizeResponse(editing.onCorrect));
  }, [editing.onCorrect]);

  useEffect(() => {
    setLocalWrong(normalizeResponse(editing.onWrong));
  }, [editing.onWrong]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (openCorrect || openWrong) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openCorrect, openWrong]);

  

// If parent passes openInitial='correct' or 'wrong', auto-open that modal on mount
useEffect(() => {
  if (!openInitial) return;
  if (openInitial === 'correct') {
    // ensure the correct response is enabled, then open the editor/modal
    if (!editing.onCorrect) {
      setEditing(prev => ({ ...prev, onCorrect: prev.onCorrect ? prev.onCorrect : { statement: '', mediaUrl: '', audioUrl: '', durationSeconds: 0, buttonText: 'OK' } }));
    }
    // small timeout to allow state to settle then open
    setTimeout(() => { try { openCorrectViaCreator(); } catch (e) {} }, 50);
  } else if (openInitial === 'wrong') {
    if (!editing.onWrong) {
      setEditing(prev => ({ ...prev, onWrong: prev.onWrong ? prev.onWrong : { statement: '', mediaUrl: '', audioUrl: '', durationSeconds: 0, buttonText: 'OK' } }));
    }
    setTimeout(() => { try { openWrongViaCreator(); } catch (e) {} }, 50);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [openInitial]);
const styles = {
    row: { display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center", margin: "6px 0" },
    lab: { fontSize: 13, color: "#9fb0bf" },
    inp: { padding: "10px 12px", borderRadius: 8, border: "1px solid #2a323b", background: "#0b0c10", color: "#e9eef2", width: "100%" },
    box: { border: "1px solid #2a323b", borderRadius: 10, padding: 10, margin: "8px 0", background: "#0c0f12" },
    smallBtn: { padding: "6px 10px", borderRadius: 8, border: "1px solid #2a323b", background: "#0b1115", color: "#e9eef2", cursor: "pointer" },
    dangerBtn: { padding: "6px 10px", borderRadius: 8, border: "1px solid #2a323b", background: "#3a1b1b", color: "#fff", cursor: "pointer" },
  };

  function normalizeResponse(obj) {
    return {
      statement: (obj && obj.statement) || "",
      mediaUrl: (obj && obj.mediaUrl) || "",
      audioUrl: (obj && obj.audioUrl) || "",
      durationSeconds: (obj && Number(obj.durationSeconds)) || 0,
      buttonText: (obj && obj.buttonText) || "OK",
    };
  }

  function enableCorrect(enabled) {
    if (enabled) {
      setEditing((prev) => ({
        ...prev,
        onCorrect: prev.onCorrect ? prev.onCorrect : { statement: "", mediaUrl: "", audioUrl: "", durationSeconds: 0, buttonText: "OK" },
      }));
    } else {
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy.onCorrect;
        return copy;
      });
    }
  }

  function enableWrong(enabled) {
    if (enabled) {
      setEditing((prev) => ({
        ...prev,
        onWrong: prev.onWrong ? prev.onWrong : { statement: "", mediaUrl: "", audioUrl: "", durationSeconds: 0, buttonText: "OK" },
      }));
    } else {
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy.onWrong;
        return copy;
      });
    }
  }

  function saveCorrect() {
    const payload = {
      statement: String(localCorrect.statement || ""),
      mediaUrl: localCorrect.mediaUrl || "",
      audioUrl: localCorrect.audioUrl || "",
      durationSeconds: Number(localCorrect.durationSeconds || 0),
      buttonText: localCorrect.buttonText || "OK",
    };
    setEditing((prev) => ({ ...prev, onCorrect: payload }));
    setOpenCorrect(false);
  }

  function cancelCorrect() {
    setLocalCorrect(normalizeResponse(editing.onCorrect));
    setOpenCorrect(false);
  }

  function disableCorrectAndClose() {
    enableCorrect(false);
    setOpenCorrect(false);
  }

  function saveWrong() {
    const payload = {
      statement: String(localWrong.statement || ""),
      mediaUrl: localWrong.mediaUrl || "",
      audioUrl: localWrong.audioUrl || "",
      durationSeconds: Number(localWrong.durationSeconds || 0),
      buttonText: localWrong.buttonText || "OK",
    };
    setEditing((prev) => ({ ...prev, onWrong: payload }));
    setOpenWrong(false);
  }

  function cancelWrong() {
    setLocalWrong(normalizeResponse(editing.onWrong));
    setOpenWrong(false);
  }

  function disableWrongAndClose() {
    enableWrong(false);
    setOpenWrong(false);
  }

  async function openCorrectViaCreator() {
    if (typeof createResponseMission === "function") {
      if (!editing.onCorrect) enableCorrect(true);
      try {
        await createResponseMission("correct", normalizeResponse(editing.onCorrect));
      } catch (e) {
        // ignore errors from host creator
      }
    }
    setLocalCorrect(normalizeResponse(editing.onCorrect));
    setOpenCorrect(true);
  }

  async function openWrongViaCreator() {
    if (typeof createResponseMission === "function") {
      if (!editing.onWrong) enableWrong(true);
      try {
        await createResponseMission("wrong", normalizeResponse(editing.onWrong));
      } catch (e) {
        // ignore
      }
    }
    setLocalWrong(normalizeResponse(editing.onWrong));
    setOpenWrong(true);
  }

  function Thumb({ url }) {
    if (!url) return null;
    if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url)) {
      return <video src={url} style={{ maxWidth: 120, maxHeight: 80, borderRadius: 6 }} />;
    }
    if (/\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/i.test(url)) {
      return <div style={{ color: "#9fb0bf", fontSize: 12 }}>Audio selected</div>;
    }
    return <img src={url} alt="thumb" style={{ maxWidth: 120, maxHeight: 80, objectFit: "cover", borderRadius: 6 }} />;
  }

  function ResponseModal({ title, local, setLocal, onSave, onCancel, onDisable, mediaList, audioList, open }) {
    if (!open) return null;

    return (
      <OutcomeModal open={open} onClose={onCancel}>
        <div style={{ width: "880px", maxWidth: "100%", maxHeight: "92vh", overflow: "auto", background: "#0b0f12", border: "1px solid #2a323b", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ color: "#e9eef2", fontWeight: 700, fontSize: 16 }}>{title}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.smallBtn} onClick={() => onCancel()}>Cancel</button>
              <button style={styles.smallBtn} onClick={() => onSave()}>Save</button>
              <button style={styles.dangerBtn} onClick={() => { if (confirm("Disable this response?")) onDisable(); }}>Disable</button>
            </div>
          </div>

          <div style={{ ...styles.box, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Statement</div>
            <textarea value={local.statement} onChange={(e) => setLocal({ ...local, statement: e.target.value })} style={{ ...styles.inp, height: 96 }} />
          </div>

          <div style={{ ...styles.box, marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
              <div style={styles.lab}>Media (image/video)</div>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={local.mediaUrl || ""} onChange={(e) => setLocal({ ...local, mediaUrl: e.target.value })} style={styles.inp}>
                    <option value="">(none)</option>
                    {mediaList.map((m, i) => <option key={i} value={m.url}>{m.name || m.url.replace(/^.*\//, "")}</option>)}
                  </select>
                  {local.mediaUrl ? <button style={styles.smallBtn} onClick={() => window.open(local.mediaUrl, "_blank")}>Open</button> : null}
                </div>
                <div style={{ marginTop: 8 }}><Thumb url={local.mediaUrl} /></div>
              </div>
            </div>
          </div>

          <div style={{ ...styles.box, marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
              <div style={styles.lab}>Audio (optional)</div>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={local.audioUrl || ""} onChange={(e) => setLocal({ ...local, audioUrl: e.target.value })} style={styles.inp}>
                    <option value="">(none)</option>
                    {audioList.map((m, i) => <option key={i} value={m.url}>{m.name || m.url.replace(/^.*\//, "")}</option>)}
                  </select>
                  {local.audioUrl ? <audio controls src={local.audioUrl} style={{ marginLeft: 8 }} /> : null}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...styles.box, marginBottom: 8 }}>
            <div style={styles.row}>
              <div style={styles.lab}>Auto-close after (seconds)</div>
              <input type="number" min={0} max={1200} value={local.durationSeconds || 0} onChange={(e) => setLocal({ ...local, durationSeconds: Math.max(0, Number(e.target.value || 0)) })} style={styles.inp} />
            </div>
            <div style={styles.row}>
              <div style={styles.lab}>Button label</div>
              <input value={local.buttonText || "OK"} onChange={(e) => setLocal({ ...local, buttonText: e.target.value || "OK" })} style={styles.inp} />
            </div>
          </div>
        </div>
      </OutcomeModal>
    );
  }

  return (
    <div style={{ ...styles.box }}>
      <div style={{ fontWeight: 700, marginBottom: 10, color: "#e9eef2" }}>Answer Responses (Correct / Wrong)</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 10, border: "1px solid #2a323b", borderRadius: 8, background: "#0b1115" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: "#e9eef2" }}>On Correct Answer</div>
            <label style={{ color: "#9fb0bf", fontSize: 13 }}>
              <input type="checkbox" checked={!!editing.onCorrect} onChange={(e) => enableCorrect(e.target.checked)} /> Enable
            </label>
          </div>

          <div style={{ color: "#9fb0bf", fontSize: 13 }}>
            {editing.onCorrect ? (
              <div>
                <div style={{ marginBottom: 6 }}>{editing.onCorrect.statement ? editing.onCorrect.statement.substring(0, 120) : <i style={{ color: "#7b8b95" }}>No statement</i>}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Thumb url={editing.onCorrect.mediaUrl} />
                  {editing.onCorrect.audioUrl ? <div style={{ color: "#9fb0bf" }}>Audio selected</div> : null}
                </div>
              </div>
            ) : <div style={{ color: "#7b8b95" }}>Disabled</div>}
          </div>
        </div>

        <div style={{ padding: 10, border: "1px solid #2a323b", borderRadius: 8, background: "#110b0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: "#e9eef2" }}>On Wrong Answer</div>
            <label style={{ color: "#9fb0bf", fontSize: 13 }}>
              <input type="checkbox" checked={!!editing.onWrong} onChange={(e) => enableWrong(e.target.checked)} /> Enable
            </label>
          </div>

          <div style={{ color: "#9fb0bf", fontSize: 13 }}>
            {editing.onWrong ? (
              <div>
                <div style={{ marginBottom: 6 }}>{editing.onWrong.statement ? editing.onWrong.statement.substring(0, 120) : <i style={{ color: "#7b8b95" }}>No statement</i>}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Thumb url={editing.onWrong.mediaUrl} />
                  {editing.onWrong.audioUrl ? <div style={{ color: "#9fb0bf" }}>Audio selected</div> : null}
                </div>
              </div>
            ) : <div style={{ color: "#7b8b95" }}>Disabled</div>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={styles.smallBtn} onClick={openCorrectViaCreator}>Open Correct Response</button>
        <button style={styles.smallBtn} onClick={openWrongViaCreator}>Open Wrong Response</button>
      </div>

      <ResponseModal title="Edit Correct Response" local={localCorrect} setLocal={setLocalCorrect} onSave={saveCorrect} onCancel={cancelCorrect} onDisable={disableCorrectAndClose} mediaList={imagesVideos} audioList={audios} open={openCorrect} />
      <ResponseModal title="Edit Wrong Response" local={localWrong} setLocal={setLocalWrong} onSave={saveWrong} onCancel={cancelWrong} onDisable={disableWrongAndClose} mediaList={imagesVideos} audioList={audios} open={openWrong} />
    </div>
  );
}
