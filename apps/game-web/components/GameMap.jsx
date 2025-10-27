import React, { useEffect, useRef, useState } from "react";
import { OVERLAYS } from "../lib/overlays";
import { startGeofenceWatcher } from "../lib/geofence";
import { emit, on, Events } from "../lib/eventBus";

// CDN loaders (no node_modules needed)
function loadScript(src){
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
function loadCssOnce(href){
  if ([...(document.styleSheets || [])].some((ss) => ss.href === href)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

export default function GameMap({ overlays: overlaysProp }){
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const simMarkerRef = useRef(null);
  const audioGate = useRef(false);

  // Keep overlay/handler references outside the async IIFE so cleanup can access them.
  const overlayRecordsRef = useRef(new Map()); // id -> { marker, el, type, media, feature, visible }
  const cleanupRef = useRef({
    offSettings: null,
    offEnter: null,
    offExit: null,
    stopFence: null,
    onMapClick: null,
  });

  const [simulate, setSimulate] = useState(false);
  const [debug, setDebug] = useState(false);
  const [engine, setEngine] = useState(null); // 'mapbox' | 'maplibre'
  const [engineNote, setEngineNote] = useState("");

  useEffect(()=>{
    // Reset cleanup refs for this mount
    cleanupRef.current.offSettings = null;
    cleanupRef.current.offEnter = null;
    cleanupRef.current.offExit = null;
    cleanupRef.current.stopFence = null;
    cleanupRef.current.onMapClick = null;

    let isMounted = true;

    (async ()=>{
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
      let glLib = null;
      let mode = null;
      let fallbackNote = "";
      try {
        if (!token) throw new Error("Missing token");
        loadCssOnce("https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css");
        await loadScript("https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.js");
        if (!window.mapboxgl) throw new Error("Mapbox unavailable");
        window.mapboxgl.accessToken = token;
        glLib = window.mapboxgl;
        mode = "mapbox";
      } catch (err) {
        loadCssOnce("https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.css");
        await loadScript("https://unpkg.com/maplibre-gl@3.6.1/dist/maplibre-gl.js");
        glLib = window.maplibregl;
        mode = "maplibre";
        fallbackNote = token ? "Mapbox blocked; using MapLibre" : "Missing token; using MapLibre";
      }

      if(!isMounted || !containerRef.current) return;
      const map = new glLib.Map({
        container: containerRef.current,
        // Prefer Mapbox Standard (3D) when available, otherwise MapLibre demo tiles.
        style: mode === "mapbox" ? "mapbox://styles/mapbox/standard" : "https://demotiles.maplibre.org/style.json",
        center: [-93.265, 44.9778],
        zoom: 12,
        pitch: mode === "mapbox" ? 60 : 0,
        bearing: mode === "mapbox" ? -17 : 0,
      });
      map.addControl(new glLib.NavigationControl({ visualizePitch: true }), "top-left");
      if (mode === "mapbox" && glLib.GeolocateControl) {
        map.addControl(new glLib.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }), "top-left");
      }
      mapRef.current = map;
      setEngine(mode);
      setEngineNote(fallbackNote);

      if (mode === "mapbox") {
        try {
          if (typeof map.setProjection === "function") map.setProjection("globe");
          const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
          const preset = params?.get("light")?.toLowerCase?.() ?? "";
          const allowed = ["day", "dawn", "dusk", "night"];
          if (allowed.includes(preset) && typeof map.setConfigProperty === "function") {
            map.setConfigProperty("basemap", "lightPreset", preset);
          }
        } catch {}
      }

      // Build overlays
      const records = overlayRecordsRef.current;
      records.clear();
      function buildDom(feature){
        const el=document.createElement("div");
        el.style.position="relative";
        el.style.transform="translate(-50%,-50%)";
        el.style.pointerEvents="auto";
        el.style.userSelect="none";
        el.dataset.overlayId=feature.id;
        el.style.display="none"; // hidden until user enters geofence
        let media=null;
        if(feature.type==="image"){
          const img=document.createElement("img"); img.src=feature.url;
          const w=feature.size?.width??240, h=feature.size?.height??160;
          Object.assign(img.style,{ width:`${w}px`, height:`${h}px`, borderRadius:"12px", boxShadow:"0 8px 24px rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.85)" });
          el.appendChild(img);
        } else if(feature.type==="video"){
          const vid=document.createElement("video"); vid.src=feature.url;
          if(feature.poster) vid.poster=feature.poster;
          vid.muted=true; vid.playsInline=true; vid.loop=!!feature.loop;
          const w=feature.size?.width??320, h=feature.size?.height??180;
          Object.assign(vid.style,{ width:`${w}px`, height:`${h}px`, borderRadius:"12px", boxShadow:"0 8px 24px rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.85)", background:"#000" });
          el.appendChild(vid); media=vid;
        } else if(feature.type==="text"){
          const card=document.createElement("div");
          Object.assign(card.style,{ maxWidth:"280px", padding:"12px 14px", background:"rgba(255,255,255,0.95)", color:"#111", borderRadius:"12px", border:"1px solid #ddd", boxShadow:"0 8px 24px rgba(0,0,0,0.2)", fontFamily:"system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif" });
          card.textContent=feature.text||"Text overlay"; el.appendChild(card);
        } else if(feature.type==="audio"){
          const dot=document.createElement("div"); Object.assign(dot.style,{ width:"10px",height:"10px",borderRadius:"50%",background:"#ff3764",outline:"2px solid #fff" }); el.appendChild(dot);
          media=new Audio(feature.url); media.preload="auto"; media.crossOrigin="anonymous";
        }
        return { el, media };
      }

      const ACTIVE = Array.isArray(overlaysProp) && overlaysProp.length ? overlaysProp : OVERLAYS;
      for(const f of ACTIVE){
        const { el, media } = buildDom(f);
        const marker = new glLib.Marker({ element: el }).setLngLat(f.coordinates).addTo(map);
        records.set(f.id, { marker, el, type:f.type, media, feature:f, visible:false, __ringMarker:null });
      }

      // Always-visible debug rings (rendered as their own markers so overlays stay hidden until entered)
      function setDebugRings(enabled){
        for(const rec of records.values()){
          const { feature } = rec;
          if(!enabled){
            try{ rec.__ringMarker?.remove?.(); }catch{}
            rec.__ringMarker = null;
            continue;
          }
          if(!rec.__ringMarker){
            const diameter = Math.max(120, Math.min(520, (feature.radius || 100) / 0.75));
            const ringEl = document.createElement("div");
            Object.assign(ringEl.style,{
              width:`${diameter}px`,
              height:`${diameter}px`,
              border:"2px dashed rgba(255,0,0,0.7)",
              borderRadius:"50%",
              transform:"translate(-50%,-50%)",
              position:"relative",
              pointerEvents:"none",
              boxSizing:"border-box",
            });
            const MarkerCtor = glLib?.Marker || (engine === "mapbox" ? window.mapboxgl?.Marker : window.maplibregl?.Marker);
            if(MarkerCtor && mapRef.current){
              rec.__ringMarker = new MarkerCtor({ element:ringEl }).setLngLat(feature.coordinates).addTo(mapRef.current);
            }
          }
        }
      }

      // Event-bus subscriptions (store unsubscribe functions for cleanup)
      cleanupRef.current.offSettings = on(Events.SETTINGS_UPDATE, ({ audioEnabled, debug, simulate })=>{
        audioGate.current = !!audioEnabled; setDebug(!!debug); setSimulate(!!simulate); setDebugRings(!!debug);
      });

      const handleEnter = ({ feature })=>{
        const rec = records.get(feature.id); if(!rec) return;
        rec.visible=true; rec.el.style.display="block";
        if(rec.type==="video" && rec.media){ if(feature.autoplay!==false){ rec.media.play().catch(()=>{});} }
        if(rec.type==="audio" && rec.media){ if(audioGate.current){ rec.media.play().catch(()=>{});} }
        emit(Events.ACTION_SHOW,{feature}); emit(Events.ACTION_PLAY,{feature});
      };
      const handleExit = ({ feature })=>{
        const rec = records.get(feature.id); if(!rec) return;
        rec.visible=false; rec.el.style.display="none";
        if(rec.type==="video" && rec.media){ rec.media.pause(); }
        if(rec.type==="audio" && rec.media){ rec.media.pause(); }
        emit(Events.ACTION_PAUSE,{feature}); emit(Events.ACTION_HIDE,{feature});
      };
      cleanupRef.current.offEnter = on(Events.GEO_ENTER, handleEnter);
      cleanupRef.current.offExit = on(Events.GEO_EXIT, handleExit);

      // Map click handler for simulated position
      const onMapClick = (e)=>{
        if(!simulate) return;
        if(!simMarkerRef.current){
          const MarkerCtor = mode === "mapbox" ? window.mapboxgl?.Marker : window.maplibregl?.Marker;
          if (MarkerCtor) {
            simMarkerRef.current = new MarkerCtor({ color:"#007aff" }).addTo(map);
          }
        }
        if (simMarkerRef.current) {
          simMarkerRef.current.setLngLat([e.lngLat.lng, e.lngLat.lat]);
        }
        emit(Events.GEO_POSITION, { lng:e.lngLat.lng, lat:e.lngLat.lat, accuracy:0 });
      };
      map.on("click", onMapClick);
      cleanupRef.current.onMapClick = onMapClick;

      // Start geofence watcher; stopFence clears navigator.geolocation watch + unsubscribes sim listener
      cleanupRef.current.stopFence = startGeofenceWatcher({ features: ACTIVE, highAccuracy: true });
    })();

    // ✅ Proper cleanup returned to React so we don't leak listeners or tracking.
    return ()=>{
      isMounted = false;

      // Stop geofence watcher (clears navigator.geolocation.watchPosition and sim listener)
      try{ cleanupRef.current.stopFence && cleanupRef.current.stopFence(); }catch{}
      cleanupRef.current.stopFence = null;

      // Unsubscribe event-bus listeners
      try{ cleanupRef.current.offSettings && cleanupRef.current.offSettings(); }catch{}
      try{ cleanupRef.current.offEnter && cleanupRef.current.offEnter(); }catch{}
      try{ cleanupRef.current.offExit && cleanupRef.current.offExit(); }catch{}
      cleanupRef.current.offSettings = cleanupRef.current.offEnter = cleanupRef.current.offExit = null;

      // Remove map click handler
      try{
        if(mapRef.current && cleanupRef.current.onMapClick){
          mapRef.current.off("click", cleanupRef.current.onMapClick);
        }
      }catch{}
      cleanupRef.current.onMapClick = null;

      // Remove simulated marker
      try{ simMarkerRef.current?.remove?.(); }catch{}
      simMarkerRef.current = null;

      // Remove overlay markers and pause any audio
      for(const rec of overlayRecordsRef.current.values()){
        try{ rec.marker.remove(); }catch{}
        try{ rec.__ringMarker?.remove?.(); }catch{}
        rec.__ringMarker = null;
        if(rec.media && rec.type==="audio"){ try{ rec.media.pause(); }catch{} }
      }
      overlayRecordsRef.current.clear();

      // Finally, remove the map instance
      try{ mapRef.current?.remove?.(); }catch{}
      mapRef.current = null;
    };
  },[simulate, overlaysProp]); // re-init when simulation toggle or overlays change

  return (
    <div style={{ position:"fixed", inset:0, zIndex:0 }}>
      <div ref={containerRef} style={{ position:"absolute", inset:0, minHeight:"100vh", minWidth:"100vw" }} />
      <div style={{ position:"absolute", left:12, top:12, zIndex:10 }}>
        <button onClick={()=>emit(Events.SETTINGS_UPDATE,{ audioEnabled:true, debug, simulate })} style={{ background:"#fff", border:"1px solid #ddd", padding:"8px 10px", borderRadius:10, cursor:"pointer" }}>🔉 Enable Audio</button>
      </div>
      {engine && (
        <div style={{ position:"absolute", right:12, top:12, zIndex:10 }}>
          <div style={{ background:"#fff", border:"1px solid #ddd", padding:"6px 10px", borderRadius:10, fontSize:12 }}>
            Map engine: <strong>{engine === "mapbox" ? "Mapbox" : "MapLibre"}</strong>
            {engineNote ? <span style={{opacity:0.7}}> — {engineNote}</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}
