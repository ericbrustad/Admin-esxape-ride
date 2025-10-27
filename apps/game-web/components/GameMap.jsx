import React, { useEffect, useRef, useState } from "react";
import { OVERLAYS } from "../lib/overlays";
import { startGeofenceWatcher } from "../lib/geofence";
import { emit, on, Events } from "../lib/eventBus";
import { showBanner } from "./ui/Banner";

// CDN helpers
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.async=true; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function loadCssOnce(href){ if([...(document.styleSheets||[])].some(ss=>ss.href===href)) return; const l=document.createElement("link"); l.rel="stylesheet"; l.href=href; document.head.appendChild(l); }

// Geo helpers for true circle rings
const R = 6371000;
function toRad(d){return d*Math.PI/180;}
function dest(lng,lat,bear,dist){
  const φ1=toRad(lat), λ1=toRad(lng), θ=toRad(bear), δ=dist/R;
  const sinφ1=Math.sin(φ1), cosφ1=Math.cos(φ1), sinδ=Math.sin(δ), cosδ=Math.cos(δ);
  const sinφ2=sinφ1*cosδ + cosφ1*sinδ*Math.cos(θ);
  const φ2=Math.asin(sinφ2);
  const y=Math.sin(θ)*sinδ*cosφ1, x=cosδ - sinφ1*sinφ2;
  const λ2=λ1+Math.atan2(y,x);
  return [((λ2*180/Math.PI+540)%360)-180, (φ2*180/Math.PI)];
}
function circleFeature([lng,lat], r, steps=80){
  const ring=[]; for(let i=0;i<=steps;i++) ring.push(dest(lng,lat,(i/steps)*360,r));
  return { type:"Feature", geometry:{ type:"Polygon", coordinates:[ring] }, properties:{} };
}

