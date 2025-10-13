import React, { useEffect, useState, useRef, useMemo } from "react";

/**
 * InlineMissionResponses.jsx
 *
 * Props:
 *  - editing: mission object being edited
 *  - setEditing: setter for the mission object
 *  - inventory: array of media items { url, label, ... } (from media pool)
 *
 * This component provides UI for editing onCorrect / onWrong responses including:
 *  - enable/disable response (Engage Response)
 *  - device trigger picker (fetches devices via /api/config)
 *  - media selector (filtered by type) with thumbnails & preview
 *  - drag-and-drop file upload (sends base64 to /api/upload endpoint similar to parent)
 *  - marks mission object with trigger flags so parent can display markers once saved
 *
 * NOTE: The parent page must call saveToList to persist changes into the suite/config.
 */

function toDirectMediaURL(u) {
  if (!u) return u;
  try {
    return new URL(u, typeof window !== "undefined" ? window.location.origin : "http://local").toString();
  } catch {
    return u;
  }
}
function classifyByExt(u) {
  if (!u) return "other";
  const s = String(u).toLowerCase();
  if (/\.(png|jpg|jpeg|webp)$/i.test(s)) return "image";
  if (/\.(gif)$/i.test(s)) return "gif";
  if (/\.(mp4|webm|mov)$/i.test(s)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aiff|aif)$/i.test(s)) return "audio";
  return "other";
}

