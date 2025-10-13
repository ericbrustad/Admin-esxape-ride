
import React, { useEffect, useState, useRef } from "react";
import styles from './InlineMissionResponses.module.css';

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

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

function baseNameFromUrl(url) {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://local");
    const file = (u.pathname.split("/").pop() || "").replace(/\.[^.]+$/, "");
    return file.replace(/[-_]+/g, " ").trim();
  } catch {
    const file = (String(url).split("/").pop() || "").replace(/\.[^.]+$/, "");
    return file.replace(/[-_]+/g, " ").trim();
  }
}

export default function InlineMissionResponses({ editing, setEditing, inventory = [] }) {
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [mediaFilter, setMediaFilter] = useState("auto"); // auto / image / video / audio / gif / other
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState("");
  const dropRef = useRef(null);
  const [openPicker, setOpenPicker] = useState('');

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
      const path = `public/media/${subfolder}/${Date.now()}-${safeName}`;
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
    updateSide(side, { enabled: !!on });
    if (!on) setOpenPicker('');
  }


  function ResponseEditor({ sideKey = "onCorrect", title = "On Correct" }) {
    const side = ensureSide(sideKey);
    const enabled = !!side.enabled;
    const deviceId = side.deviceId;
    const mediaUrl = side.mediaUrl;
    const audioUrl = side.audioUrl;

    // device options from devices state
    const hasDevices = devices && devices.length > 0;

    return (
      <div className={styles.responseCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitle}>{title}</div>
          <div className={styles.toggleRow}>
            <label className={styles.toggleLabel} title="When enabled this response will act as a trigger">
              <input type="checkbox" checked={enabled} onChange={(e)=>toggleEngage(sideKey, e.target.checked)} />
              Engage Response
            </label>
          </div>
        </div>

        <div className={classNames(styles.statusBanner, enabled && styles.statusBannerEnabled)}>
          {enabled ? (deviceId ? "Response Device Enabled!" : "Response Enabled — No Devices Selected") : "No Devices Enabled"}
        </div>

        <div className={styles.deviceGrid}>
          <div className={styles.deviceColumn}>
            <div className={styles.label}>Trigger Device</div>
            {loadingDevices ? (
              <div className={styles.helpText}>Loading devices…</div>
            ) : hasDevices ? (
              <div className={styles.deviceColumn}>
                <select className={styles.select} value={deviceId || ""} onChange={(e)=>chooseDeviceForSide(sideKey, e.target.value)}>
                  <option value="">(Choose device…)</option>
                  {devices.map((d, i)=>{
                    const id = d.id || d.key || d._id || String(i);
                    const label = d.title || d.name || d.key || id;
                    return <option key={id} value={id}>{label} — {d.type || d.deviceType || ''}</option>;
                  })}
                </select>
                {deviceId && (()=>{
                  const d = devices.find(x => (x.id||x.key||x._id) === deviceId);
                  if (!d) return null;
                  return (
                    <div className={styles.devicePreviewRow}>
                      <div className={styles.deviceThumbnail}>
                        {d.iconUrl || d.icon ? (
                          <img src={d.iconUrl || d.icon || ''} alt="" />
                        ) : (
                          <span>{(d.title || d.name || 'D').charAt(0)}</span>
                        )}
                      </div>
                      <div>{d.title || d.name || d.key}</div>
                      <button type="button" className={classNames(styles.smallButton, styles.clearButton)} onClick={()=>removeDeviceForSide(sideKey)}>Clear</button>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className={styles.helpText}>No devices available. Create a device in the Devices tab first.</div>
            )}
          </div>
          <div className={styles.deviceActions}>
            <div className={styles.label}>Device list actions</div>
            <div className={styles.deviceActionButtons}>
              <button type="button" className={styles.smallButton} title="Move selected device up">▲</button>
              <button type="button" className={styles.smallButton} title="Move selected device down">▼</button>
            </div>
            <div className={styles.helpText}>Note: Use the Devices tab to permanently reorder devices.</div>
          </div>
        </div>

        <hr className={styles.divider} />

        <div ref={dropRef} className={styles.mediaDrop}>
          <div className={styles.mediaHeader}>
            <div className={styles.headerTitle}>{title} — Media</div>
            <div className={styles.mediaControls}>
              <select className={styles.selectSmall} value={mediaFilter} onChange={(e)=>setMediaFilter(e.target.value)} disabled={!enabled}>
                <option value="auto">Auto (all)</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="gif">GIFs</option>
                <option value="other">Other</option>
              </select>
              <input
                className={styles.inputSmall}
                placeholder="Paste URL to assign…"
                disabled={!enabled}
                onKeyDown={async (e)=>{
                  if (e.key === 'Enter') {
                    const url = e.target.value.trim();
                    if (!url) return;
                    chooseMediaForSide(sideKey, url);
                    e.target.value = "";
                  }
                }}
              />
            </div>
          </div>

          {enabled ? (
            <>
              <div className={styles.mediaBody}>
                <div className={styles.mediaPickerContainer}>
                  <button
                    type="button"
                    className={classNames(styles.button, styles.mediaPickerTrigger)}
                    onClick={()=>setOpenPicker(prev => prev === sideKey ? '' : sideKey)}
                  >
                    <span>{(() => {
                      const selectedUrl = mediaUrl || audioUrl || '';
                      if (!selectedUrl) return 'Select media…';
                      const match = filteredInventory().find(it => toDirectMediaURL(it.url || it.path || it) === selectedUrl);
                      return match?.label || baseNameFromUrl(selectedUrl);
                    })()}</span>
                    <span className={styles.pickerIndicator}>▾</span>
                  </button>
                  {openPicker === sideKey && (
                    <div className={styles.mediaPickerPopover}>
                      {filteredInventory().length === 0 ? (
                        <div className={styles.mediaPickerEmpty}>No media available. Upload a file below.</div>
                      ) : filteredInventory().map((it, idx) => {
                        const raw = it.url || it.path || it;
                        const url = toDirectMediaURL(raw);
                        const kind = classifyByExt(url);
                        return (
                          <div
                            key={idx}
                            className={styles.mediaPickerItem}
                            role="button"
                            tabIndex={0}
                            onClick={()=>{
                              chooseMediaForSide(sideKey, url);
                              setOpenPicker('');
                            }}
                            onKeyDown={(event)=>{
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                chooseMediaForSide(sideKey, url);
                                setOpenPicker('');
                              }
                            }}
                          >
                            <div className={styles.mediaThumb}>
                              {(kind === 'image' || kind === 'gif') && <img src={url} alt="" />}
                              {kind === 'video' && <video src={url} muted playsInline />}
                              {kind === 'audio' && <div>Audio</div>}
                              {kind === 'other' && <div>{(it.label || 'file').slice(0, 8)}</div>}
                            </div>
                            <div>
                              <div className={styles.mediaItemTitle}>{it.label || baseNameFromUrl(url)}</div>
                              <div className={styles.mediaItemMeta}>{kind}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {(mediaUrl || audioUrl) && (
                  <div className={styles.mediaPreview}>
                    {(() => {
                      const current = mediaUrl || audioUrl || '';
                      const kind = classifyByExt(current);
                      if (kind === 'image' || kind === 'gif') return <img src={current} alt="selected" />;
                      if (kind === 'video') return <video src={current} muted playsInline />;
                      if (kind === 'audio') return <div>Audio attached</div>;
                      return <div>{baseNameFromUrl(current)}</div>;
                    })()}
                  </div>
                )}
              </div>

              {selectedPreviewUrl && (
                <div className={styles.previewSection}>
                  <div className={styles.previewTitle}>Preview</div>
                  {(() => {
                    const kind = classifyByExt(selectedPreviewUrl);
                    if (kind === 'image' || kind === 'gif') return <img src={selectedPreviewUrl} alt="preview" className={styles.previewImage} />;
                    if (kind === 'video') return <video src={selectedPreviewUrl} controls className={styles.previewVideo} />;
                    if (kind === 'audio') return <audio src={selectedPreviewUrl} controls className={styles.audioPlayer} />;
                    return <a href={selectedPreviewUrl} target="_blank" rel="noreferrer" className={styles.mediaLink}>{selectedPreviewUrl}</a>;
                  })()}
                </div>
              )}

              <div className={styles.uploadRow}>
                <label className={styles.fileButton}>
                  Choose file
                  <input type="file" className={styles.hiddenInput} onChange={async (e)=>{
                    const f = e.target.files?.[0]; if (!f) return;
                    const url = await uploadFileAsMedia(f, 'uploads');
                    if (url) {
                      chooseMediaForSide(sideKey, url);
                    }
                  }} />
                </label>

                <div className={styles.helpText}>
                  Or drag & drop a file onto this box to upload and assign.
                </div>
              </div>
            </>
          ) : (
            <div className={styles.helpText}>Enable Engage Response to attach media options.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <ResponseEditor sideKey="onCorrect" title="Correct Response" />
      <ResponseEditor sideKey="onWrong" title="Wrong Response" />
    </div>
  );
}
