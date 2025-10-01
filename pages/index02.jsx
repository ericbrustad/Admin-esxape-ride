/**
 * index02.jsx (Admin v2 - Minimal)
 * Purpose: experimental, lighter UI. Start small and add features gradually.
 */

import { useEffect, useState } from 'react';

export default function AdminV2() {
  const [status, setStatus] = useState('Ready');
  const [games, setGames] = useState([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Mystery');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/games');
        const j = await r.json();
        setGames(j.games || []);
      } catch (e) {
        setStatus('Failed to load games');
      }
    })();
  }, []);

  async function createGame() {
    if (!title.trim()) return setStatus('Enter a game title first');
    setStatus('Creating…');
    const r = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', title, type }),
    });
    if (!r.ok) {
      setStatus('Create failed');
      return;
    }
    const { slug } = await r.json();
    setStatus(`✅ Created ${slug}`);
    // refresh list
    const rr = await fetch('/api/games');
    const jj = await rr.json();
    setGames(jj.games || []);
  }

  return (
    <main style={S.wrap}>
      <h1 style={{marginTop:0}}>Admin v2 (minimal)</h1>
      <p style={{color:'#9fb0bf'}}>{status}</p>

      <section style={S.card}>
        <h3>Create Game</h3>
        <div style={{display:'grid', gap:8, gridTemplateColumns:'1fr 160px auto'}}>
          <input placeholder="Game Title" value={title} onChange={e=>setTitle(e.target.value)} style={S.input}/>
          <select value={type} onChange={e=>setType(e.target.value)} style={S.input}>
            {['Mystery','Chase','Race','Thriller','Hunt'].map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <button onClick={createGame} style={S.button}>+ Create</button>
        </div>
      </section>

      <section style={S.card}>
        <h3>Games</h3>
        <ul>
          {games.map(g => (
            <li key={g.slug} style={{marginBottom:6}}>
              <b>{g.title}</b> <code>({g.slug})</code> • {g.type} •{' '}
              <a href={`/games/${g.slug}/config.json`} target="_blank" rel="noreferrer">config.json</a> •{' '}
              <a href={`/games/${g.slug}/missions.json`} target="_blank" rel="noreferrer">missions.json</a>
            </li>
          ))}
          {games.length === 0 && <li style={{color:'#9fb0bf'}}>No games yet.</li>}
        </ul>
      </section>

      <section style={S.card}>
        <h3>Notes</h3>
        <p>This is the light/experimental page. We’ll add: mission editor, save flows, AR helpers, etc.</p>
      </section>
    </main>
  );
}

const S = {
  wrap:{maxWidth:900,margin:'0 auto',padding:16, color:'#e9eef2', background:'#0b0c10', minHeight:'100vh', fontFamily:'system-ui, Arial, sans-serif'},
  card:{background:'#12181d',border:'1px solid #1f262d',borderRadius:14,padding:16, marginBottom:16},
  input:{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #2a323b',background:'#0b0c10',color:'#e9eef2'},
  button:{padding:'10px 14px',borderRadius:10,border:'1px solid #2a323b',background:'#1a2027',color:'#e9eef2',cursor:'pointer'},
};
