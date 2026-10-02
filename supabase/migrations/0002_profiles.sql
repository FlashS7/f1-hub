-- F1 HUB v2: one profile per person across the whole app.
-- Every profile is automatically in the global league and can join any number of private leagues.
-- One pick per round per profile counts in all of that person's leagues.
-- Additive only: v1 tables stay until the data is copied over (scripts/migrate-to-profiles.mjs).

create table profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 2 and 20),
  pin_hash text not null,
  team_id text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_nickname on profiles (lower(nickname));

create table profile_devices (
  token_hash text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index profile_devices_profile on profile_devices (profile_id);

create table login_attempts (
  id bigint generated always as identity primary key,
  nickname_lower text not null,
  ip text not null,
  created_at timestamptz not null default now()
);
create index login_attempts_nick on login_attempts (nickname_lower, created_at);
create index login_attempts_ip on login_attempts (ip, created_at);

alter table leagues
  add column is_global boolean not null default false,
  add column owner_profile_id uuid references profiles(id) on delete set null;
create unique index leagues_single_global on leagues (is_global) where is_global;

-- Private league membership. The global league has no rows here: everyone is in it.
create table league_members (
  league_id uuid not null references leagues(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, profile_id)
);
create index league_members_profile on league_members (profile_id);

create table picks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  season int not null,
  round int not null,
  round_type text not null check (round_type in ('SQ', 'SPRINT', 'QUALI', 'RACE')),
  picks text[] not null check (cardinality(picks) = 10 and picks_distinct(picks)),
  fastest_lap text,
  updated_at timestamptz not null default now(),
  unique (profile_id, season, round, round_type)
);
create index picks_round on picks (season, round, round_type);

create table pick_scores (
  pick_id uuid primary key references picks(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  season int not null,
  round int not null,
  round_type text not null,
  total numeric not null check (total >= 0),
  exact int not null default 0,
  slots int not null default 0,
  breakdown jsonb not null,
  scored_at timestamptz not null default now()
);
create index pick_scores_season on pick_scores (season, profile_id);
create index pick_scores_round on pick_scores (season, round, round_type);

alter table profiles enable row level security;
alter table profile_devices enable row level security;
alter table login_attempts enable row level security;
alter table league_members enable row level security;
alter table picks enable row level security;
alter table pick_scores enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