export default function InlineMissionResponses({ editing, setEditing, inventory = [] }) {
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [mediaFilter, setMediaFilter] = useState("auto"); // auto / image / video / audio / gif / other
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState("");
  const dropRef = useRef(null);

  const mediaOptions = useMemo(() => {
    return (inventory || []).map((it, idx) => {
      const raw = it?.url || it?.path || it;
      const url = toDirectMediaURL(raw);
      if (!url) return null;
      const label = it?.label || (String(raw || '').split('/').pop() || `Media ${idx + 1}`);
      return {
        id: url,
        label,
        thumbnail: url,
        type: classifyByExt(url),
        tags: Array.isArray(it?.tags) ? it.tags : [],
      };
    }).filter(Boolean);
  }, [inventory]);

  const deviceOptions = useMemo(() => {
    return (devices || []).map((d, idx) => {
      const id = d?.id || d?.key || d?._id || `device-${idx}`;
      const label = d?.title || d?.name || id;
      const thumb = toDirectMediaURL(d?.iconUrl || d?.icon || '');
      return { id, label, thumbnail: thumb, meta: d };
    });
  }, [devices]);

  const missionOptions = useMemo(() => {
    if (!editing) return [];
    const id = editing.id || 'current-mission';
    const label = `${editing.title || id} Mission`;
    const thumb = toDirectMediaURL(editing.iconUrl || editing.icon || '');
    return [{ id, label, thumbnail: thumb, meta: editing }];
  }, [editing]);

  const actionOptionsByType = useMemo(() => ({
    media: mediaOptions,
    devices: deviceOptions,
    missions: missionOptions,
  }), [mediaOptions, deviceOptions, missionOptions]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingDevices(true);
      try {
        // try to load devices from /api/config which is standard in this app
        const res = await fetch("/api/config", { cache: "no-store", credentials: "include" });
        const j = await res.json().catch(() => ({}));
        const devs = (j.devices || j.powerups || []);
        if (mounted) setDevices(Array.isArray(devs) ? devs : []);
      } catch {
        if (mounted) setDevices([]);
      } finally {
        if (mounted) setLoadingDevices(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function ensureSide(side) {
    if (!editing) return {};
    const s = editing[side] || {};
    return s;
  }

  function updateSide(side, next) {
    const cur = editing || {};
    const nextObj = { ...(cur[side] || {}), ...next };
    // ensure presence on mission object and mark mission as having responses
    const updated = { ...cur, [side]: nextObj };
    // mark mission-level triggers/markers
    const hasTrigger = ((updated.onCorrect && updated.onCorrect.enabled) || (updated.onWrong && updated.onWrong.enabled));
    updated._hasResponseTrigger = hasTrigger; // an internal marker the parent can use to render badges
    setEditing(updated);
  }

  async function uploadFileAsMedia(file, subfolder="uploads") {
    // replicate parent's uploadToRepo behaviour (base64 JSON POST to /api/upload)
    try {
      const array = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(array)));
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const timestamp = Date.now();
      const path = `public/media/${subfolder}/${timestamp}-${safeName}`;
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path, contentBase64: b64, message: `upload ${safeName}` })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "upload failed");
      // returned path like /media/....
      const url = "/" + path.replace(/^public\//,'');
      return url;
    } catch (e) {
      console.error("upload failed", e);
      alert("Upload failed: " + (e?.message || e));
      return "";
    }
  }

  // drag & drop handling
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    function onDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer?.files?.[0];
      if (f) {
        (async () => {
          const url = await uploadFileAsMedia(f, "uploads");
          if (url) {
            // add to inventory locally and to selected side
            // default: attach to onCorrect if it's present in editing, otherwise onWrong
            const side = editing?.onCorrect ? "onCorrect" : "onWrong";
            updateSide(side, { mediaUrl: url });
            setSelectedPreviewUrl(url);
          }
        })();
      }
    }
    function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
    el.addEventListener("drop", onDrop);
    el.addEventListener("dragover", onDragOver);
    return () => {
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("dragover", onDragOver);
    };
  }, [dropRef, editing]);

  function filteredInventory() {
    if (!Array.isArray(inventory)) return [];
    if (mediaFilter === "auto") return inventory;
    return inventory.filter(it => classifyByExt(it.url) === mediaFilter);
  }

  function chooseMediaForSide(side, url) {
    const kind = classifyByExt(url);
    if (kind === "audio") {
      updateSide(side, { audioUrl: url, mediaUrl: undefined });
    } else {
      updateSide(side, { mediaUrl: url, audioUrl: undefined });
    }
    setSelectedPreviewUrl(url);
  }

  function chooseDeviceForSide(side, deviceId) {
    const dev = devices.find(d => (d.id || d.key || d._id) === deviceId);
    updateSide(side, { deviceId: deviceId, deviceLabel: dev?.title || dev?.name || dev?.key || deviceId, enabled: true });
  }

  function removeDeviceForSide(side) {
    updateSide(side, { deviceId: undefined, deviceLabel: undefined });
  }

  function toggleEngage(side, on) {
    const current = ensureSide(side);
    const payload = { enabled: !!on };
    if (on && !current.triggerActionType) {
      payload.triggerActionType = 'media';
    }
    updateSide(side, payload);
  }

  function renderMediaTile(it) {
    const url = toDirectMediaURL(it.url || it.path || it);
    const kind = classifyByExt(url);
    return (
      <div key={url} style={{ border:'1px solid #233036', borderRadius:8, padding:8, display:'grid', gap:6 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ width:64, height:48, borderRadius:6, overflow:'hidden', background:'#0b0c10', display:'grid', placeItems:'center' }}>
            {kind === "image" || kind === "gif" ? <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
             : kind === "video" ? <video src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted playsInline /> 
             : kind === "audio" ? <div style={{ fontSize:12, color:'#9fb0bf' }}>Audio</div>
             : <div style={{ fontSize:12, color:'#9fb0bf' }}>File</div>}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontWeight:600, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.label || (it.url||it).split('/').pop()}</div>
            <div style={{ fontSize:12, color:'#9fb0bf' }}>{classifyByExt(url)}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button style={styles.smallButton} onClick={()=>{ setSelectedPreviewUrl(url); }}>Preview</button>
          <button style={styles.smallButton} onClick={()=>chooseMediaForSide(currentSideRef.current, url)}>Select</button>
        </div>
      </div>
    );
  }

  const currentSideRef = useRef("onCorrect"); // used by select buttons inside tiles

  function ResponseEditor({ sideKey = "onCorrect", title = "On Correct" }) {
    const side = ensureSide(sideKey);
    const enabled = !!side.enabled;
    const deviceId = side.deviceId;
    const deviceLabel = side.deviceLabel;
    const mediaUrl = side.mediaUrl;
    const audioUrl = side.audioUrl;
    const actionType = side.triggerActionType || 'media';
    const actionTarget = side.triggerActionTarget || '';
    const actionLabel = side.triggerActionLabel || '';
    const actionOptions = actionOptionsByType[actionType] || [];
    const selectedAction = actionOptions.find(opt => opt.id === actionTarget) || null;
    const resolvedActionPreview = side.triggerActionThumbnail || selectedAction?.thumbnail || '';
    const selectedMediaUrl = mediaUrl || audioUrl || '';
    const selectedMediaType = classifyByExt(selectedMediaUrl);
    const summaryBorder = sideKey === 'onCorrect' ? '#1aa654' : '#7a1f1f';
    const summaryBackground = sideKey === 'onCorrect' ? 'rgba(26,166,84,0.08)' : 'rgba(122,31,31,0.08)';
    const summaryTitle = sideKey === 'onCorrect' ? 'Correct Response Media' : 'Wrong Response Media';
    const tickerMessage = enabled
      ? `Response Enabled — ${deviceId ? 'Trigger Device ready' : 'Select a Trigger Device'} · ${actionTarget ? `Triggered Response: ${actionLabel || actionTarget}` : 'Choose a Triggered Response'}`
      : 'No Devices Enabled';

    // device options from devices state
    const hasDevices = devices && devices.length > 0;

    // keep currentSideRef in sync for renderMediaTile's "Select" buttons
    useEffect(() => { currentSideRef.current = sideKey; }, [sideKey]);

    return (
      <div style={{ border:'1px solid #1f2b2f', borderRadius:10, padding:12, marginBottom:12, background:'#071014' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <div style={{ fontWeight:700 }}>{title}</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:8 }} title="When enabled this response will act as a trigger">
              <input type="checkbox" checked={enabled} onChange={(e)=>toggleEngage(sideKey, e.target.checked)} /> Engage Response
            </label>
          </div>
        </div>

        {/* status ticker */}
        <div style={{ marginTop:8, marginBottom:8 }}>
          <div style={{ padding:8, borderRadius:8, border:'1px solid #132122', background: enabled ? 'rgba(34,197,94,0.06)' : 'transparent', color: enabled ? '#a7f3d0' : '#9fb0bf' }}>
            {tickerMessage}
          </div>
        </div>

        {/* Device selector */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:8, alignItems:'center' }}>
          <div>
            <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Trigger Device</div>
            {loadingDevices ? <div style={{ color:'#9fb0bf' }}>Loading devices…</div> : (
              hasDevices ? (
                <div style={{ display:'grid', gap:6 }}>
                  <select style={styles.select} value={deviceId || ""} onChange={(e)=>chooseDeviceForSide(sideKey, e.target.value)}>
                    <option value="">(Choose device…)</option>
                    {devices.map((d, i)=>{
                      const id = d.id || d.key || d._id || String(i);
                      const label = d.title || d.name || d.key || id;
                      return <option key={id} value={id}>{label} — {d.type || d.deviceType || ''}</option>;
                    })}
                  </select>
                  {/* device thumbnail preview */}
                  {deviceId && (()=>{
                    const d = devices.find(x => (x.id||x.key||x._id) === deviceId);
                    if (!d) return null;
                    return (
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <div style={{ width:48, height:48, border:'1px solid #263236', borderRadius:8, overflow:'hidden', display:'grid', placeItems:'center' }}>
                          {d && d.iconKey ? <img src={d.iconUrl || d.icon || ''} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ color:'#9fb0bf' }}>{d.title?.charAt(0) || 'D'}</div>}
                        </div>
                        <div style={{ color:'#9fb0bf' }}>{d.title || d.name || d.key}</div>
                        <div style={{ marginLeft:'auto' }}>
                          <button style={styles.smallButton} onClick={()=>removeDeviceForSide(sideKey)}>Clear</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ color:'#9fb0bf' }}>No devices available. Create a device in the Devices tab first.</div>
              )
            )}
          </div>

          {/* arrows and ordering hint (non-destructive — this component doesn't reorder devices list - that is managed on the Devices tab) */}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Device list actions</div>
            <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
              <button style={styles.smallButton} title="Move selected device up">▲</button>
              <button style={styles.smallButton} title="Move selected device down">▼</button>
            </div>
            <div style={{ fontSize:11, color:'#9fb0bf', marginTop:8 }}>Note: Use the Devices tab to permanently reorder devices.</div>
          </div>
        </div>

        <div
          style={{
            marginTop:12,
            border:`1px solid ${summaryBorder}`,
            borderRadius:10,
            padding:12,
            background: summaryBackground,
          }}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <div style={{ fontWeight:700 }}>{summaryTitle}</div>
            <div style={{ fontSize:12, color:'#9fb0bf' }}>
              Triggered Response: {selectedAction ? selectedAction.label : 'Choose an option'}
            </div>
          </div>

          <div style={{ marginTop:10 }}>
            {selectedMediaUrl ? (
              <div
                style={{
                  border:'1px solid #233236',
                  borderRadius:10,
                  overflow:'hidden',
                  background:'#071018',
                  padding:selectedMediaType==='audio' ? 12 : 0,
                  maxWidth:320,
                  margin:'0 auto',
                }}
              >
                {selectedMediaType === 'image' || selectedMediaType === 'gif' ? (
                  <img
                    src={selectedMediaUrl}
                    alt="selected response"
                    style={{ width:'100%', height:'auto', maxHeight:160, objectFit:'cover' }}
                  />
                ) : selectedMediaType === 'video' ? (
                  <video src={selectedMediaUrl} style={{ width:'100%', maxHeight:180 }} controls muted />
                ) : selectedMediaType === 'audio' ? (
                  <audio src={selectedMediaUrl} controls style={{ width:'100%' }} />
                ) : (
                  <a href={selectedMediaUrl} target="_blank" rel="noreferrer" style={{ color:'#9fb0bf', display:'inline-block', padding:8 }}>{selectedMediaUrl}</a>
                )}
              </div>
            ) : (
              <div style={{ fontSize:12, color:'#9fb0bf' }}>No media assigned yet. Select or upload media below.</div>
            )}
          </div>

          {resolvedActionPreview && (
            <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <div style={{ fontSize:12, color:'#9fb0bf' }}>Selected Action Trigger Preview</div>
              <div style={{ width:80, height:60, borderRadius:10, overflow:'hidden', border:'1px solid #233236', background:'#071018', display:'grid', placeItems:'center' }}>
                <img src={resolvedActionPreview} alt="action trigger preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
            </div>
          )}

          <div style={{ marginTop:12, display:'grid', gap:10 }}>
            <div>
              <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Triggered Response Type</div>
              <select
                style={styles.select}
                value={actionType}
                onChange={(e)=>{
                  const nextType = e.target.value;
                  updateSide(sideKey, {
                    triggerActionType: nextType,
                    triggerActionTarget: '',
                    triggerActionLabel: '',
                    triggerActionThumbnail: '',
                  });
                }}
              >
                <option value="media">Media</option>
                <option value="devices">Devices</option>
                <option value="missions">Missions</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Action Trigger</div>
              <select
                style={styles.select}
                value={actionTarget}
                onChange={(e)=>{
                  const nextId = e.target.value;
                  const opt = actionOptions.find(o => o.id === nextId) || null;
                  updateSide(sideKey, {
                    triggerActionTarget: nextId,
                    triggerActionLabel: opt?.label || '',
                    triggerActionThumbnail: opt?.thumbnail || '',
                  });
                }}
              >
                <option value="">Select Action Trigger (Geo Fence Threshold Crossed)</option>
                {actionOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ fontSize:12, color:'#9fb0bf', marginTop:6 }}>
            Selected Action Trigger: {selectedAction ? selectedAction.label : 'Geo Fence Threshold Crossed'}
          </div>
        </div>

        <hr style={{ border:'1px solid #0f2527', margin:'12px 0' }} />

        {/* Media selector area */}
        <div ref={dropRef} style={{ border:'1px dashed #123033', borderRadius:8, padding:10, background:'#061015' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ fontWeight:600 }}>{title} — Media</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <select style={styles.selectSmall} value={mediaFilter} onChange={(e)=>setMediaFilter(e.target.value)}>
                <option value="auto">Auto (all)</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="gif">GIFs</option>
                <option value="other">Other</option>
              </select>
              <input placeholder="Paste URL to assign…" style={styles.inputSmall} onKeyDown={async (e)=>{
                if (e.key === 'Enter') {
                  const url = e.target.value.trim();
                  if (!url) return;
                  chooseMediaForSide(sideKey, url);
                  e.target.value = "";
                }
              }} />
            </div>
          </div>

          {/* media grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
            {filteredInventory().map((it, idx)=>{
              const url = toDirectMediaURL(it.url || it);
              const isSelected = (url === (mediaUrl || audioUrl));
              return (
                <div key={idx} style={{ border: isSelected ? '2px solid #1aa654' : '1px solid #153033', borderRadius:8, padding:6, background: isSelected ? 'rgba(34,197,94,0.04)' : 'transparent' }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <div style={{ width:56, height:44, borderRadius:6, overflow:'hidden', background:'#071018', display:'grid', placeItems:'center' }}>
                      {(classifyByExt(url) === 'image' || classifyByExt(url) === 'gif') ? <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : (classifyByExt(url) === 'video') ? <video src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted playsInline />
                        : (classifyByExt(url) === 'audio') ? <div style={{ fontSize:12, color:'#9fb0bf' }}>Audio</div>
                        : <div style={{ fontSize:12, color:'#9fb0bf' }}>{(it.label||'file').slice(0,8)}</div>
                      }
                    </div>
                    <div style={{ flex:1, overflow:'hidden' }}>
                      <div style={{ fontWeight:600, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.label || (it.url||it).split('/').pop()}</div>
                      <div style={{ fontSize:12, color:'#9fb0bf' }}>{classifyByExt(url)}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                    <button style={styles.smallButton} onClick={()=>{ setSelectedPreviewUrl(url); }}>Preview</button>
                    <button style={styles.smallButton} onClick={()=>chooseMediaForSide(sideKey, url)}>Choose</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* selected preview */}
          {selectedPreviewUrl && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Preview</div>
              {classifyByExt(selectedPreviewUrl) === 'image' || classifyByExt(selectedPreviewUrl) === 'gif' ? (
                <img src={selectedPreviewUrl} alt="preview" style={{ width:'100%', maxHeight:220, objectFit:'contain', borderRadius:8 }} />
              ) : classifyByExt(selectedPreviewUrl) === 'video' ? (
                <video src={selectedPreviewUrl} controls style={{ width:'100%', maxHeight:260, borderRadius:8 }} />
              ) : classifyByExt(selectedPreviewUrl) === 'audio' ? (
                <audio src={selectedPreviewUrl} controls style={{ width:'100%' }} />
              ) : (
                <a href={selectedPreviewUrl} target="_blank" rel="noreferrer" style={{ color:'#9fb0bf' }}>{selectedPreviewUrl}</a>
              )}
            </div>
          )}

          <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ ...styles.button, display:'inline-grid', placeItems:'center' }}>
              Choose file
              <input type="file" style={{ display:'none' }} onChange={async (e)=>{
                const f = e.target.files?.[0]; if (!f) return;
                const url = await uploadFileAsMedia(f, 'uploads');
                if (url) {
                  // add new inventory item locally (won't reload global pool automatically)
                  chooseMediaForSide(sideKey, url);
                }
              }} />
            </label>

            <div style={{ color:'#9fb0bf', fontSize:12 }}>
              Or drag & drop a file onto this box to upload and assign.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop:12 }}>
      <ResponseEditor sideKey="onCorrect" title="Correct Response" />
      <ResponseEditor sideKey="onWrong" title="Wrong Response" />
    </div>
  );
}

const styles = {
  select: { width: "100%", padding: "8px 10px", borderRadius:8, border: "1px solid #233236", background: "#061217", color: "#e9eef2" },
  selectSmall: { padding: "6px 8px", borderRadius:8, border: "1px solid #233236", background: "#061217", color: "#e9eef2" },
  inputSmall: { padding: "6px 8px", borderRadius:8, border: "1px solid #233236", background: "#061217", color: "#e9eef2", width:240 },
  smallButton: { padding: "6px 8px", borderRadius:8, border: "1px solid #233236", background: "#0d1a1b", color: "#e9eef2", cursor: "pointer" },
  button: { padding: "8px 10px", borderRadius:8, border: "1px solid #233236", background: "#0d1a1b", color: "#e9eef2", cursor: "pointer" }
};
