-- Ideas and bug reports from players. Only the admin reads them (through the server).

create table feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('idea', 'bug')),
  message text not null check (char_length(message) between 3 and 2000),
  contact text check (char_length(contact) <= 200),
  page text check (char_length(page) <= 300),
  user_agent text check (char_length(user_agent) <= 400),
  profile_id uuid references profiles(id) on delete set null,
  ip_hash text not null,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index feedback_status on feedback (status, created_at desc);
create index feedback_ip on feedback (ip_hash, created_at);

alter table feedback enable row level security;
revoke all on feedback from anon, authenticated;
grant all on feedback to service_role;
