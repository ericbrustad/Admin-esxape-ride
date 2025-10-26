import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { BackpackButton, SettingsButton } from "../components/ui/CornerButtons";
import { BackpackPanel, SettingsPanel } from "../components/ui/Panels";
const GameMap = dynamic(()=>import("../components/GameMap"),{ ssr:false });

export default function Home(){
  const router=useRouter();
  const gameParam = typeof router.query?.game==="string" ? router.query.game : undefined;
  const [ping,setPing]=useState(null);
  const [storage,setStorage]=useState(null);
  const [error,setError]=useState(null);
  const defaultBucket = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || process.env.SUPABASE_MEDIA_BUCKET || "game-media";
  const defaultPrefix = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_PREFIX || process.env.SUPABASE_MEDIA_PREFIX || "";

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const r=await fetch("/api/ping");
        const d=await r.json();
        if(!cancelled) setPing(d);
      }catch(e){
        if(!cancelled) setError(e);
      }
      try{
        const r2=await fetch(`/api/list-storage?bucket=${encodeURIComponent(defaultBucket)}&prefix=${encodeURIComponent(defaultPrefix)}`);
        const d2=await r2.json();
        if(!cancelled) setStorage(d2);
      }catch(e){
        if(!cancelled) setError(e);
      }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  const ok = ping?.ok !== false && storage?.ok !== false;
  const gameId = useMemo(()=> gameParam || "demo", [gameParam]);
  const [openBackpack, setOpenBackpack] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

  return (
    <div style={{fontFamily:"system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif"}}>
      {ok && <GameMap />}
      <BackpackButton onClick={()=>setOpenBackpack(true)} />
      <SettingsButton onClick={()=>setOpenSettings(true)} />
      <BackpackPanel open={openBackpack} onClose={()=>setOpenBackpack(false)} />
      <SettingsPanel open={openSettings} onClose={()=>setOpenSettings(false)} />

      <div style={{position:"relative",zIndex:1,background:"rgba(255,255,255,0.92)",padding:"24px",maxWidth:980,margin:"0 auto"}}>
        <h1 style={{margin:"0 0 6px"}}>Esxape Ride – Game Loader</h1>
        <p style={{margin:"0 0 16px",opacity:0.8}}>This page prevents the all-black screen and surfaces errors.</p>
        <section style={{border:"1px solid #ddd",borderRadius:12,padding:16,marginBottom:16}}>
          <h3 style={{margin:"0 0 8px"}}>Status</h3>
          <ul style={{margin:"0 0 8px",paddingLeft:18,lineHeight:1.7}}>
            <li>Game param: <code>?game={gameId}</code></li>
            <li>Health check: {ping ? (ping.ok!==false ? "OK" : "Error") : "…"}</li>
            <li>Storage list: {storage ? (storage.ok ? `${storage.files?.length ?? 0} items` : "Error") : "…"}</li>
          </ul>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <a href="/api/ping" style={{textDecoration:"underline"}}>Open /api/ping</a>
            <a href={`/api/list-storage?bucket=${encodeURIComponent(defaultBucket)}&prefix=${encodeURIComponent(defaultPrefix)}`} style={{textDecoration:"underline"}}>Open /api/list-storage</a>
          </div>
        </section>
        {error && (
          <section style={{border:"1px solid #f5c2c7",background:"#fff5f5",color:"#842029",borderRadius:12,padding:16,marginBottom:16}}>
            <strong>Captured error:</strong>
            <pre style={{whiteSpace:"pre-wrap",marginTop:8}}>{String(error?.message || error)}</pre>
          </section>
        )}
        <section style={{border:"1px dashed #bbb",borderRadius:12,padding:16}}>
          <h3 style={{margin:"0 0 8px"}}>Next steps</h3>
          <ol style={{margin:"0 0 0 20px",lineHeight:1.7}}>
            <li>Ensure Vercel env vars exist in <em>Preview</em> and <em>Production</em>:
              <ul style={{margin:"6px 0 0 18px"}}>
                <li><code>SUPABASE_URL</code> (or <code>NEXT_PUBLIC_SUPABASE_URL</code>)</li>
                <li><code>SUPABASE_ANON_KEY</code> (or <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>)</li>
                <li><code>SUPABASE_SERVICE_ROLE_KEY</code> <em>(Server-only)</em></li>
                <li><code>SUPABASE_MEDIA_BUCKET</code> (default <code>game-media</code>)</li>
                <li><code>SUPABASE_MEDIA_PREFIX</code> (default <em>(blank)</em>)</li>
                <li><code>NEXT_PUBLIC_MAPBOX_TOKEN</code></li>
              </ul>
            </li>
            <li>Reload this page: diagnostics should read “OK”.</li>
            <li>When healthy, replace the demo overlays with your missions/devices data.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
