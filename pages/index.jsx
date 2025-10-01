import { useEffect, useState } from 'react';
export default function Home(){
  const [suite,setSuite]=useState(null); const [idx,setIdx]=useState(0); const [error,setError]=useState(null);
  useEffect(()=>{(async()=>{try{const r=await fetch('/missions.json',{cache:'no-store'});if(!r.ok) throw new Error('HTTP '+r.status);const s=await r.json();setSuite(s);if(s.flow?.start){const i=s.missions.findIndex(m=>m.id===s.flow.start);if(i>=0) setIdx(i);}}catch(e){setError(String(e?.message||e));}})();},[]);
  if(error) return (<main style={S.wrap}><div style={S.card}><p style={S.warn}>Failed to load missions.json: {error}</p></div></main>);
  if(!suite) return (<main style={S.wrap}><div style={S.card}>Loading…</div></main>);
  const m=suite.missions[idx]; const next=()=>setIdx(i=>Math.min(i+1,suite.missions.length));
  return (<div style={S.body}>
    <header style={S.header}><div style={S.wrap}><strong>Esxaperide Admin · Missions</strong><span style={S.muted}> — Loaded {suite.id}@{suite.version} — {suite.missions.length} mission(s)</span></div></header>
    <main style={S.wrap}><div style={S.card}>{!m?<p>All missions completed 🎉</p>:m.type==='quiz'?<Quiz mission={m} onDone={next}/>:m.type==='video'?<Video mission={m} onDone={next}/>:<p>Unknown mission type.</p>}</div></main>
  </div>);
}
function Quiz({mission,onDone}){const {question,choices=[],answer}=mission.content||{}; const [msg,setMsg]=useState(null);
  return (<div><h3>{mission.title} <span style={S.muted}>(quiz)</span></h3><p>{question||''}</p>
  <div style={S.choices}>{choices.map(c=>(<button key={c} style={S.button} onClick={()=>{const ok=String(c)===String(answer); setMsg({text:ok?'Correct ✅':'Try again ❌',ok}); if(ok) setTimeout(onDone,600);}}>{c}</button>))}</div>
  <div style={{...S.muted,color:msg?(msg.ok?'#7CFC00':'#ffd166'):'#9fb0bf',marginTop:10}}>{msg?.text||''}</div></div>);
}
function Video({mission,onDone}){const {videoUrl}=mission.content||{};
  return (<div><h3>{mission.title} <span style={S.muted}>(video)</span></h3><video src={videoUrl||''} controls playsInline style={{width:'100%',borderRadius:10,marginTop:8}}/>
  <div style={{marginTop:12}}><button style={S.button} onClick={onDone}>Mark Complete</button></div></div>);
}
const S={body:{background:'#0b0c10',color:'#e9eef2',minHeight:'100vh',fontFamily:'system-ui, Arial, sans-serif'},header:{padding:16,background:'#11161a',borderBottom:'1px solid #1d2329'},wrap:{maxWidth:900,margin:'0 auto',padding:16},card:{background:'#12181d',border:'1px solid #1f262d',borderRadius:14,padding:16},muted:{color:'#9fb0bf',fontWeight:400},choices:{display:'grid',gap:10,gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',marginTop:12},button:{padding:'10px 14px',borderRadius:10,border:'1px solid #2a323b',background:'#1a2027',color:'#e9eef2',cursor:'pointer'},warn:{color:'#ffd166'}};