export default function GameMap({ overlays: overlaysProp }){
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const engineRef = useRef("maplibre");
  const [engine, setEngine] = useState(null);
  const [engineNote, setEngineNote] = useState("");
  const [mapReady, setMapReady] = useState(false);
  // Track which features we're "inside" to avoid duplicate enter spam on clicks
  const insideIdsRef = useRef(new Set());
  const modalOpenRef = useRef(false);
  // Transparent click-catcher overlay (so Mapbox never sees the click directly)
  const clickCatchRef = useRef(null);

  // runtime refs
  const recordsRef = useRef(new Map());          // id -> { marker, el, type, media, feature, visible }
  const stopFenceRef = useRef(null);
  const simMarkerRef = useRef(null);
  const simulateRef = useRef(false);
  const debugRef = useRef(false);
  const audioGateRef = useRef({ all:false, music:false, fx:false });

  function updateClickCatcher(){
    const div = clickCatchRef.current;
    if (!div) return;
    const active = simulateRef.current && !modalOpenRef.current;
    div.style.pointerEvents = active ? "auto" : "none";
    div.style.cursor = active ? "crosshair" : "auto";
  }

  // ---- boot map ONCE
  useEffect(()=>{
    let destroyed=false;
    (async()=>{
      // Mapbox → MapLibre fallback
      const qs = typeof location!=="undefined" ? new URLSearchParams(location.search) : null;
      const force = (qs?.get("engine")||"").toLowerCase();
      const urlToken = qs?.get("mb") || qs?.get("mapbox") || null;
      const envToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
      const token = urlToken || envToken;

      async function bootMapbox(){
        loadCssOnce("https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css");
        await loadScript("https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.js");
        if(!window.mapboxgl) throw new Error("Mapbox GL not available");
        if(!token) throw new Error("No Mapbox token");
        window.mapboxgl.accessToken = token;
        const gl = window.mapboxgl;
        const map = new gl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/standard",
          center: [-93.265, 44.9778],
          zoom: 12, pitch: 60, bearing: -17,
        });
        map.addControl(new gl.NavigationControl({ visualizePitch:true }), "top-left");
        if (gl.GeolocateControl){
          map.addControl(new gl.GeolocateControl({
            positionOptions:{ enableHighAccuracy:true },
            trackUserLocation:true, showUserHeading:true
          }), "top-left");
        }
        return { map, gl, mode:"mapbox" };
      }
      async function bootLibre(note){
        loadCssOnce("https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.css");
        await loadScript("https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js");
        const gl = window.maplibregl;
        const map = new gl.Map({
          container: containerRef.current,
          style: "https://demotiles.maplibre.org/style.json",
          center: [-93.265, 44.9778],
          zoom: 12
        });
        map.addControl(new gl.NavigationControl({ visualizePitch:true }), "top-left");
        if (note) setEngineNote(note);
        return { map, gl, mode:"maplibre" };
      }

      let map, gl, mode;
      try{
        if(force==="maplibre") ({map,gl,mode}=await bootLibre("Forced MapLibre via URL"));
        else ({map,gl,mode}=await bootMapbox());
      }catch(e){
        ({map,gl,mode}=await bootLibre(token ? ("Mapbox init failed: "+(e?.message||e)) : "Missing token; using MapLibre"));
      }
      if(destroyed || !map) return;
      mapRef.current = map; engineRef.current = mode; setEngine(mode);
      // Mark ready on 'load', also set on first 'styledata' and a small fallback timer
      let readyTicked = false;
      const onLoad = () => { if (!readyTicked) { readyTicked = true; setMapReady(true); } };
      const onStyle = () => { if (!readyTicked && map.isStyleLoaded?.()) { readyTicked = true; setMapReady(true); } };
      map.on("load", onLoad);
      map.on("styledata", onStyle);
      // Fallback: flip ready after ~1.2s if style events were missed but map exists
      const t = setTimeout(()=>{ if (!readyTicked) { readyTicked = true; setMapReady(true); } }, 1200);

      // settings listener (once)
      const offSettings = on(Events.SETTINGS_UPDATE, ({ audioAll, audioMusic, audioFx, debug, simulate })=>{
        audioGateRef.current = { all:!!audioAll, music:!!audioMusic, fx:!!audioFx };
        debugRef.current = !!debug; simulateRef.current = !!simulate;
        updateClickCatcher();
        renderRings(); // reflect toggle immediately
      });

      const offModal = on(Events.UI_MODAL_OPEN, (isOpen)=>{
        modalOpenRef.current = !!isOpen;
        updateClickCatcher();
      });

      // cleanup on unmount
      return ()=>{
        destroyed=true;
        offSettings();
        offModal();
        try{ map.off("load", onLoad); }catch{}
        try{ map.off("styledata", onStyle); }catch{}
        try{ clearTimeout(t); }catch{}
        try{
          const m = mapRef.current;
          if(m?.getLayer("__rings_line")) m.removeLayer("__rings_line");
          if(m?.getSource("__rings_src")) m.removeSource("__rings_src");
        }catch{}
        try{ stopFenceRef.current?.(); }catch{}
        try{ simMarkerRef.current?.remove?.(); }catch{}
        for(const rec of recordsRef.current.values()){
          try{ rec.marker.remove(); }catch{}
          if(rec.media && rec.type==="audio"){ try{ rec.media.pause(); }catch{} }
        }
        recordsRef.current.clear();
        try{ mapRef.current?.remove?.(); }catch{}
        mapRef.current = null;
      };
    })();
  },[]);

  // ---- overlay sync: rebuild markers + watcher when overlays OR map readiness change
  useEffect(()=>{
    if (!mapReady) return;
    const map = mapRef.current; if(!map) return;
    const ACTIVE = (Array.isArray(overlaysProp) && overlaysProp.length) ? overlaysProp : OVERLAYS;

    // clear prior markers, watcher, rings
    try{ stopFenceRef.current?.(); }catch{}
    insideIdsRef.current.clear();
    for(const rec of recordsRef.current.values()){
      try{ rec.marker.remove(); }catch{}
      if(rec.media && rec.type==="audio"){ try{ rec.media.pause(); }catch{} }
    }
    recordsRef.current.clear();
    try{
      if(map.getLayer("__rings_line")) map.removeLayer("__rings_line");
      if(map.getSource("__rings_src")) map.removeSource("__rings_src");
    }catch{}

    // build overlay markers
    const Mk = engineRef.current==="mapbox" ? window.mapboxgl.Marker : window.maplibregl.Marker;
    function buildDom(feature){
      const el=document.createElement("div");
      el.style.position="relative";
      el.style.transform="translate(-50%,-50%)";
      el.style.pointerEvents="none"; // never steal clicks
      el.style.userSelect="none";
      el.dataset.overlayId=feature.id;
      el.style.display="none";
      let media=null;
      if(feature.type==="image"){
        const img=document.createElement("img");
        img.src=feature.url;
        const w=feature.size?.width??240, h=feature.size?.height??160;
        Object.assign(img.style,{ width:`${w}px`, height:`${h}px`, borderRadius:"12px", boxShadow:"0 8px 24px rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.85)" });
        el.appendChild(img);
      }else if(feature.type==="video"){
        const vid=document.createElement("video");
        vid.src=feature.url; if(feature.poster) vid.poster=feature.poster;
        vid.muted=true; vid.playsInline=true; vid.loop=!!feature.loop;
        const w=feature.size?.width??320, h=feature.size?.height??180;
        Object.assign(vid.style,{ width:`${w}px`, height:`${h}px`, borderRadius:"12px", boxShadow:"0 8px 24px rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.85)", background:"#000" });
        el.appendChild(vid); media=vid;
      }else if(feature.type==="text"){
        const card=document.createElement("div");
        Object.assign(card.style,{ maxWidth:"280px", padding:"12px 14px", background:"rgba(255,255,255,0.95)", color:"#111", borderRadius:"12px", border:"1px solid #ddd", boxShadow:"0 8px 24px rgba(0,0,0,0.2)", fontFamily:"system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif" });
        card.textContent=feature.text || "";
        el.appendChild(card);
      }else if(feature.type==="audio"){
        const dot=document.createElement("div");
        Object.assign(dot.style,{ width:"10px",height:"10px",borderRadius:"50%",background:"#ff3764",outline:"2px solid #fff" });
        el.appendChild(dot);
        media=new Audio(feature.url); media.preload="auto"; media.crossOrigin="anonymous";
      }
      return { el, media };
    }
    for (const f of ACTIVE){
      const { el, media } = buildDom(f);
      const marker = new Mk({ element: el }).setLngLat(f.coordinates).addTo(map);
      recordsRef.current.set(f.id, { marker, el, type:f.type, media, feature:f, visible:false });
    }

    // listener helpers
    function shouldPlayAudio(feature){
      const g = audioGateRef.current || {};
      if (g.all) return true;
      const cat = String(feature?.category || "fx").toLowerCase();
      return cat==="music" ? !!g.music : !!g.fx;
    }

    const offEnter = on(Events.GEO_ENTER, ({ feature })=>{
      const rec = recordsRef.current.get(feature.id);
      if(!rec) return;
      insideIdsRef.current.add(feature.id);
      rec.visible = true; rec.el.style.display="block";
      if(rec.type==="video" && rec.media){ if(feature.autoplay!==false){ rec.media.play().catch(()=>{}); } }
      if(rec.type==="audio" && rec.media){ if(shouldPlayAudio(feature)){ rec.media.play().catch(()=>{}); } }
      try { if (typeof showBanner==="function") showBanner(`Entered zone: ${feature.id}`, 1200); } catch {}
      emit(Events.ACTION_SHOW,{feature}); emit(Events.ACTION_PLAY,{feature});
    });
    const offExit = on(Events.GEO_EXIT, ({ feature })=>{
      const rec = recordsRef.current.get(feature.id);
      if(!rec) return;
      insideIdsRef.current.delete(feature.id);
      rec.visible = false; rec.el.style.display="none";
      if(rec.type==="video" && rec.media){ rec.media.pause(); }
      if(rec.type==="audio" && rec.media){ rec.media.pause(); }
      emit(Events.ACTION_PAUSE,{feature}); emit(Events.ACTION_HIDE,{feature});
    });

    // (re)start watcher for the SAME overlays we rendered
    stopFenceRef.current = startGeofenceWatcher({ features: ACTIVE, highAccuracy:true });

    // draw rings if debug ON
    renderRings();

    // cleanup for this overlays set
    return ()=>{
      try{ stopFenceRef.current?.(); }catch{}
      offEnter(); offExit();
      try{
        if(map.getLayer("__rings_line")) map.removeLayer("__rings_line");
        if(map.getSource("__rings_src")) map.removeSource("__rings_src");
      }catch{}
      for(const rec of recordsRef.current.values()){
        try{ rec.marker.remove(); }catch{}
        if(rec.media && rec.type==="audio"){ try{ rec.media.pause(); }catch{} }
      }
      recordsRef.current.clear();
    };
  }, [overlaysProp, mapReady]); // <— resync when mission overlays change OR map becomes ready

  function renderRings(){
    const map = mapRef.current; if(!map) return;
    const enabled = debugRef.current;
    const srcId="__rings_src", layerId="__rings_line";
    if(!enabled){
      try{ if(map.getLayer(layerId)) map.removeLayer(layerId); if(map.getSource(srcId)) map.removeSource(srcId); }catch{}
      return;
    }
    const feats=[];
    for(const rec of recordsRef.current.values()){
      const f = rec.feature, r = Math.max(10, Number(f.radius||100));
      feats.push(circleFeature([f.coordinates[0], f.coordinates[1]], r, 80));
    }
    const fc={ type:"FeatureCollection", features:feats };
    if(map.getSource(srcId)) map.getSource(srcId).setData(fc);
    else{
      map.addSource(srcId,{ type:"geojson", data:fc });
      map.addLayer({ id:layerId, type:"line", source:srcId, paint:{
        "line-color":"rgba(255,0,0,0.75)", "line-width":2, "line-dasharray":[2,2]
      }});
    }
  }

  useEffect(()=>{
    const div = clickCatchRef.current;
    const map = mapRef.current;
    if (!mapReady || !div || !map) return;

    // Ensure overlay reflects current simulate/modal state
    updateClickCatcher();

    function handleClick(ev){
      if (!simulateRef.current) return;
      if (modalOpenRef.current) return;
      try {
        const rect = div.getBoundingClientRect();
        const px = [ev.clientX - rect.left, ev.clientY - rect.top];
        const ll = map.unproject(px);
        const lng = ll?.lng;
        const lat = ll?.lat;
        if (typeof lng !== "number" || typeof lat !== "number") return;

        const Mk = engineRef.current === "mapbox" ? window.mapboxgl?.Marker : window.maplibregl?.Marker;
        if (!simMarkerRef.current && Mk) {
          simMarkerRef.current = new Mk({ color:"#007aff" }).addTo(map);
        }
        try { simMarkerRef.current?.setLngLat?.([lng, lat]); } catch {}

        emit(Events.GEO_POSITION, { lng, lat, accuracy:0 });

        const toRad = (d)=>d*Math.PI/180;
        const RADIUS = 6371000;
        let nearest = null, best = Infinity;
        for (const rec of recordsRef.current.values()) {
          const [flng, flat] = rec.feature.coordinates || [];
          if (typeof flng !== "number" || typeof flat !== "number") continue;
          const dLat = toRad(flat - lat);
          const dLng = toRad(flng - lng);
          const lat1 = toRad(lat);
          const lat2 = toRad(flat);
          const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
          const dist = 2*RADIUS*Math.asin(Math.min(1, Math.sqrt(h)));
          if (dist < best) { best = dist; nearest = rec.feature; }
        }
        if (nearest) {
          const radius = Number(nearest.radius || 100);
          const inside = best <= radius;
          try { if (typeof showBanner === "function") showBanner(`Click → ${nearest.id}: ${Math.round(best)}m / R=${radius}m · ${inside ? "INSIDE" : "outside"}`, 1600); } catch {}
          if (inside && !insideIdsRef.current.has(nearest.id)) {
            insideIdsRef.current.add(nearest.id);
            emit(Events.GEO_ENTER, { feature: nearest, distance: best });
            emit(Events.UI_OPEN_DIALOG, {
              title: nearest.dialog?.title || "Zone reached",
              message: nearest.dialog?.text || nearest.text || `Entered zone: ${nearest.id}` ,
              continueLabel: nearest.dialog?.continueLabel || "Continue"
            });
          }
        }
      } catch {}
    }

    let clickCooldown = false;
    const wrappedClick = (ev) => {
      if (clickCooldown) return;
      clickCooldown = true;
      handleClick(ev);
      setTimeout(() => { clickCooldown = false; }, 800);
    };
    div.addEventListener("click", wrappedClick, { passive: true });
    return () => {
      try { div.removeEventListener("click", wrappedClick); } catch {}
    };
  }, [mapReady]);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:0 }}>
      <div
        ref={containerRef}
        style={{ position:"absolute", inset:0, minHeight:"100vh", minWidth:"100vw", cursor: (simulateRef.current && !modalOpenRef.current) ? "crosshair" : "auto" }}
      />
      <div
        ref={clickCatchRef}
        style={{ position:"absolute", inset:0, pointerEvents: (simulateRef.current && !modalOpenRef.current) ? "auto" : "none", cursor: (simulateRef.current && !modalOpenRef.current) ? "crosshair" : "auto", background:"transparent", zIndex:5 }}
      />
      {engine && (
        <div style={{ position:"absolute", right:12, top:12, zIndex:10, pointerEvents:"none" }}>
          <div style={{ background:"#fff", border:"1px solid #ddd", padding:"6px 10px", borderRadius:10, fontSize:12 }}>
            Map engine: <strong>{engine === "mapbox" ? "Mapbox" : "MapLibre"}</strong>
            {engineNote ? <span style={{opacity:0.7}}> — {engineNote}</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}
