import React, { useEffect, useRef, useState } from "react";
import { OVERLAYS } from "../lib/overlays";
import { startGeofenceWatcher } from "../lib/geofence";
import { emit, on, Events } from "../lib/eventBus";
import { showBanner } from "./ui/Banner";

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
  const debugStateRef = useRef(false);
  const simulateRef = useRef(false);

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

  useEffect(()=>{ simulateRef.current = simulate; }, [simulate]);
  // Initialize map ONCE; do not re-init on settings toggles
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
        // Important: overlays must NOT intercept pointer events so map stays responsive
        el.style.pointerEvents="none";
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
        records.set(f.id, { marker, el, type:f.type, media, feature:f, visible:false });
      }

      if(debugStateRef.current) setDebugRings(true);

      // --- Geo helpers for geodesic debug circles rendered via a shared line layer
      const R_EARTH = 6371000;
      function destPoint(lng, lat, bearingDeg, distMeters){
        const phi1 = (lat * Math.PI) / 180;
        const lambda1 = (lng * Math.PI) / 180;
        const theta = (bearingDeg * Math.PI) / 180;
        const delta = distMeters / R_EARTH;
        const sinPhi1 = Math.sin(phi1), cosPhi1 = Math.cos(phi1);
        const sinDelta = Math.sin(delta), cosDelta = Math.cos(delta), sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
        const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * cosTheta;
        const phi2 = Math.asin(sinPhi2);
        const y = sinTheta * sinDelta * cosPhi1;
        const x = cosDelta - sinPhi1 * sinPhi2;
        const lambda2 = lambda1 + Math.atan2(y, x);
        return [(((lambda2 * 180) / Math.PI) + 540) % 360 - 180, (phi2 * 180) / Math.PI];
      }
      function circlePolygon([lng, lat], radiusMeters, steps = 80){
        const ring = [];
        for(let i=0;i<=steps;i++){
          const bearing = (i / steps) * 360;
          ring.push(destPoint(lng, lat, bearing, radiusMeters));
        }
        return {
          type:"Feature",
          geometry:{ type:"Polygon", coordinates:[ring] },
          properties:{}
        };
      }
      function setDebugRings(enabled){
        const mapInstance = mapRef.current;
        if(!mapInstance) return;
        const srcId = "__rings_src";
        const layerId = "__rings_line";
        if(!enabled){
          if(mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
          if(mapInstance.getSource(srcId)) mapInstance.removeSource(srcId);
          return;
        }
        if(typeof mapInstance.isStyleLoaded === "function" && !mapInstance.isStyleLoaded()){
          mapInstance.once?.("load", ()=>{ if(debugStateRef.current) setDebugRings(true); });
          return;
        }
        const features = [];
        for(const rec of records.values()){
          const feature = rec.feature;
          const radius = Math.max(10, Number(feature.radius || 100));
          if(Array.isArray(feature.coordinates) && feature.coordinates.length === 2){
            features.push(circlePolygon([feature.coordinates[0], feature.coordinates[1]], radius, 80));
          }
        }
        const collection = { type:"FeatureCollection", features };
        if(mapInstance.getSource(srcId)){
          mapInstance.getSource(srcId).setData(collection);
        } else {
          mapInstance.addSource(srcId, { type:"geojson", data:collection });
          mapInstance.addLayer({
            id: layerId,
            type: "line",
            source: srcId,
            paint: {
              "line-color": "rgba(255,0,0,0.75)",
              "line-width": 2,
              "line-dasharray": [2, 2]
            }
          });
        }
      }

      // Event-bus subscriptions (store unsubscribe functions for cleanup)
      cleanupRef.current.offSettings = on(Events.SETTINGS_UPDATE, ({ audioEnabled, debug, simulate })=>{
        audioGate.current = !!audioEnabled; debugStateRef.current = !!debug; simulateRef.current = !!simulate;
        setDebug(!!debug); setSimulate(!!simulate); setDebugRings(!!debug);
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
        if(!simulateRef.current) return;
        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;
        if(!simMarkerRef.current){
          const MarkerCtor = mode === "mapbox" ? window.mapboxgl?.Marker : window.maplibregl?.Marker;
          if (MarkerCtor) {
            simMarkerRef.current = new MarkerCtor({ color:"#007aff" }).addTo(map);
          }
        }
        if (simMarkerRef.current) {
          simMarkerRef.current.setLngLat([lng, lat]);
        }
        emit(Events.GEO_POSITION, { lng, lat, accuracy:0 });
        // Debug banner: report nearest overlay + distance so ops can confirm geofence math.
        try {
          let nearest = null;
          let best = Infinity;
          const toRad = (d)=>d * Math.PI / 180;
          const R = 6371000;
          for (const rec of overlayRecordsRef.current.values()) {
            const [flng, flat] = rec.feature.coordinates;
            const dLat = toRad(flat - lat);
            const dLng = toRad(flng - lng);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat)) * Math.cos(toRad(flat)) * Math.sin(dLng/2)**2;
            const dist = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
            if (dist < best) {
              best = dist;
              nearest = rec.feature;
            }
          }
          if (nearest) {
            const radius = Number(nearest.radius || 100);
            const inside = best <= radius;
            showBanner(`Click ${lng.toFixed(5)}, ${lat.toFixed(5)} → ${nearest.id}: ${Math.round(best)}m / R=${radius}m (${inside ? "INSIDE" : "outside"})`, 2600);
          } else {
            showBanner(`Click ${lng.toFixed(5)}, ${lat.toFixed(5)} → no overlays`, 2000);
          }
        } catch {}
      };
      map.on("click", onMapClick);
      cleanupRef.current.onMapClick = onMapClick;

      // Start geofence watcher **using the same overlays we rendered**; stopFence clears navigator.geolocation watch + unsubscribes sim listener
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
        if(rec.media && rec.type==="audio"){ try{ rec.media.pause(); }catch{} }
      }
      overlayRecordsRef.current.clear();

      // Remove debug ring layer/source before tearing down the map
      try{
        if(mapRef.current?.getLayer("__rings_line")) mapRef.current.removeLayer("__rings_line");
        if(mapRef.current?.getSource("__rings_src")) mapRef.current.removeSource("__rings_src");
      }catch{}

      // Finally, remove the map instance
      try{ mapRef.current?.remove?.(); }catch{}
      mapRef.current = null;
    };
  },[]); // run once on mount; internal handlers react via refs and event subscriptions

  return (
    <div style={{ position:"fixed", inset:0, zIndex:0 }}>
      <div
        ref={containerRef}
        style={{
          position:"absolute", inset:0, minHeight:"100vh", minWidth:"100vw",
          // nice hint when simulate is ON; harmless otherwise
          cursor: simulate ? "crosshair" : "auto"
        }}
      />
      <div style={{ position:"absolute", left:12, top:12, zIndex:10 }}>
        <button onClick={()=>emit(Events.SETTINGS_UPDATE,{ audioEnabled:true, debug, simulate })} style={{ background:"#fff", border:"1px solid #ddd", padding:"8px 10px", borderRadius:10, cursor:"pointer" }}>🔉 Enable Audio</button>
      </div>
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
