import React, { useEffect, useRef, useState } from "react";

const MAPBOX_VERSION = "v3.13.0";
const MAPBOX_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox://styles/mapbox/streets-v12";
const DEFAULT_CENTER = [-93.265, 44.9778];
const DEFAULT_ZOOM = 12;

export default function GameMap() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;

    async function initMap() {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) throw new Error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");

        // Load Mapbox CSS once
        if (!document.querySelector('link[data-mapbox-css="true"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.css`;
          link.dataset.mapboxCss = "true";
          document.head.appendChild(link);
        }

        // Load Mapbox JS once
        if (!window.mapboxgl) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.js`;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        if (destroyed) return;
        const gl = window.mapboxgl;
        gl.accessToken = token;

        const map = new gl.Map({
          container: containerRef.current,
          style: MAPBOX_STYLE,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: true,
        });

        map.addControl(new gl.NavigationControl(), "top-right");

        map.once("load", () => {
          if (destroyed) return;
          setStatus("ready");
        });

        mapRef.current = map;
      } catch (err) {
        console.error("[Mapbox init error]", err);
        setStatus("error");
      }
    }

    initMap();

    return () => {
      destroyed = true;
      try {
        mapRef.current?.remove?.();
      } catch (err) {
        console.warn("[Mapbox cleanup error]", err);
      }
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          minHeight: "100vh",
          minWidth: "100vw",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "#fff",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          zIndex: 10,
        }}
      >
        {status === "loading" && "Loading Mapbox..."}
        {status === "ready" && "Map engine: Mapbox v3.13.0"}
        {status === "error" && "Error loading map"}
      </div>
    </div>
  );
}
