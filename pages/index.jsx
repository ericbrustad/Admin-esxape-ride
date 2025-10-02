import { useEffect, useMemo, useRef, useState } from 'react';

/** Field schemas per type */
const TYPE_FIELDS = {
  'multiple_choice': [
    { key:'question', label:'Question', type:'text' },
    { key:'choices', label:'Choices (one per line)', type:'multiline' },
    { key:'answer', label:'Correct Answer', type:'text' },
  ],
  'short_answer': [
    { key:'question', label:'Question', type:'text' },
    { key:'answer', label:'Correct Answer', type:'text' },
    { key:'acceptable', label:'Also Accept (comma-separated)', type:'text' },
  ],
  'statement': [{ key:'text', label:'Statement Text', type:'multiline' }],
  'video': [
    { key:'videoUrl', label:'Video URL (https)', type:'text' },
    { key:'overlayText', label:'Overlay Text (optional)', type:'text' },
  ],
  'geofence_image': [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters', label:'Geofence Radius (m)', type:'number', min:5, max:2000 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'imageUrl', label:'Image URL (https)', type:'text' },
    { key:'overlayText', label:'Caption/Text', type:'text' },
  ],
  'geofence_video': [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters', label:'Geofence Radius (m)', type:'number', min:5, max:2000 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'videoUrl', label:'Video URL (https)', type:'text' },
    { key:'overlayText', label:'Overlay Text (optional)', type:'text' },
  ],
  // AR types (now with optional geofence)
  'ar_image': [
    { key:'markerUrl', label:'Marker Image URL (PNG/JPG)', type:'text' },
    { key:'assetUrl',  label:'Overlay Image URL (PNG/JPG)', type:'text' },
    { key:'overlayText', label:'Overlay (optional)', type:'text' },
  ],
  'ar_video': [
    { key:'markerUrl', label:'Marker Image URL (PNG/JPG)', type:'text' },
    { key:'assetUrl',  label:'Overlay Video URL (MP4)', type:'text' },
    { key:'overlayText', label:'Overlay (optional)', type:'text' },
  ],
};

const TYPE_OPTIONS = [
  { value:'multiple_choice', label:'Multiple Choice' },
  { value:'short_answer', label:'Question (Short Answer)' },
  { value:'statement', label:'Statement' },
  { value:'video', label:'Video' },
  { value:'geofence_image', label:'Geo Fence Image' },
  { value:'geofence_video', label:'Geo Fence Video' },
  { value:'ar_image', label:'AR Image' },
  { value:'ar_video', label:'AR Video' },
];

const GAME_TYPES = ['Mystery','Chase','Race','Thriller','Hunt'];
const MODES = [
  { value:'single', label:'Single Player', collect:1 },
  { value:'head2head', label:'Head to Head', collect:2 },
  { value:'multi', label:'Multiple (4 players)', collect:4 },
];

