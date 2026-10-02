# F1 HUB

Race weekend hub + prediction league for friends. Live: https://f1-hub-nu.vercel.app

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4, Supabase Postgres, Vercel.
- **Data:** [Jolpica](https://api.jolpi.ca/ergast/f1/) for schedule, standings and results; [OpenF1](https://openf1.org) for Sprint Qualifying results (Jolpica has none).
- **Track outlines:** generated from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT): `npm run build:circuits`.

## Scoring rules

Everything lives in [`src/lib/scoring.config.ts`](src/lib/scoring.config.ts): slot points, bonuses, multipliers and the rounding rule.
The logic in `src/lib/scoring.ts` only reads that object. After changing it:

```bash
npm test
```

then commit and push. Vercel redeploys. Already scored rounds keep their old points until the league owner presses **Recalculate weekend** for that weekend.

## How it works

- One profile per person (nickname + 4-digit PIN + favourite team), created only when you first make a pick or join a league.
  Everyone is in the global league; private leagues are joined via invite link. One pick per round counts in all your leagues.
- The admin profile (`profiles.is_admin`) can rename/remove players and recalculate any league. Private league owners can recalculate theirs.
- Each weekend has up to four separate rounds (Sprint Qualifying, Sprint, Qualifying, Race), each locking at its session start. Locks are checked on the server.
- Other players' picks are never sent to the browser before a round locks.
- After a session ends (+20 min), results are fetched and scored lazily when someone opens the league, plus a daily cron at 06:00 UTC.
  OpenF1 blocks unauthenticated requests while any live session runs; Sprint Qualifying scoring then simply retries later.
- No accounts: nickname + 4-digit PIN (scrypt-hashed, rate limited 5 tries per nickname / 20 per IP per 15 min) and an httpOnly device cookie.
- Database: browser never talks to Supabase. RLS on with no policies; only the server's secret key has grants. Schema: `supabase/migrations/`.
  v1 tables (`players`, `predictions`, `round_scores`, `player_devices`, `pin_attempts`) are no longer used; their data was copied by `scripts/migrate-to-profiles.mjs`.

## Local dev

```bash
cp .env.example .env.local
```

Fill in the values, then:

```bash
npm install
```

```bash
npm run dev
```

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Where from |
| --- | --- |
| `SUPABASE_URL` | Supabase → Connect / Project Settings → Data API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) |
| `CRON_SECRET` | any long random string |
