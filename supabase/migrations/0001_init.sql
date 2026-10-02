-- F1 HUB schema.
-- Access model: the browser never talks to the database. All reads/writes go through
-- Next.js route handlers using the service-role key. RLS is enabled with NO policies,
-- so the public anon key can't read or write anything even if it leaks.

create extension if not exists pgcrypto;

create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  owner_player_id uuid,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  pin_hash text not null,
  team_id text not null,
  created_at timestamptz not null default now()
);
create unique index players_league_nickname on players (league_id, lower(nickname));

alter table leagues
  add constraint leagues_owner_fk foreign key (owner_player_id) references players(id) on delete set null;

-- One row per logged-in device. Only the SHA-256 of the token is stored.
create table player_devices (
  token_hash text primary key,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index player_devices_player on player_devices (player_id);

-- Failed PIN attempts, used for rate limiting reclaim-by-PIN.
create table pin_attempts (
  id bigint generated always as identity primary key,
  league_id uuid not null references leagues(id) on delete cascade,
  nickname_lower text not null,
  ip text not null,
  created_at timestamptz not null default now()
);
create index pin_attempts_target on pin_attempts (league_id, nickname_lower, created_at);
create index pin_attempts_ip on pin_attempts (ip, created_at);

create function picks_distinct(p text[]) returns boolean
  language sql immutable
  as $$ select count(distinct x) = cardinality(p) from unnest(p) as x $$;

create table predictions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  league_id uuid not null references leagues(id) on delete cascade,
  season int not null,
  round int not null,
  round_type text not null check (round_type in ('SQ', 'SPRINT', 'QUALI', 'RACE')),
  picks text[] not null check (cardinality(picks) = 10 and picks_distinct(picks)),
  fastest_lap text,
  updated_at timestamptz not null default now(),
  unique (player_id, season, round, round_type)
);
create index predictions_round on predictions (season, round, round_type);
create index predictions_league on predictions (league_id, season);

-- Official results as fetched from the APIs (shared across leagues).
create table session_results (
  season int not null,
  round int not null,
  round_type text not null check (round_type in ('SQ', 'SPRINT', 'QUALI', 'RACE')),
  positions jsonb not null,
  fastest_lap text,
  fetched_at timestamptz not null default now(),
  primary key (season, round, round_type)
);

create table round_scores (
  prediction_id uuid primary key references predictions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  league_id uuid not null references leagues(id) on delete cascade,
  season int not null,
  round int not null,
  round_type text not null,
  total numeric not null check (total >= 0),
  breakdown jsonb not null,
  scored_at timestamptz not null default now()
);
create index round_scores_league on round_scores (league_id, season);

-- Lock everything down: RLS on, no policies, no grants for anon/authenticated.
alter table leagues enable row level security;
alter table players enable row level security;
alter table player_devices enable row level security;
alter table pin_attempts enable row level security;
alter table predictions enable row level security;
alter table session_results enable row level security;
alter table round_scores enable row level security;

revoke all on all tables in schema public from anon, authenticated;
