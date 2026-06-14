## Scope Recap

You selected: DMs · Clubs (text) · Clans + Clan Wars + Player Search · 1v1 Challenges + Escrow (mock $) · Tournaments + Leaderboards · Google + Email auth · Real API for one provider (TBD).

I'll deliver this in three approval rounds so each layer is testable before the next lands.

## Clarifying decision needed before round 3

**Clubs vs Clans** — your prompt has "Clubs" (general communities) and you also asked for "Clans" (competitive teams that challenge other clans). I'll build them as two distinct concepts:
- **Clubs** = social community, text channels, any size, roles Owner/Officer/Member/Recruit.
- **Clans** = competitive roster (≤50), tagged, ELO rating, can issue/accept clan-war challenges vs another clan.

**Real API provider** — pick one: Tracker.gg (easiest, covers Apex/Valorant/CoD via single key), Riot (Valorant/LoL only, requires production approval), or Steam WebAPI (CS2/Dota, free key). I'll wire it in Round 3.

## Round 1 — Communication core

Migration:
- `conversations` (1v1, unique pair), `conversation_participants`, `direct_messages` (text + image_url + read_at), `typing_indicators` (ephemeral via Realtime broadcast — no table)
- Storage bucket `dm-attachments` (private, RLS by participant)
- Enable Realtime on `direct_messages`
- `clubs`, `club_members` (role enum), `club_channels`, `club_messages`
- RLS scoped to participant / club_member; GRANTs to authenticated + service_role

UI:
- New `ChatTab` rewrite: conversations list → message thread, attachment upload, typing dots, read receipts
- New `ClubsTab` rewrite: club list → channel list → message feed
- Google sign-in button on `/auth` using `lovable.auth.signInWithOAuth("google", ...)` + `configure_social_auth(["google"])`

## Round 2 — Competitive: Clans, Player Search, 1v1 Challenges

Migration:
- `clans` (tag, name, elo default 1000, owner_id), `clan_members` (role: leader/officer/member), `clan_invites`
- `challenges` (challenger_id, opponent_id, game, wager_points, status: pending/accepted/live/disputed/settled, winner_id)
- `clan_wars` (clan_a, clan_b, format, wager_points, status, winner_clan)
- `wallets` (user_id, balance_points), `escrow_transactions` (challenge_id|war_id, amount, status: held/released/refunded)
- Trigger: on challenge `accepted` → debit both wallets, insert held escrow rows; on `settled` → credit winner minus rake
- Function `public.settle_challenge(_id uuid, _winner uuid)` SECURITY DEFINER

UI:
- `FindTab` enhancement: full-text search across profiles (username, bio, badges, linked gamertags) + filter pills (platform, rank, region, playstyle)
- New `ClansTab`: my clan dashboard, browse clans, create/join, issue clan-war challenge
- 1v1 challenge modal from any profile: pick game, wager points, send → notification on opponent

## Round 3 — Tournaments, Leaderboards, Real API ingest

Migration:
- `tournaments` (game, format, entry_fee, rake_pct, starts_at, ends_at, status), `tournament_entries`, `leaderboard_entries` (entry_id, metric, value, recorded_at)
- Computed view `tournament_payout` applying `P = (E*N)*(1-R)`
- `webhook_events` (raw payload archive), `account_verification_checks` (lifetime_hours, audit_flags jsonb)

Server routes (TanStack `/api/public/*`):
- `/api/public/webhooks/<provider>` — HMAC-verified ingest → `webhook_events` → upsert `leaderboard_entries`
- `/api/public/cron/stat-poll` — pg_cron hits this hourly to pull stats from chosen provider

Anti-cheat:
- Trigger on `leaderboard_entries` insert → audit-flag if stat delta > N stddev vs user history → freeze any open escrow tied to user

UI:
- `MediaTab` upgrade: real upload to `clips` bucket, upvote, comments, pin top 3 to profile
- New `TournamentsTab`: browse, enter, live leaderboard subscribed via Realtime

## Cross-cutting

- All new tables follow the GRANT → ENABLE RLS → CREATE POLICY pattern, scoped to `auth.uid()`.
- All server-fn admin work uses `await import("@/integrations/supabase/client.server")` inside `.handler()`.
- No real money — `wallets.balance_points` is internal currency, seeded with 1000 on signup via `handle_new_user`.
- Steam/Discord/PSN sign-in stays as **linked accounts** (manual gamertag entry + later OAuth bridge), not auth providers.

## What I need from you to start Round 1

1. Approve this plan.
2. Confirm Clubs-vs-Clans split above is what you want (or tell me to merge).
3. Pick the real-API provider for Round 3 (Tracker.gg / Riot / Steam) — not blocking Round 1.

On approval I'll ship Round 1 (migration + Chat/Clubs UI + Google auth) in one go.