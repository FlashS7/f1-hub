-- Web push reminders: "<session> starts in 10 minutes".

create table push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  p256dh text not null,
  auth text not null,
  -- 'all' = every session incl. practice; 'main' = sprint qualifying, sprint, qualifying, race
  scope text not null default 'all' check (scope in ('all', 'main')),
  profile_id uuid references profiles(id) on delete set null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);

-- One row per session we've announced, so a reminder goes out exactly once.
create table push_log (
  session_id text primary key, -- e.g. "2026-17-QUALI"
  sent_at timestamptz not null default now(),
  recipients int not null default 0
);

alter table push_subscriptions enable row level security;
alter table push_log enable row level security;
revoke all on push_subscriptions, push_log from anon, authenticated;
grant all on push_subscriptions, push_log to service_role;

-- Every-minute trigger for /api/cron/notify (Vercel's free cron only runs daily).
-- Run separately with the real CRON_SECRET in place of <CRON_SECRET>:
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule('f1hub-notify', '* * * * *', $$
--   select net.http_get(
--     url := 'https://f1-hub-nu.vercel.app/api/cron/notify',
--     headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--   );
-- $$);
