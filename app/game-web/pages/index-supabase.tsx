import React from 'react';
import Head from 'next/head';
import { supabaseClient } from '../lib/supabase/client';

export async function getServerSideProps(ctx: any) {
  const slug = ctx.query.slug || null;
  const channel = ctx.query.channel || 'published';
  if (!slug) {
    return { props: { error: 'Missing ?slug=<game_slug> in URL.' } };
  }
  try {
    const { data: game, error: gErr } = await supabaseClient
      .from('games').select('*').eq('slug', slug).maybeSingle();
    if (gErr) throw gErr;
    if (!game) return { props: { error: `Game not found for slug '${slug}'` } };

    const { data: configs } = await supabaseClient
      .from('game_configs').select('config').eq('game_id', game.id).eq('channel', channel);

    const { data: missions, error: mErr } = await supabaseClient
      .from('missions')
      .select('*')
      .eq('game_id', game.id)
      .eq('channel', channel)
      .order('order_index', { ascending: true });
    if (mErr) throw mErr;

    const missionIds = missions.map((m: any) => m.id);
    let missionMedia: any[] = [];
    if (missionIds.length) {
      const { data: mm } = await supabaseClient
        .from('mission_media')
        .select('mission_id, role, slot, media:media(*)')
        .in('mission_id', missionIds);
      missionMedia = mm || [];
    }

    const { data: devices } = await supabaseClient
      .from('devices')
      .select('*')
      .eq('game_id', game.id)
      .eq('channel', channel);

    return {
      props: {
        slug,
        channel,
        game,
        config: configs?.[0]?.config || null,
        missions,
        devices,
        missionMedia
      }
    };
  } catch (e: any) {
    return { props: { error: e.message || 'Failed to load game' } };
  }
}

export default function GamePage(props: any) {
  if (props.error) {
    return <main style={{padding:20}}><h1>Game Error</h1><p>{props.error}</p></main>;
  }
  const { game, config, missions, devices, missionMedia } = props;
  return (
    <>
      <Head>
        <title>{game.title} • ESX Game</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <h1>{game.title}</h1>
        {config?.map && (
          <p>Map center: {config.map.centerLat}, {config.map.centerLng} (zoom {config.map.defaultZoom})</p>
        )}

        <section>
          <h2>Missions ({missions.length})</h2>
          <ul>
            {missions.map((m: any) => (
              <li key={m.id}>
                <strong>{m.title}</strong> <em>({m.type})</em>
                <div style={{fontSize:12, opacity:0.8}}>slug: {m.mission_slug}</div>
                <div style={{marginTop:6}}>
                  {missionMedia.filter((x: any) => x.mission_id === m.id).map((x: any) => (
                    <div key={x.media.id + ':' + x.role + ':' + x.slot}>
                      <span>{x.role}</span>: <a href={x.media.public_url} target="_blank" rel="noreferrer">{x.media.slug}</a>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Devices ({devices.length})</h2>
          <ul>
            {devices.map((d: any) => (
              <li key={d.id}>
                <strong>{d.device_key}</strong> <em>({d.type})</em> — {d.lat},{d.lng} r={d.pickup_radius}m
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
