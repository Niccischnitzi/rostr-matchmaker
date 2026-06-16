# Remaining sprints for rostr

Sprint 1 (layout + theme + 1-club lock) is shipped. Below is everything left from the master prompt, grouped so each sprint is independently shippable and you can stop me between any of them.

## Sprint 2 — Reporting infrastructure + admin email

**Scope**
- `ReportDialog` component: reason category (Cheating, Harassment, Sexual, Hate, Spam, Underage, Other), free-text details (≤1000 chars), optional proof attachment (image/clip upload to existing `dm-attachments` bucket), captured context (route, target id, target type, app version, user agent).
- Wire the dialog into ProfileTab, MediaTab post menu, ChatTab message long-press, and CrewsTab card menu (currently `reportTarget` is used in only one place).
- Server function `submitReport` (`createServerFn` + `requireSupabaseAuth`) that:
  1. inserts into `user_reports` with the structured payload,
  2. enqueues an admin email to `nicolas.amacker2010@gmail.com` via the Lovable Emails queue.
- React Email template `report-alert.tsx` with reporter handle, target link, reason, details, attached proof URL, and a deep-link into `/moderation`.
- Toast UX: "Thanks — our moderators have been notified."

**Prereq (you must action)**
The Lovable Emails domain is not configured yet. I'll trigger the setup dialog at the start of this sprint; once you complete it, I continue automatically. If you'd rather not configure a domain today, I'll ship the DB + dialog and stub the email call so it activates the moment a domain is live.

## Sprint 3 — Reels tab + 720p free-tier cap + exponential upload cost

**Scope**
- New `ReelsTab` (vertical snap-scroll feed) added under Media as a second sub-tab; reuses `media_posts` filtered by `aspect_ratio < 1`.
- Client-side video probe before upload: reject >720p for non-Pro users, allow up to 1080p for Pro.
- Exponential token cost per upload in the same UTC day: `cost(n) = 5 * 2^n` capped at 320. New `media_uploads_today` RPC counts today's posts; `spend_tokens` already enforces balance.
- UI: cost preview in the upload sheet ("Next upload: 20 tokens — you've posted 2 today").
- GPU-smooth snap container with `scroll-snap-stop: always`, `will-change: transform`, prefetch next 2 videos.

**No external prereq.**

## Sprint 4 — Steam OpenID (live) + linked account display

**Scope**
- Server route `/api/public/steam/return` performing the OpenID 2.0 `check_authentication` round-trip against `https://steamcommunity.com/openid/login`.
- Server function `linkSteam` that, after verification, hits `ISteamUser/GetPlayerSummaries` with the Steam Web API key and writes `provider='steam'`, `external_id`, `display_name`, `avatar_url` into `linked_accounts`.
- `SteamConnectButton` in SettingsSheet + ProfileTab; shows linked Steam persona + avatar once connected.
- One-club-style guard: a Steam id can only link to one rostr account.

**Prereq (you must action)**
I'll add the secret request for `STEAM_WEB_API_KEY` at the start of this sprint. You'll also need to register the production domain (https://project--d0c91221-1d8a-4b41-873d-75e62af876ea.lovable.app and your custom domain when live) at https://steamcommunity.com/dev/apikey. The route will work in preview but Steam's allowlist gates the live domain.

## Sprint 5 — Twint via Stripe + club customization

**Twint**
- Add `payment_method_types: ['card', 'twint']` to the CH checkout session in `payments.functions.ts` (Stripe handles the rest).
- Detect CH user via existing `cf-ipcountry` probe and surface Twint as the default option.

**Prereq (you must action)**
Twint must be activated on your Stripe account (Stripe Dashboard → Settings → Payment methods → Twint → Turn on). Until you do, sessions with `twint` will 400.

**Club customization**
- Owner-only "Club appearance" sheet: club accent color, banner image (Storage `avatars` bucket), short tagline, motto.
- New `clubs.accent`, `clubs.banner_url`, `clubs.tagline` columns + migration with GRANTs.
- ClubsTab card + ClubWars header use the club accent as a local CSS-var override scoped to the club view (does not change the user's global theme).

**No further external prereq beyond Stripe Twint activation.**

---

## Technical notes
- All new server functions use `createServerFn` + `requireSupabaseAuth` (per server-side-modern rules); webhooks (Steam return) live under `/api/public/*`.
- All DB migrations include `GRANT` blocks per public-schema-grants rule.
- React Email template body bg stays `#ffffff` per email guide.
- Theme stays global; club customization is scoped via a nested CSS-var override only inside the club view, not via the global `applyCustomization`.

## Proposed execution order
1. Sprint 2 (Reports + Email) — needs email domain setup from you.
2. Sprint 3 (Reels + pricing) — no prereqs, fastest.
3. Sprint 4 (Steam live) — needs Steam Web API key from you.
4. Sprint 5 (Twint + club customization) — needs Twint enabled in Stripe.

Tell me to "start" and I'll begin Sprint 2 with the email-domain dialog. If you'd rather reorder (e.g. "do Sprint 3 first while I get the email domain ready"), say so and I'll switch.
