create extension if not exists pgcrypto;

-- 1) games + configs
create table if not exists games (
  id text primary key,
  slug text unique not null,
  title text not null,
  type text default 'Mystery',
  mode text default 'single',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists game_configs (
  id text primary key,
  game_id text references games(id) on delete cascade,
  channel text not null check (channel in ('draft','published')),
  config jsonb not null,
  created_at timestamptz default now()
);

-- 2) missions
create table if not exists missions (
  id text primary key,
  game_id text references games(id) on delete cascade,
  mission_slug text not null,
  title text not null,
  type text not null,
  rewards_points int default 0,
  content jsonb not null,
  order_index int default 0,
  channel text not null check (channel in ('draft','published')),
  created_at timestamptz default now()
);
create unique index if not exists uq_mission_slug_per_game_channel
  on missions(game_id, channel, mission_slug);

-- 3) devices
create table if not exists devices (
  id text primary key,
  game_id text references games(id) on delete cascade,
  device_key text not null,
  type text not null,
  lat double precision,
  lng double precision,
  pickup_radius int default 100,
  effect_seconds int default 120,
  icon_key text default '',
  channel text not null check (channel in ('draft','published')),
  created_at timestamptz default now()
);
create unique index if not exists uq_device_key_per_game_channel
  on devices(game_id, channel, device_key);

-- 4) media library (global) + tagging
create table if not exists media (
  id text primary key,
  slug text unique not null,
  name text,
  kind text not null, -- image|video|audio|gif|ar-overlay|other
  bucket text not null,
  path text not null,
  public_url text not null,
  tags text[] default '{}',
  width int,
  height int,
  bytes bigint,
  created_at timestamptz default now()
);

-- 5) mission ↔ media assignments
create table if not exists mission_media (
  mission_id text references missions(id) on delete cascade,
  media_id text references media(id) on delete cascade,
  role text not null, -- cover|background|overlay|reward|hint|prompt
  slot int default 0,
  primary key (mission_id, media_id, role, slot)
);

-- 6) publish snapshot RPC copies draft → published
create or replace function publish_game(p_game_slug text)
returns void
language plpgsql
as $$
declare
  g games;
begin
  select * into g from games where slug = p_game_slug;
  if g.id is null then
    raise exception 'game not found';
  end if;

  -- wipe previous published snapshot
  delete from mission_media where mission_id in (
    select id from missions where game_id = g.id and channel = 'published'
  );
  delete from game_configs where game_id = g.id and channel = 'published';
  delete from missions     where game_id = g.id and channel = 'published';
  delete from devices      where game_id = g.id and channel = 'published';

  -- copy draft → published
  insert into game_configs(id, game_id, channel, config)
    select md5(gen_random_uuid()::text), game_id, 'published', config
    from game_configs where game_id = g.id and channel = 'draft';

  insert into missions(id, game_id, mission_slug, title, type, rewards_points, content, order_index, channel)
    select 'pub_'||id, game_id, mission_slug, title, type, rewards_points, content, order_index, 'published'
    from missions where game_id = g.id and channel = 'draft';

  insert into devices(id, game_id, device_key, type, lat, lng, pickup_radius, effect_seconds, icon_key, channel)
    select 'pub_'||id, game_id, device_key, type, lat, lng, pickup_radius, effect_seconds, icon_key, 'published'
    from devices where game_id = g.id and channel = 'draft';

  insert into mission_media(mission_id, media_id, role, slot)
    select 'pub_'||mm.mission_id, mm.media_id, mm.role, mm.slot
    from mission_media mm
    join missions m on m.id = mm.mission_id
    where m.game_id = g.id and m.channel = 'draft';
end $$;

-- RLS
alter table games         enable row level security;
alter table game_configs  enable row level security;
alter table missions      enable row level security;
alter table devices       enable row level security;
alter table mission_media enable row level security;
alter table media         enable row level security;

-- public SELECTs
do $$ begin
  if not exists (select 1 from pg_policies where polname='public_read_games') then
    create policy public_read_games on games for select to public using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='public_read_configs_published') then
    create policy public_read_configs_published on game_configs for select to public using (channel='published');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='public_read_missions_published') then
    create policy public_read_missions_published on missions for select to public using (channel='published');
  end if;
  if not exists (select 1 from pg_policies where polname='public_read_devices_published') then
    create policy public_read_devices_published on devices for select to public using (channel='published');
  end if;
  if not exists (select 1 from pg_policies where polname='public_read_mm_by_published_mission') then
    create policy public_read_mm_by_published_mission on mission_media for select to public using (
      mission_id like 'pub\_%'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where polname='public_read_media') then
    create policy public_read_media on media for select to public using (true);
  end if;
end $$;
