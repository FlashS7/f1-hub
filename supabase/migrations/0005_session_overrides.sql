-- Manual start-time corrections (delays) set by the admin. The APIs only know the original schedule.
create table if not exists session_overrides (
  season int not null,
  round int not null,
  session_key text not null check (session_key in ('FP1', 'FP2', 'FP3', 'SQ', 'SPRINT', 'QUALI', 'RACE')),
  start timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (season, round, session_key)
);

alter table session_overrides enable row level security;
revoke all on session_overrides from anon, authenticated;
grant all on session_overrides to service_role;
