import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { BackpackButton, SettingsButton } from "./ui/CornerButtons";
import { BackpackPanel, SettingsPanel } from "./ui/Panels";
import { on, Events, emit } from "../lib/eventBus";

const GameMap = dynamic(() => import("./GameMap"), { ssr: false });

export default function GameRuntime(){
  const router = useRouter();
  const gameId = useMemo(() => (typeof router.query?.game === "string" ? router.query.game : "demo"), [router.query?.game]);
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openBackpack, setOpenBackpack] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [answers, setAnswers] = useState({});
  const [complete, setComplete] = useState(false);

  // Load mission bundle (if present)
  useEffect(()=>{
    let cancelled = false;
    (async ()=>{
      setLoading(true); setError(null);
      try {
        const r = await fetch(`/api/game-load?game=${encodeURIComponent(gameId)}`);
        const j = await r.json();
        if (cancelled) return;
        if (j.ok && j.bundle) {
          const ov = Array.isArray(j.bundle.overlays) ? j.bundle.overlays : [];
          setOverlays(ov);
          const initial = {};
          if (Array.isArray(j.bundle.prompts)) {
            for (const p of j.bundle.prompts) initial[p.id] = null;
          }
          setAnswers(initial);
          setError(null);
        } else {
          setOverlays([]);
          setAnswers({});
          setError(j?.error || "No mission bundle found");
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gameId]);

  // Minimal answer capture: if an overlay contains { prompt: { id, question, correct } }, ask on GEO_ENTER
  useEffect(()=>{
    const offEnter = on(Events.GEO_ENTER, ({ feature })=>{
      const prompt = feature?.prompt;
      if (!prompt?.id || !prompt?.question) return;
      if (answers[prompt.id] != null) return;
      const a = window.prompt(prompt.question) ?? "";
      setAnswers((prev)=> ({ ...prev, [prompt.id]: a }));
      if (prompt.correct != null && String(a).trim().toLowerCase() === String(prompt.correct).trim().toLowerCase()) {
        emit(Events.GEO_ENTER, { feature: { id:`answer-${prompt.id}`, type:"text", coordinates: feature.coordinates, radius: 10, text:`Answered: ${prompt.id}` }});
      }
    });
    return () => offEnter();
  }, [answers]);

  useEffect(()=>{
    const ids = Object.keys(answers);
    if (ids.length === 0) return;
    const allAnswered = ids.every((k)=> answers[k] != null);
    setComplete(allAnswered);
  }, [answers]);

  return (
    <div style={{ fontFamily:"system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif" }}>
      <GameMap overlays={overlays} />

      <BackpackButton onClick={()=>setOpenBackpack(true)} />
      <SettingsButton onClick={()=>setOpenSettings(true)} />
      <BackpackPanel open={openBackpack} onClose={()=>setOpenBackpack(false)} />
      <SettingsPanel open={openSettings} onClose={()=>setOpenSettings(false)} />

      <div style={{ position:"fixed", right:12, bottom:12, zIndex:25 }}>
        {loading && <div style={pill()}>Loading mission…</div>}
        {error && <div style={{...pill(), background:"#ffe9e9", color:"#821", border:"1px solid #f5c2c7"}}>Load error: {String(error)}</div>}
        {complete && <div style={{...pill(), background:"#e9ffe9", color:"#064", border:"1px solid #b6f5c2"}}>Mission complete ✅</div>}
      </div>
    </div>
  );
}

function pill(){
  return { background:"#fff", color:"#111", border:"1px solid #ddd", padding:"8px 12px", borderRadius:999, boxShadow:"0 6px 18px rgba(0,0,0,0.18)" };
}
