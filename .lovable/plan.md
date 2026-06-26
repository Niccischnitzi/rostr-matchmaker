# Rostr — Mockup → Production Roadmap

Right now Rostr looks like a real app but most data is hard-coded in `src/lib/squadz-data.ts` and pushed through `SquadzProvider` (in-memory React state). Auth, theme, payments, and some Supabase tables are real; the social graph, media, clubs, chat, LFG, clips, and ranking are not. Here's what's needed to make it an actual product.

## 1. Real data layer (replace mock store)

Move every screen off `squadz-store.tsx` mock arrays onto Supabase tables with RLS + GRANTs:

- **profiles** (exists) — finish: bio, country, languages, primary games, rank, availability JSON.
- **friends / connections** (exists) — wire swipe → insert; mutual = match.
- **clubs, club_members, club_channels, club_messages** (exist) — bind ClubsTab + ChatTab to live data; add banner/logo storage bucket.
- **lfg_ads** (new) — host, game, mode, region, slots, expires_at; realtime list.
- **clips / media_posts** (new) — uploader, video_url, thumb_url, likes, views, duration; Storage bucket with 720p cap.
- **clip_likes, comments, reports** (new) — interactions + moderation.
- **clans, clan_members, challenges, tournaments, leaderboard_entries** (exist) — connect ClansTab, ChallengesTab, TournamentsTab to live queries.
- **wallets, transactions** (exist) — show real balance in profile.
- **presence** — Supabase Realtime channel for Online/In-Game/Busy/LFG status.

Each new public table: GRANT on insert/update/delete to `authenticated`, RLS scoped to `auth.uid()`, separate `user_roles` table for admin/mod (already noted in plan.md).

## 2. Real interactions

- **Swipe → friend request** instead of fake mock-id mapping.
- **Chat (DM + club)** via Supabase Realtime subscriptions on `direct_messages` / `club_messages`.
- **LFG ads**: create / join / auto-expire (pg_cron or `expires_at` filter).
- **Clip feed**: upload (signed URL → Storage), transcode/thumb (client-side capture or edge function), like/comment, report.
- **Reels autoplay**: already implemented; needs real video URLs + view counter RPC.
- **Notifications**: new friend, new message, club invite, LFG match — `notifications` table + bell badge.

## 3. Account & onboarding completeness

- Finish `OnboardingWizard` write-through (game picks, platforms, region, availability grid → profile).
- **Steam linking**: `STEAM_WEB_API_KEY` secret + `steam.return.ts` (file exists, needs key + UI completion).
- Add **PSN / Xbox / Riot / Epic / Discord** OAuth or manual handle entry into `linked_accounts` table.
- Password reset page (`/reset-password`) — currently missing.
- Avatar upload to Storage with the central `<Avatar>` fallback already planned.

## 4. Voice / video calls

- 1:1 WebRTC via Supabase Realtime for SDP/ICE signaling, Google STUN.
- `CallSheet.tsx` exists — wire it. Group calls (>2) need an SFU; out of scope for v1.

## 5. Payments (real money)

- Stripe Checkout for: upload-overage (exponential pricing helper exists), club boosts, tournament entry, cosmetics.
- Add **PayPal + Twint** to `payment_method_types` (Twint needs CH Stripe account).
- Webhook at `/api/public/payments/webhook` (file exists) → update `transactions` + `wallets`.
- PaymentTestModeBanner already there.

## 6. Moderation & safety

- `ReportDialog` → write to `user_reports` (table exists) with reason categories + optional chat log.
- `/moderation` route gated by `has_role(uid, 'admin')`.
- Block/mute lists, content takedown action, soft-delete on clips.

## 7. Discovery & growth

- Search (players, clubs, clips) via Postgres full-text or trigram.
- Public profile pages (`/u/$handle`) SSR-rendered for SEO with OG image per user.
- Public club pages (`/c/$slug`) likewise.
- Sitemap (exists) + per-route head() metadata for shareable links.

## 8. Polish & reliability

- Replace remaining `Loader2` spinners with skeleton-shine variants.
- Error boundaries on every tab (TabErrorBoundary exists — apply universally).
- AbortController on every Supabase fetch in tab effects (Phase 1 of existing plan.md).
- Empty states + retry UI for failed loads.
- Mobile: bottom nav over reels, sheet-based comments, 100dvh full-screen reels.
- Light mode contrast pass for every palette in ThemeCustomizer.

## 9. Legal / launch

- `/privacy`, `/terms`, `/community-guidelines` routes.
- Cookie/consent banner if targeting EU.
- Age gate (13+ / 16+ depending on region).
- Support email + report-abuse contact.
- Custom domain after first publish.

## Suggested phasing

```
Phase A  Data layer: schema + RLS + GRANTs for clips, lfg_ads, comments, likes, notifications
Phase B  Swap each tab off mock store → live Supabase queries + realtime
Phase C  Clip upload + Storage + reels backed by real videos
Phase D  Steam/PSN/Xbox linking + onboarding write-through
Phase E  Payments (Stripe Checkout + webhook + wallet credit)
Phase F  Calls (WebRTC 1:1) + notifications
Phase G  Moderation, public profiles/clubs, SEO, legal pages, launch
```

## Open questions before I start building

1. Which phase do you want first? (My recommendation: Phase A + B together — without real data nothing else matters.)
2. Clip uploads: cap at 720p / 60s / 50MB like the existing `uploadPricing.ts`, or different limits?
3. Which platform linking is must-have for v1? (Steam is half-wired; PSN/Xbox need their own API access.)
4. Payments at launch, or after first user cohort?
