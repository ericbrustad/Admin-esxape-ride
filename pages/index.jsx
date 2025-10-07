import React, { useEffect, useRef, useState } from 'react';
import TestLauncher from '../components/TestLauncher';

/* ───────────────────────── Helpers ───────────────────────── */
async function fetchJsonSafe(url, fallback) {
  // ... (helper functions remain unchanged)
}
async function fetchFirstJson(urls, fallback) {
  // ...
}
function toDirectMediaURL(u) {
  // ...
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function hexToRgb(hex) {
  // ...
}
const EXTS = {
  image: /\.(png|jpg|jpeg|webp)$/i,
  gif: /\.(gif)$/i,
  video: /\.(mp4|webm|mov)$/i,
  audio: /\.(mp3|wav|ogg|m4a|aiff|aif)$/i, // include AIFF/AIF
};
function classifyByExt(u) {
  // ...
}
async function listInventory(dirs = ['uploads', 'bundles', 'icons']) {
  // ...
}
function baseNameFromUrl(url) {
  // ...
}
function qs(obj) {
  // ...
}
function pathFromUrl(u) {
  // ...
}
async function deleteMediaPath(repoPath) {
  // ...
}

/* ───────────────────────── Defaults ───────────────────────── */
const DEFAULT_BUNDLES = {
  // ... (defaults remain unchanged)
};
function applyDefaultIcons(cfg) {
  // ...
}

/* ───────────────────────── Constants ───────────────────────── */
const TYPE_FIELDS = {
  // ... (constants remain unchanged)
};
const TYPE_LABELS = {
  // ...
};
const GAME_TYPES = ['Mystery','Chase','Race','Thriller','Hunt'];
const DEVICE_TYPES = [
  // ...
];
const FONT_FAMILIES = [
  // ...
];
function defaultAppearance() {
  // ...
}
const DEFAULT_ICONS = { missions:[], devices:[], rewards:[] };

/* ───────────────────────── Sub-tabs & Components (FIXED: Moved before use) ────────────────── */

/* Styles */
const S = {
  body: { background:'#0b0c10', color:'#e9eef2', minHeight:'100vh', fontFamily:'system-ui, Arial, sans-serif' },
  header: { padding:16, background:'#11161a', borderBottom:'1px solid #1f262d' },
  wrap: { maxWidth:1200, margin:'0 auto', padding:16 },
  wrapGrid2: { display:'grid', gridTemplateColumns:'360px 1fr', gap:16, alignItems:'start', maxWidth:1400, margin:'0 auto', padding:16 },
  sidebarTall: { background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:12, position:'sticky', top:12, height:'calc(100vh - 120px)', overflow:'auto' },
  card: { background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:16 },
  missionItem: { borderBottom:'1px solid #1f262d', padding:'10px 4px' },
  input:{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2' },
  button:{ padding:'10px 14px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' },
  tab:{ padding:'8px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0f1418', color:'#e9eef2', cursor:'pointer' },
  tabActive:{ background:'#1a2027' },
  search:{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2', marginBottom:10 },
  hr:{ border:'1px solid #1f262d', borderBottom:'none' },
  overlay:{ position:'fixed', inset:0, display:'grid', placeItems:'center', background:'rgba(0,0,0,0.55)', zIndex:2000, padding:16 },
  chip:{ fontSize:11, color:'#c9d6e2', border:'1px solid #2a323b', padding:'2px 6px', borderRadius:999, background:'#0f1418' },
  chipRow:{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' },
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  // ... (Component definition)
}

function AppearanceEditor({ value, onChange }) {
  // ... (Component definition)
}

function MultipleChoiceEditor({ value, correctIndex, onChange }) {
  // ... (Component definition)
}

function MediaPreview({ url, kind }) {
  // ... (Component definition)
}

function MapOverview({
  missions = [], devices = [], icons = DEFAULT_ICONS, showRings = true,
  interactive = false, draftDevice = null,
  selectedDevIdx = null, selectedMissionIdx = null,
  onDraftChange = null, onMoveSelected = null, onMoveSelectedMission = null,
  onSelectDevice = null, onSelectMission = null,
  mapCenter = { lat:44.9778, lng:-93.2650 }, mapZoom = 13,
  defaultIconSizePx = 24, selectedIconSizePx = 28,
  readOnly = false,
  lockToRegion = false,
}) {
  // ... (Component definition)
}

function MapPicker({ lat, lng, radius = 25, onChange, center = { lat:44.9778, lng:-93.2650 } }) {
  // ... (Component definition)
}

function TextTab({ config, setConfig }) {
  // ... (Component definition)
}

function IconGroup({ title, items, onRemove }) {
  // ... (Component definition)
}

function Pool({ title, items, onRemove }) {
  // ... (Component definition)
}

function MediaPoolTab({
  suite,
  config,
  setConfig,
  uploadStatus,
  setUploadStatus,
  uploadToRepo,
}) {
  // ... (Component definition)
}

function AssignedMediaTab({ config, setConfig, onReapplyDefaults }) {
  // ... (Component definition)
}


/* ───────────────────────── Root Component ───────────────────────── */
export default function Admin() {
  const [tab, setTab] = useState('missions');
  const [games, setGames] = useState([]);
  const [activeSlug, setActiveSlug] = useState('default');
  // ...
  // ... (The rest of the Admin component code is unchanged)
  // ...

  // The return (...) statement and its JSX content are now valid 
  // because all child components are defined above.
  return (
    <div style={S.body}>
      {/* ... */}
    </div>
  );
}
