This pass is genuinely huge. To ship it end-to-end without leaving half-broken surfaces behind, I want to do it in 5 sequenced sub-batches inside this one turn, in this order. Each sub-batch is independently shippable so if we hit a snag we still land value.

## Sub-batch 1 — Fix "ghost platform" (highest impact, do first)

Root causes I can already see from the network log:
- Search shows no users because `profiles` SELECT policy filters out non-public rows and most seeded/real users have `is_public` = false or never set → widen the public-profile discovery predicate and audit `search_all`.
- Clubs "constant loading" is a client bug: the Clubs tab already receives club rows in <200 ms (network confirms), so the spinner is a state bug in `ClansTab.tsx` / `ClubsTab.tsx` loader — not a data bug. Fix the loading flag + add error surface + `try/finally`.
- DM to real user "silently fails": likely the same pattern as Friends — the row inserts but the recipient's realtime channel key is stale after our earlier randomization, or the conversation row is created but the recipient can't `SELECT` it under RLS. Verify `conversations` + `direct_messages` policies cover both participants, add a `getOrCreateConversation` server round-trip check, and surface send errors with a toast instead of swallowing.
- Add a real "Add friend" button on public profile / search result cards that calls a `send_friend_request` RPC (idempotent) so adds actually create a `friends` row with `status='pending'`.

## Sub-batch 2 — Universal light/dark that actually works

- Split `src/styles.css` into `:root` (light) + `.dark` (dark) token sets so **every** palette (Editorial Sport, Ink & Cream, all 8 backgrounds) has both variants. Right now several palettes only define dark tokens.
- Theme controller already writes `.dark` — verify each `@theme inline` mapping resolves in both modes and re-verify contrast at 4.5:1 minimum for body / 3:1 for large text using Playwright + axe-core sweep on 6 key routes (index, /shop, /inbox, /u/$handle, /pricing, settings sheet open).
- Add a visible "Theme" toggle at the top of the Look & Feel accordion (currently buried inside `ThemeCustomizer`).

## Sub-batch 3 — Batch C §1 Post-Game Quick Rate

- New table `match_ratings(rater_id, rated_id, challenge_id?, tournament_id?, thumbs, tag, created_at)` with unique `(rater_id, rated_id, coalesce(challenge_id, tournament_id))`.
- RLS: insert only when the pair actually shares a completed challenge/tournament match (checked via subquery). Aggregate-only SELECT for others; individual rows never leak.
- SECURITY DEFINER `rating_summary(_user_id)` returning `{positive_pct, total, top_tags[]}`, gated at `total >= 5` (returns null pct below threshold).
- Post-match prompt component `<PostGameRatePrompt />` mounted on the challenges tab after settlement, one-tap thumb + tag chip, dismissible, dedup'd per match.
- Profile card `<TrustSignalCard />` on `/u/$handle`.

## Sub-batch 4 — Batch C §2 Chemistry Score

- SQL view/function `chemistry_pair(_a, _b)` aggregating over `challenges` + `club_wars` where both users participated: `games_together, wins_together, current_streak, last_played_at, trend_last5`.
- Only computed from Rostr-native tracked matches (no external stat APIs).
- `<ChemistryCard />` on `/u/$handle` — hidden entirely when `games_together = 0`. Win% hidden below 3 games.
- Friends list gets a "Best duo" badge on highest chemistry pair.

## Sub-batch 5 — Batch C §3 Voice Snippets + branding + tests

- New table `voice_snippets(user_id PK, storage_path, duration_seconds, created_at)` — one row per user (PK is user_id so re-record UPSERTs).
- Reuse `media-clips` bucket with a `voice/` prefix + storage RLS.
- 15 s hard cap client (MediaRecorder auto-stop) + server (trigger rejects `duration_seconds > 15`).
- `<VoiceSnippet />` player with tap-to-play (no autoplay), reused on profile header + swipe deck. Age-gated: only rendered when viewer + owner both passed 16+ gate (profiles.date_of_birth check).
- Report action routes through existing `ReportDialog` with `kind='voice_snippet'`.
- Shard label normalization: sweep for any remaining "token(s)" strings in user-facing UI, replace with "Shard(s)"; internal column names stay `balance_points` / `token_transactions` (schema is fine, don't touch).
- Logo unification: audit all `<RostrMark>` / `<img src=logo>` usages, force everyone to `<RostrMark>` with size prop only.
- **UI test coverage** (Vitest components + Playwright flows):
  - Vitest: `<RostrMark>`, `<ShardIcon>`, `<GlowButton>`, `<UserAvatar>`, `<EmptyState>`, `<TrustSignalCard>`, `<ChemistryCard>`, `<VoiceSnippet>` — render + prop variants + accessibility roles.
  - Playwright flows against `http://localhost:8080`: sign in via injected session → send DM to a real friend and assert recipient row → swipe LFG card and assert `lfg_ad_interactions` insert → buy shard item and assert wallet debit + inventory row → equip cosmetic and assert `data-halo` on rendered avatar → toggle light/dark and assert `documentElement.classList` + computed contrast on body text.
  - CI wire-up in `.github/workflows/ci.yml` to run `bun test` + `bunx playwright test` on PR.

## Migration budget

3 migrations total: (1) match_ratings + RPC + policies, (2) chemistry view/function, (3) voice_snippets + storage policies + duration trigger. Grouped by feature so each is reviewable in isolation.

## What I'm NOT doing this pass (explicit)

- No external game-API stat integration for Chemistry (per spec §4).
- No voice snippet library / multiple clips per user.
- No public per-user rating history — aggregate only, hard requirement.
- No changes to the `balance_points` column name (breaking, unnecessary — only the user-facing label needs to say "Shards").

## Order & checkpoints

I ship 1 → 2 → 3 → 4 → 5. After sub-batch 1 and after sub-batch 2 I'll do a quick Playwright smoke to confirm the "real users appear + clubs open + DM lands" before piling Batch C features on top. If any sub-batch turns into a rabbit hole (e.g. RLS on `match_ratings` needs a schema change to challenges to add `winner_settled_at`), I'll stop, report, and get your call before proceeding.

Approve to start, or tell me to reorder / drop a sub-batch.