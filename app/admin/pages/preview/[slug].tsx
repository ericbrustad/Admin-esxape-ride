import React from 'react';
import Head from 'next/head';
import { getServiceClient } from '../../lib/supabase/client';

export async function getServerSideProps(ctx: any) {
  const slug = ctx.params?.slug;
  if (!slug) return { notFound: true };
  const svc = getServiceClient(); // server-only

  // Read DRAFT safely with service role
  const { data: game } = await svc.from('games').select('*').eq('slug', slug).maybeSingle();
  if (!game) return { notFound: true };

  const { data: cfg } = await svc
    .from('game_configs')
    .select('config')
    .eq('game_id', game.id)
    .eq('channel', 'draft');

  const { data: missions } = await svc
    .from('missions')
    .select('*')
    .eq('game_id', game.id)
    .eq('channel', 'draft')
    .order('order_index', { ascending: true });

  const missionIds = (missions || []).map((m: any) => m.id);

  const { data: missionMedia } = missionIds.length
    ? await svc
        .from('mission_media')
        .select('mission_id, role, slot, media:media(*)')
        .in('mission_id', missionIds)
    : { data: [] as any[] };

  const { data: devices } = await svc
    .from('devices')
    .select('*')
    .eq('game_id', game.id)
    .eq('channel', 'draft');

  return {
    props: {
      game,
      config: cfg?.[0]?.config || null,
      missions: missions || [],
      devices: devices || [],
      missionMedia: missionMedia || [],
    },
  };
}

export default function AdminDraftPreview(props: any) {
  const { game, config, missions, devices, missionMedia } = props;
  return (
    <>
      <Head><title>Admin Draft Preview • {game?.title}</title></Head>
      <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <h1>Draft Preview — {game?.title}</h1>
        {config?.map && (
          <p>Map center: {config.map.centerLat}, {config.map.centerLng} (zoom {config.map.defaultZoom})</p>
        )}

        <h2>Missions ({missions.length})</h2>
        <ul>
          {missions.map((m: any) => (
            <li key={m.id}>
              <strong>{m.title}</strong> <em>({m.type})</em> <small>slug: {m.mission_slug}</small>
              <div style={{ marginTop: 6 }}>
                {(missionMedia || [])
                  .filter((x: any) => x.mission_id === m.id)
                  .map((x: any) => (
                    <div key={x.media.id + ':' + x.role + ':' + x.slot}>
                      <span>{x.role}</span>: <a href={x.media.public_url} target="_blank" rel="noreferrer">{x.media.slug}</a>
                    </div>
                  ))}
              </div>
            </li>
          ))}
        </ul>

        <h2>Devices ({devices.length})</h2>
        <ul>
          {devices.map((d: any) => (
            <li key={d.id}><strong>{d.device_key}</strong> <em>({d.type})</em> — {d.lat},{d.lng} r={d.pickup_radius}m</li>
          ))}
        </ul>
      </main>
    </>
  );
}