export default function Admin(){
  const [tab, setTab] = useState('missions');
  const [suite, setSuite] = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dirty, setDirty] = useState(false);

  const [smsRule, setSmsRule] = useState({ missionId:'', phoneSlot:1, message:'', delaySec:30 });

  useEffect(()=>{
    (async()=>{
      try{
        const [mres, cres] = await Promise.all([
          fetch('/missions.json', { cache:'no-store' }),
          fetch('/api/config', { cache:'no-store' }),
        ]);
        const m = await mres.json();
        const c = await (cres.ok ? cres.json() : Promise.resolve(defaultConfig()));
        const normalized = {
          ...m,
          missions: (m.missions||[]).map(x=> {
            if (x.type==='quiz') {
              return ({...x, type:'multiple_choice', content:{
                question: x.content?.question||'', choices: x.content?.choices||[], answer: x.content?.answer||''
              }});
            }
            if (x.type==='video') return ({...x, type:'video'});
            // ensure AR defaults exist
            if (x.type==='ar_image' || x.type==='ar_video') {
              return ({
                ...x,
                content: {
                  geofenceEnabled: !!x.content?.geofenceEnabled,
                  lat: x.content?.lat ?? '',
                  lng: x.content?.lng ?? '',
                  radiusMeters: x.content?.radiusMeters ?? 25,
                  cooldownSeconds: x.content?.cooldownSeconds ?? 30,
                  markerUrl: x.content?.markerUrl ?? '',
                  assetUrl: x.content?.assetUrl ?? '',
                  overlayText: x.content?.overlayText ?? ''
                }
              });
            }
            return x;
          })
        };
        setSuite(normalized);
        setConfig({ ...defaultConfig(), ...c });
      } catch(e){
        setStatus('Load failed: '+(e?.message||e));
      }
    })();
  },[]);

  function defaultConfig(){
    return {
      splash: { enabled: true, mode:'single' },
      game: { title: 'Untitled Game', type: 'Mystery' },
      forms: { players: 1 },
      textRules: []
    };
  }

  function saveSuiteToGitHub(){
    return fetch('/api/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ missions: suite }) });
  }
  function saveConfigToGitHub(){
    return fetch('/api/save-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ config }) });
  }
  async function saveAll(){
    setStatus('Saving…');
    const [a,b] = await Promise.all([saveSuiteToGitHub(), saveConfigToGitHub()]);
    const ok = a.ok && b.ok;
    if (!ok) {
      const ta = await a.text(); const tb = await b.text();
      setStatus('❌ Save failed:\n' + ta + '\n' + tb);
    } else {
      setStatus('✅ Saved (Vercel will redeploy)');
    }
  }

  const current = useMemo(()=> suite?.missions?.find(m => m.id === selected) || null, [suite, selected]);
  function suggestId(){
    const base = 'm'; let i = 1;
    const ids = new Set((suite?.missions||[]).map(m=>m.id));
    while(ids.has(String(base + String(i).padStart(2,'0')))) i++;
    return base + String(i).padStart(2,'0');
  }
  function startNew(){
    const draft = {
      id: suggestId(),
      title:'New Mission',
      type:'multiple_choice',
      rewards:{points:25},
      content:{question:'',choices:[],answer:''}
    };
    setEditing(draft); setSelected(null); setDirty(true);
  }
  function editExisting(m){ setEditing(JSON.parse(JSON.stringify(m))); setSelected(m.id); setDirty(false); }
  function cancelEdit(){ setEditing(null); setSelected(null); setDirty(false); }
  function defaultContentForType(t){
    switch(t){
      case 'multiple_choice': return {question:'',choices:[],answer:''};
      case 'short_answer': return {question:'',answer:'',acceptable:''};
      case 'statement': return {text:''};
      case 'video': return {videoUrl:'',overlayText:''};
      case 'geofence_image': return {lat:'',lng:'',radiusMeters:25,cooldownSeconds:30,imageUrl:'',overlayText:''};
      case 'geofence_video': return {lat:'',lng:'',radiusMeters:25,cooldownSeconds:30,videoUrl:'',overlayText:''};
      case 'ar_image': return {
        geofenceEnabled:false, lat:'', lng:'', radiusMeters:25, cooldownSeconds:30,
        markerUrl:'', assetUrl:'', overlayText:''
      };
      case 'ar_video': return {
        geofenceEnabled:false, lat:'', lng:'', radiusMeters:25, cooldownSeconds:30,
        markerUrl:'', assetUrl:'', overlayText:''
      };
      default: return {};
    }
  }
  function saveToList(){
    if (!editing || !suite) return;
    if (!editing.id || !editing.title || !editing.type) return setStatus('❌ Fill id, title, type');

    // basic required fields per type (skip number checks)
    const fields = TYPE_FIELDS[editing.type] || [];
    for (const f of fields){
      if (f.type==='number') continue;
      const v = editing.content?.[f.key];
      if (v===undefined || v===null || v==='') {
        return setStatus('❌ Missing: '+f.label);
      }
    }
    if ((editing.type==='ar_image' || editing.type==='ar_video') && editing.content?.geofenceEnabled) {
      const { lat, lng } = editing.content || {};
      if (lat==='' || lng==='') return setStatus('❌ Geofence is ON — pick a map location first');
    }

    const missions = [...(suite.missions||[])];
    const i = missions.findIndex(m=>m.id===editing.id);
    if (i>=0) missions[i]=editing; else missions.push(editing);
    setSuite({...suite, missions, version: bumpVersion(suite.version||'0.0.0')});
    setSelected(editing.id); setEditing(null); setDirty(false);
    setStatus('✅ List updated (remember Save All)');
  }
  function removeMission(id){
    if (!suite) return;
    setSuite({...suite, missions:(suite.missions||[]).filter(m=>m.id!==id)});
    if (selected===id) { setSelected(null); setEditing(null); }
  }
  function bumpVersion(v){ const p = String(v||'0.0.0').split('.').map(n=>parseInt(n||'0',10)); while(p.length<3) p.push(0); p[2]+=1; return p.join('.'); }

  // ----- SMS rules -----
  function addSmsRule(){
    if (!smsRule.missionId || !smsRule.message) { setStatus('❌ Pick mission and message'); return; }
    const maxPlayers = config?.forms?.players || 1;
    if (smsRule.phoneSlot < 1 || smsRule.phoneSlot > Math.max(1, maxPlayers)) return setStatus('❌ Phone slot out of range');
    const rules = [...(config?.textRules||[]), {...smsRule, delaySec: Number(smsRule.delaySec||0)}];
    setConfig({...config, textRules: rules});
    setSmsRule({ missionId:'', phoneSlot:1, message:'', delaySec:30 });
    setStatus('✅ SMS rule added (remember Save All)');
  }
  function removeSmsRule(idx){
    const rules = [...(config?.textRules||[])];
    rules.splice(idx,1);
    setConfig({...config, textRules: rules});
  }

  if (!suite || !config) return (<main style={S.wrap}><div style={S.card}>Loading…</div></main>);

  return (
    <div style={S.body}>
      <header style={S.header}>
        <div style={S.wrap}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {['settings','missions','text','security'].map(t => (
              <button key={t} onClick={()=>setTab(t)} style={{...S.tab, ...(tab===t?S.tabActive:{})}}>{t.toUpperCase()}</button>
            ))}
            <button onClick={saveAll} style={{...S.button, marginLeft:'auto'}}>💾 Save All</button>
            <a href="/missions.json" target="_blank" rel="noreferrer" style={{...S.button}}>View missions.json</a>
            <a href="/config.json" target="_blank" rel="noreferrer" style={{...S.button}}>View config.json</a>
          </div>
          <div style={{color:'#9fb0bf',marginTop:6,whiteSpace:'pre-wrap'}}>{status}</div>
        </div>
      </header>

      {tab==='missions' && (
        <main style={S.wrapGrid}>
          <aside style={S.sidebar}>
            <input placeholder="Search…" onChange={(e)=>{
              const q=e.target.value.toLowerCase();
              document.querySelectorAll('[data-m-title]').forEach(it=>{
                const t=(it.getAttribute('data-m-title')||'').toLowerCase();
                it.style.display = t.includes(q) ? '' : 'none';
              });
            }} style={S.search}/>
            <div>
              {(suite.missions||[]).map(m=> (
                <div key={m.id} data-m-title={(m.title||'')+' '+m.id+' '+m.type} style={S.missionItem}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <div onClick={()=>editExisting(m)} style={{cursor:'pointer'}}>
                      <div style={{fontWeight:600}}>{m.title||m.id}</div>
                      <div style={{color:'#9fb0bf',fontSize:12}}>{m.type} — id: {m.id}</div>
                    </div>
                    <button style={{...S.button, padding:'6px 10px'}} onClick={()=>removeMission(m.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
          <section style={S.editor}>
            {!editing ? (
              <div style={S.card}>
                <p style={{marginTop:0,color:'#9fb0bf'}}>Select a mission or click <em>New Mission</em>.</p>
                <button style={S.button} onClick={startNew}>+ New Mission</button>
                <p style={{color:'#9fb0bf'}}>Version: <code>{suite.version||'0.0.0'}</code> • Total: <code>{suite.missions?.length||0}</code></p>
              </div>
            ) : (
              <div style={S.card}>
                <Field label="ID"><input style={S.input} value={editing.id} onChange={e=>{ setEditing({...editing, id:e.target.value}); setDirty(true); }}/></Field>
                <Field label="Title"><input style={S.input} value={editing.title} onChange={e=>{ setEditing({...editing, title:e.target.value}); setDirty(true); }}/></Field>
                <Field label="Type">
                  <select style={S.input} value={editing.type} onChange={e=>{
                    const t=e.target.value; setEditing({...editing, type:t, content: defaultContentForType(t)}); setDirty(true);
                  }}>{TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                </Field>
                <hr style={S.hr}/>

                {/* AR: geofence toggle + map (optional) */}
                {(editing.type==='ar_image' || editing.type==='ar_video') && (
                  <div style={{marginBottom:12}}>
                    <label style={{display:'flex',alignItems:'center',gap:8, marginBottom:8}}>
                      <input
                        type="checkbox"
                        checked={!!editing.content?.geofenceEnabled}
                        onChange={(e)=>{
                          setEditing({...editing, content:{...editing.content, geofenceEnabled: e.target.checked}});
                          setDirty(true);
                        }}
                      />
                      Enable Geofence for this AR mission
                    </label>

                    {!!editing.content?.geofenceEnabled && (
                      <div>
                        <div style={{fontSize:12,color:'#9fb0bf',marginBottom:6}}>Pick location & radius</div>
                        <MapPicker
                          lat={editing.content?.lat}
                          lng={editing.content?.lng}
                          radius={editing.content?.radiusMeters ?? 25}
                          onChange={(lat,lng,rad)=>{
                            setEditing({...editing, content:{...editing.content, lat, lng, radiusMeters: rad}});
                            setDirty(true);
                          }}
                        />
                        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8}}>
                          <Field label="Cooldown (sec)">
                            <input
                              type="number" min={0} max={3600} style={S.input}
                              value={editing.content?.cooldownSeconds ?? 30}
                              onChange={e=>{
                                const v = e.target.value===''?30:Number(e.target.value);
                                setEditing({...editing, content:{...editing.content, cooldownSeconds: v}});
                                setDirty(true);
                              }}
                            />
                          </Field>
                          <div />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Geofence map picker (standard) */}
                {(editing.type==='geofence_image' || editing.type==='geofence_video') && (
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:'#9fb0bf',marginBottom:6}}>Pick location & radius</div>
                    <MapPicker
                      lat={editing.content?.lat}
                      lng={editing.content?.lng}
                      radius={editing.content?.radiusMeters ?? 25}
                      onChange={(lat,lng,rad)=>{
                        setEditing({...editing, content:{...editing.content, lat, lng, radiusMeters: rad}});
                        setDirty(true);
                      }}
                    />
                  </div>
                )}

                {(TYPE_FIELDS[editing.type]||[]).map(f => (
                  <Field key={f.key} label={f.label}>
                    {f.type==='text' && (
                      <div>
                        <input
                          style={S.input}
                          value={editing.content?.[f.key]||''}
                          onChange={e=>{ setEditing({...editing, content:{...editing.content,[f.key]:e.target.value}}); setDirty(true); }}
                        />
                        {/* Previews for AR / media fields */}
                        {isUrlKeyNeedingPreview(editing.type, f.key, editing.content?.[f.key])}
                      </div>
                    )}
                    {f.type==='number' && (
                      <input
                        type="number" min={f.min} max={f.max} style={S.input}
                        value={editing.content?.[f.key]??''}
                        onChange={e=>{
                          const v=e.target.value===''? '': Number(e.target.value);
                          setEditing({...editing, content:{...editing.content,[f.key]:v}}); setDirty(true);
                        }}
                      />
                    )}
                    {f.type==='multiline' && (
                      <textarea
                        style={{...S.input, height:120, fontFamily:'ui-monospace, Menlo'}}
                        value={ f.key==='choices'
                          ? (editing.content?.choices||[]).join('\n')
                          : (editing.content?.[f.key]||'')
                        }
                        onChange={e=>{
                          if (f.key==='choices'){
                            const lines=e.target.value.split('\n').map(s=>s.trim()).filter(Boolean);
                            setEditing({...editing, content:{...editing.content, choices: lines}});
                          } else {
                            setEditing({...editing, content:{...editing.content, [f.key]: e.target.value}});
                          }
                          setDirty(true);
                        }}
                      />
                    )}
                  </Field>
                ))}

                <Field label="Points (Reward)">
                  <input
                    type="number" style={S.input}
                    value={editing.rewards?.points??0}
                    onChange={e=>{
                      const v=e.target.value===''?0:Number(e.target.value);
                      setEditing({...editing, rewards:{...(editing.rewards||{}), points:v}}); setDirty(true);
                    }}
                  />
                </Field>

                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button style={S.button} onClick={saveToList}>Add/Update in List</button>
                  <button style={S.button} onClick={cancelEdit}>Cancel</button>
                </div>
                {dirty && <div style={{marginTop:6,color:'#ffd166'}}>Unsaved changes…</div>}
              </div>
            )}
          </section>
        </main>
      )}

      {tab==='settings' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{marginTop:0}}>Game Settings</h3>
            <Field label="Game Title">
              <input style={S.input} value={config.game.title} onChange={e=>setConfig({...config, game:{...config.game, title:e.target.value}})} />
            </Field>
            <Field label="Game Type">
              <select style={S.input} value={config.game.type} onChange={e=>setConfig({...config, game:{...config.game, type:e.target.value}})}>
                {['Mystery','Chase','Race','Thriller','Hunt'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Stripe Splash Page">
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <label style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="checkbox" checked={config.splash.enabled} onChange={e=>setConfig({...config, splash:{...config.splash, enabled:e.target.checked}})} />
                  Enable Splash (game code & Stripe)
                </label>
              </div>
            </Field>
            <Field label="Mode (affects how many players to collect on splash)">
              <select style={S.input} value={config.splash.mode} onChange={e=>{
                const mode = e.target.value;
                const collect = (mode==='single')?1:(mode==='head2head')?2:4;
                setConfig({...config, splash:{...config.splash, mode}, forms:{...config.forms, players: collect}});
              }}>
                {[
                  { value:'single', label:'Single Player' },
                  { value:'head2head', label:'Head to Head' },
                  { value:'multi', label:'Multiple (4 players)' }
                ].map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <div style={{color:'#9fb0bf'}}>Splash should render {config.forms.players} player info blocks (first name, email, phone).</div>
          </div>
        </main>
      )}

      {tab==='text' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{marginTop:0}}>Text Message Rules</h3>
            <div style={{display:'grid',gap:12, gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
              <Field label="Mission (geofence)">
                <select style={S.input} value={smsRule.missionId} onChange={e=>setSmsRule({...smsRule, missionId:e.target.value})}>
                  <option value="">— choose —</option>
                  {(suite.missions||[]).map(m => <option key={m.id} value={m.id}>{m.id} — {m.title}</option>)}
                </select>
              </Field>
              <Field label="Phone slot">
                <select style={S.input} value={smsRule.phoneSlot} onChange={e=>setSmsRule({...smsRule, phoneSlot:Number(e.target.value)})}>
                  {[1,2,3,4].map(n => <option key={n} value={n}>{'Player '+n}</option>)}
                </select>
              </Field>
              <Field label="Delay (sec)"><input type="number" min={0} max={3600} style={S.input} value={smsRule.delaySec} onChange={e=>setSmsRule({...smsRule, delaySec:e.target.value})}/></Field>
              <Field label="Message"><input style={S.input} value={smsRule.message} onChange={e=>setSmsRule({...smsRule, message:e.target.value})}/></Field>
            </div>
            <div style={{marginTop:12}}><button style={S.button} onClick={addSmsRule}>+ Add Rule</button></div>
            <hr style={S.hr}/>
            <ul style={{paddingLeft:18}}>
              {(config.textRules||[]).map((r,i) => (
                <li key={i} style={{marginBottom:8}}>
                  <code>{r.missionId}</code> → Player {r.phoneSlot} • delay {r.delaySec}s • “{r.message}”
                  <button style={{...S.button, marginLeft:8, padding:'6px 10px'}} onClick={()=>removeSmsRule(i)}>Remove</button>
                </li>
              ))}
            </ul>
            <p style={{color:'#9fb0bf'}}>Note: Your game should trigger SMS when the mission/geofence completes.</p>
            <details style={{marginTop:8}}>
              <summary style={{cursor:'pointer'}}>Send a quick test SMS now</summary>
              <TestSMS/>
            </details>
          </div>
        </main>
      )}

      {tab==='security' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{marginTop:0}}>Admin Credentials</h3>
            <p style={{color:'#9fb0bf'}}>Change the Basic Auth login used for this admin. Requires current password.</p>
            <ChangeAuth />
            <hr style={S.hr}/>
            <h3>Twilio Credentials</h3>
            <p style={{color:'#ffd166'}}>Store <b>Twilio</b> and <b>Vercel</b> credentials only as environment variables. Never in code.</p>
            <ul>
              <li><code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> (or API Key SID/SECRET)</li>
              <li><code>TWILIO_FROM</code> (phone or Messaging Service SID)</li>
            </ul>
          </div>
        </main>
      )}
    </div>
  );
}

function Field({label, children}){ return (<div style={{marginBottom:12}}><div style={{fontSize:12,color:'#9fb0bf',marginBottom:6}}>{label}</div>{children}</div>); }

/** Decide if we should show an image/video preview for a given key */
function isUrlKeyNeedingPreview(type, key, val){
  if (!val || typeof val !== 'string') return null;
  const t = String(type||'');
  if (key==='markerUrl' || key==='assetUrl' || key==='imageUrl' || key==='videoUrl') {
    if (isLikelyVideo(val)) return <VideoPreview url={val} />;
    if (isLikelyImage(val)) return <ImagePreview url={val} />;
  }
  return null;
}

/** Heuristics */
function isLikelyImage(url){ return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url) || url.includes('drive.google.com') || url.includes('dropbox.com'); }
function isLikelyVideo(url){ return /\.(mp4|webm|mov)(\?.*)?$/i.test(url) || url.includes('dropbox.com'); }

/** Convert common share links (Drive/Dropbox) to direct URLs */
function toEmbedFileUrl(url) {
  try {
    const u = new URL(url);

    // Google Drive
    if (u.hostname.includes('drive.google.com')) {
      // try to extract id
      let id = u.searchParams.get('id');
      if (!id) {
        const m = url.match(/\/file\/d\/([^/]+)\//);
        if (m) id = m[1];
      }
      if (id) {
        // For images, thumbnail is quick and returns an actual image
        // For video: Drive isn't great for direct streaming cross-origin; fall back to open original
        return {
          image: `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
          file:  `https://drive.google.com/uc?export=download&id=${id}`
        };
      }
    }

    // Dropbox
    if (u.hostname.includes('dropbox.com')) {
      // https://www.dropbox.com/s/<id>/<name>?dl=0  ->  https://dl.dropboxusercontent.com/s/<id>/<name>?raw=1
      const direct = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/(\?|&)dl=0/, '$1raw=1');
      return { image: direct, file: direct };
    }

    return { image: url, file: url };
  } catch {
    return { image: url, file: url };
  }
}

/** Image preview (Drive/Dropbox friendly) */
function ImagePreview({ url }) {
  const [error, setError] = useState(false);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const { image } = toEmbedFileUrl(url);
  return (
    <div style={{ marginTop: 8 }}>
      {!error && (
        <img
          src={image}
          alt="preview"
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
          loading="lazy"
          style={{ display:'block', maxWidth:'100%', maxHeight:220, borderRadius:10, border:'1px solid #2a323b' }}
        />
      )}
      {error && <div style={{ color:'#ffd166', fontSize:12 }}>Could not load thumbnail. The link may not be public.</div>}
      <a href={url} target="_blank" rel="noreferrer" style={{ ...S.button, display:'inline-block', marginTop:6 }}>
        Open original
      </a>
    </div>
  );
}

/** Video preview (Dropbox-friendly). For Drive, show link only */
function VideoPreview({ url }) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const { file } = toEmbedFileUrl(url);
  const canInline = /dl\.dropboxusercontent\.com/.test(file) || /\.(mp4|webm|mov)(\?.*)?$/i.test(file);
  return (
    <div style={{ marginTop: 8 }}>
      {canInline ? (
        <video
          src={file}
          controls
          playsInline
          muted
          style={{ display:'block', maxWidth:'100%', maxHeight:240, borderRadius:10, border:'1px solid #2a323b' }}
        />
      ) : (
        <div style={{ color:'#9fb0bf', fontSize:12, marginBottom:6 }}>
          Inline preview not available. Open the original link.
        </div>
      )}
      <a href={url} target="_blank" rel="noreferrer" style={{ ...S.button, display:'inline-block', marginTop:6 }}>
        Open original
      </a>
    </div>
  );
}

/** Leaflet Map Picker (CDN) + Address search (Nominatim) + Use my location */
function MapPicker({ lat, lng, radius, onChange }){
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [r, setR] = useState(radius || 25);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const defaultPos = [lat||44.9778, lng||-93.2650];

  // Load Leaflet
  useEffect(()=>{
    if (typeof window !== 'undefined' && window.L) { setReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = ()=> setReady(true);
    document.body.appendChild(s);
  },[]);

  useEffect(()=>{
    if (!ready || !divRef.current) return;
    const L = window.L;
    if (!mapRef.current) {
      mapRef.current = L.map(divRef.current).setView(defaultPos, (lat&&lng)?16:12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(mapRef.current);

      markerRef.current = L.marker(defaultPos, { draggable:true }).addTo(mapRef.current);
      circleRef.current = L.circle(markerRef.current.getLatLng(), { radius: r||25, color:'#33a8ff' }).addTo(mapRef.current);

      const sync = ()=>{
        const p = markerRef.current.getLatLng();
        circleRef.current.setLatLng(p);
        circleRef.current.setRadius(Number(r||25));
        onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), Number(r||25));
      };
      markerRef.current.on('dragend', sync);
      mapRef.current.on('click', (e)=>{ markerRef.current.setLatLng(e.latlng); sync(); });
      sync();
    } else {
      const p = defaultPos;
      markerRef.current.setLatLng(p);
      circleRef.current.setLatLng(p);
      circleRef.current.setRadius(Number(r||25));
    }
  }, [ready]);

  useEffect(()=>{
    if (circleRef.current && markerRef.current) {
      circleRef.current.setRadius(Number(r||25));
      const p = markerRef.current.getLatLng();
      onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), Number(r||25));
    }
  }, [r]);

  async function doSearch(e){
    e?.preventDefault();
    if (!q.trim()) return;
    setSearching(true); setResults([]);
    try{
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      setResults(Array.isArray(data)?data:[]);
    }catch(err){
      setResults([]);
    }finally{
      setSearching(false);
    }
  }

  function gotoResult(r){
    if (!mapRef.current || !markerRef.current) return;
    const lat = Number(r.lat), lon = Number(r.lon);
    const p = [lat, lon];
    markerRef.current.setLatLng(p);
    circleRef.current.setLatLng(p);
    mapRef.current.setView(p, 16);
    onChange(Number(lat.toFixed(6)), Number(lon.toFixed(6)), Number(r||25));
    setResults([]);
  }

  function useMyLocation(){
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      gotoResult({ lat, lon });
    });
  }

  return (
    <div>
      <form onSubmit={doSearch} style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, marginBottom:8}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search address or place…" style={S.input} />
        <button type="button" onClick={useMyLocation} style={S.button}>📍 Use my location</button>
        <button disabled={searching} type="submit" style={S.button}>{searching?'Searching…':'Search'}</button>
      </form>
      {results.length>0 && (
        <div style={{background:'#0b0c10', border:'1px solid #2a323b', borderRadius:10, padding:8, marginBottom:8, maxHeight:160, overflow:'auto'}}>
          {results.map((r,i)=>(
            <div key={i} onClick={()=>gotoResult(r)} style={{padding:'6px 8px', cursor:'pointer', borderBottom:'1px solid #1f262d'}}>
              <div style={{fontWeight:600}}>{r.display_name}</div>
              <div style={{color:'#9fb0bf', fontSize:12}}>lat {Number(r.lat).toFixed(6)}, lng {Number(r.lon).toFixed(6)}</div>
            </div>
          ))}
        </div>
      )}
      <div ref={divRef} style={{ width:'100%', height: 320, borderRadius: 12, overflow:'hidden', border:'1px solid #2a323b', marginBottom:8 }} />
      <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center'}}>
        <input type="range" min={5} max={2000} step={5} value={r} onChange={e=>setR(Number(e.target.value))} />
        <code style={{color:'#9fb0bf'}}>{r} m</code>
      </div>
    </div>
  );
}

