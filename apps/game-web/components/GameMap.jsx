import React, { useEffect, useRef, useState } from "react";
import { OVERLAYS } from "../lib/overlays";
import { startGeofenceWatcher } from "../lib/geofence";
import { emit, on, Events } from "../lib/eventBus";

function loadScript(src){
  return new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src=src;
    s.async=true;
    s.onload=res;
    s.onerror=rej;
    document.head.appendChild(s);
  });
}
function loadCssOnce(href){
  if([...(document.styleSheets||[])].some(ss=>ss.href===href)) return;
  const l=document.createElement("link");
  l.rel="stylesheet";
  l.href=href;
  document.head.appendChild(l);
}

export default function GameMap(){
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const simMarkerRef = useRef(null);
  const audioGate = useRef(false);
  const [simulate, setSimulate] = useState(false);
  const [debug, setDebug] = useState(false);

  useEffect(()=>{
    let stopFence=null;
    (async()=>{
      loadCssOnce("https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css");
      await loadScript("https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.js");
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
      if(!containerRef.current) return;
      const map = new mapboxgl.Map({ container: containerRef.current, style:"mapbox://styles/mapbox/streets-v12", center:[-93.265,44.9778], zoom:12 });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch:true }), "top-left");
      map.addControl(new mapboxgl.GeolocateControl({ positionOptions:{ enableHighAccuracy:true }, trackUserLocation:true, showUserHeading:true }), "top-left");
      mapRef.current = map;

      const overlayRef = new Map();
      function buildDom(feature){
        const el=document.createElement("div");
        el.style.position="relative";
        el.style.transform="translate(-50%,-50%)";
        el.style.pointerEvents="auto";
        el.style.userSelect="none";
        el.dataset.overlayId=feature.id;
        el.style.display="none";
        let media=null;
        if(feature.type==="image"){
          const img=document.createElement("img");
          img.src=feature.url;
          const w=feature.size?.width??240;
          const h=feature.size?.height??160;
          Object.assign(img.style,{ width:`${w}px`, height:`${h}px`, borderRadius:"12px", boxShadow:"0 8px 24px rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.85)" });
          el.appendChild(img);
        } else if(feature.type==="video"){
          const vid=document.createElement("video");
          vid.src=feature.url;
          if(feature.poster) vid.poster=feature.poster;
          vid.muted=true;
          vid.playsInline=true;
          vid.loop=!!feature.loop;
          const w=feature.size?.width??320;
          const h=feature.size?.height??180;
          Object.assign(vid.style,{ width:`${w}px`, height:`${h}px`, borderRadius:"12px", boxShadow:"0 8px 24px rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.85)", background:"#000" });
          el.appendChild(vid);
          media=vid;
        } else if(feature.type==="text"){
          const card=document.createElement("div");
          Object.assign(card.style,{ maxWidth:"280px", padding:"12px 14px", background:"rgba(255,255,255,0.95)", color:"#111", borderRadius:"12px", border:"1px solid #ddd", boxShadow:"0 8px 24px rgba(0,0,0,0.2)", fontFamily:"system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif" });
          card.textContent=feature.text||"Text overlay";
          el.appendChild(card);
        } else if(feature.type==="audio"){
          const dot=document.createElement("div");
          Object.assign(dot.style,{ width:"10px",height:"10px",borderRadius:"50%",background:"#ff3764",outline:"2px solid #fff" });
          el.appendChild(dot);
          media=new Audio(feature.url);
          media.preload="auto";
          media.crossOrigin="anonymous";
        }
        return { el, media };
      }

      for(const f of OVERLAYS){
        const { el, media } = buildDom(f);
        const marker = new mapboxgl.Marker({ element: el }).setLngLat(f.coordinates).addTo(map);
        overlayRef.set(f.id, { marker, el, type:f.type, media, feature:f, visible:false });
      }

      function setDebugRings(enabled){
        for(const { el, feature } of overlayRef.values()){
          let ring=el.querySelector(".__ring");
          const diameter=((feature.radius||100)/0.75);
          if(enabled && !ring){
            ring=document.createElement("div");
            ring.className="__ring";
            Object.assign(ring.style,{ position:"absolute", width:`${diameter}px`, height:`${diameter}px`, left:"50%", top:"50%", transform:"translate(-50%,-50%)", border:"2px dashed rgba(255,0,0,0.65)", borderRadius:"50%", pointerEvents:"none" });
            el.appendChild(ring);
          }
          if(ring){
            ring.style.display = enabled ? "block" : "none";
          }
        }
      }

      const offSettings = on(Events.SETTINGS_UPDATE, ({audioEnabled, debug, simulate})=>{
        audioGate.current = !!audioEnabled;
        setDebug(!!debug);
        setSimulate(!!simulate);
        setDebugRings(!!debug);
      });

      map.on("click",(e)=>{
        if(!simulate) return;
        if(!simMarkerRef.current){
          simMarkerRef.current = new window.mapboxgl.Marker({ color:"#007aff" }).addTo(map);
        }
        simMarkerRef.current.setLngLat([e.lngLat.lng, e.lngLat.lat]);
        emit(Events.GEO_POSITION, { lng:e.lngLat.lng, lat:e.lngLat.lat, accuracy:0 });
      });

      const offEnter = on(Events.GEO_ENTER, ({feature})=>{
        const rec = overlayRef.get(feature.id);
        if(!rec) return;
        rec.visible=true;
        rec.el.style.display="block";
        if(rec.type==="video" && rec.media){
          if(feature.autoplay!==false){
            rec.media.play().catch(()=>{});
          }
        }
        if(rec.type==="audio" && rec.media){
          if(audioGate.current){
            rec.media.play().catch(()=>{});
          }
        }
        emit(Events.ACTION_SHOW,{feature});
        emit(Events.ACTION_PLAY,{feature});
      });
      const offExit = on(Events.GEO_EXIT, ({feature})=>{
        const rec = overlayRef.get(feature.id);
        if(!rec) return;
        rec.visible=false;
        rec.el.style.display="none";
        if(rec.type==="video" && rec.media){
          rec.media.pause();
        }
        if(rec.type==="audio" && rec.media){
          rec.media.pause();
        }
        emit(Events.ACTION_PAUSE,{feature});
        emit(Events.ACTION_HIDE,{feature});
      });

      stopFence = startGeofenceWatcher({ features: OVERLAYS, highAccuracy:true });

      return ()=>{
        offSettings();
        offEnter();
        offExit();
        stopFence?.();
        for(const r of overlayRef.values()){
          try{ r.marker.remove(); }catch{}
          if(r.media && r.type==="audio"){
            try{ r.media.pause(); }catch{}
          }
        }
        map.remove();
        mapRef.current=null;
      };
    })();
  },[]);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:0 }}>
      <div ref={containerRef} style={{ position:"absolute", inset:0 }} />
      <div style={{ position:"absolute", left:12, top:12, zIndex:10 }}>
        <button onClick={()=>emit(Events.SETTINGS_UPDATE,{ audioEnabled:true, debug, simulate })} style={{ background:"#fff", border:"1px solid #ddd", padding:"8px 10px", borderRadius:10, cursor:"pointer" }}>🔉 Enable Audio</button>
      </div>
    </div>
  );
}