function TestSMS(){
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('Test message from admin');
  const [status, setStatus] = useState('');
  async function send(){
    setStatus('Sending…');
    const res = await fetch('/api/sms', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to, body: msg })});
    const text = await res.text();
    setStatus(res.ok ? '✅ Sent' : '❌ '+text);
  }
  return (
    <div style={{marginTop:8}}>
      <div style={{display:'grid',gap:8,gridTemplateColumns:'1fr 2fr auto',alignItems:'center'}}>
        <input placeholder="+1..." style={S.input} value={to} onChange={e=>setTo(e.target.value)} />
        <input placeholder="Message" style={S.input} value={msg} onChange={e=>setMsg(e.target.value)} />
        <button style={S.button} onClick={send}>Send Test</button>
      </div>
      <div style={{marginTop:6,color:'#9fb0bf'}}>{status}</div>
    </div>
  );
}

function ChangeAuth(){
  const [curUser, setCurUser] = useState('');
  const [curPass, setCurPass] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [status, setStatus] = useState('');
  async function submit(){
    setStatus('Updating…');
    const res = await fetch('/api/change-auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ curUser, curPass, newUser, newPass }) });
    const t = await res.text();
    setStatus(res.ok ? '✅ Updated. Redeploying… refresh soon.' : '❌ '+t);
  }
  return (
    <div style={{display:'grid',gap:8,gridTemplateColumns:'1fr 1fr'}}>
      <div>
        <Field label="Current Username"><input style={S.input} value={curUser} onChange={e=>setCurUser(e.target.value)} /></Field>
        <Field label="Current Password"><input type="password" style={S.input} value={curPass} onChange={e=>setCurPass(e.target.value)} /></Field>
      </div>
      <div>
        <Field label="New Username"><input style={S.input} value={newUser} onChange={e=>setNewUser(e.target.value)} /></Field>
        <Field label="New Password"><input type="password" style={S.input} value={newPass} onChange={e=>setNewPass(e.target.value)} /></Field>
      </div>
      <div style={{gridColumn:'1 / -1'}}>
        <button style={S.button} onClick={submit}>Change Credentials</button>
        <div style={{color:'#9fb0bf',marginTop:6}}>{status}</div>
      </div>
    </div>
  );
}

const S = {
  body:{background:'#0b0c10',color:'#e9eef2',minHeight:'100vh',fontFamily:'system-ui, Arial, sans-serif'},
  header:{padding:16,background:'#11161a',borderBottom:'1px solid #1d2329'},
  wrap:{maxWidth:1100,margin:'0 auto',padding:16},
  wrapGrid:{display:'grid',gridTemplateColumns:'320px 1fr',gap:16,alignItems:'start',maxWidth:1200,margin:'0 auto',padding:16},
  sidebar:{background:'#12181d',border:'1px solid #1f262d',borderRadius:14,padding:12,position:'sticky',top:12,height:'calc(100vh - 120px)',overflow:'auto'},
  editor:{minHeight:'60vh'},
  card:{background:'#12181d',border:'1px solid #1f262d',borderRadius:14,padding:16},
  missionItem:{borderBottom:'1px solid #1f262d',padding:'10px 4px'},
  input:{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #2a323b',background:'#0b0c10',color:'#e9eef2'},
  button:{padding:'10px 14px',borderRadius:10,border:'1px solid #2a323b',background:'#1a2027',color:'#e9eef2',cursor:'pointer'},
  tab:{padding:'8px 12px',borderRadius:10,border:'1px solid #2a323b',background:'#0f1418',color:'#e9eef2',cursor:'pointer'},
  tabActive:{background:'#1a2027'},
  search:{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #2a323b',background:'#0b0c10',color:'#e9eef2',marginBottom:10},
  hr:{border:'1px solid #1f262d',borderBottom:'none'}
};
