# rostr Master Update — Phased Plan

Scope is too large for one turn. I'll ship in 5 phases. After each phase you confirm it works, then I move on. This avoids regressions and keeps credits sane.

## Phase 1 — Critical bug fixes (frontend-only, ships first)

- **Tab-switch crash**: add `AbortController` + `isMounted` ref in `Shell.tsx` tab effects and every async fetch in `ClubsTab`, `MediaTab`, `FriendsTab`, `ChatTab`, `ProfileTab`. Cancel in-flight Supabase queries on unmount.
- **Media buffering crash**: wrap `ReelsView` and `MediaTab` video players in an ErrorBoundary that renders a skeleton instead of the white "page didn't load" screen. Debounce `play()` calls; swallow `AbortError`.
- **Auth loop**: audit `use-auth.tsx` — already filters event types, but verify `router.invalidate()` isn't fighting the `_authenticated` gate. Add `INITIAL_SESSION` ignore.
- **Avatar fallback**: central `<Avatar>` wrapper that swaps to initials on `onError`. Apply across all consumers.
- **Friend mutations**: read `friends` table policies, fix the insert/accept RPC if mutation is rejected.
- **Payment null state**: guard `StripeEmbeddedCheckout` against missing `clientSecret`.

## Phase 2 — Theme engine, fonts, palettes, light mode

- Install via `bun add @fontsource-variable/plus-jakarta-sans @fontsource/bebas-neue @fontsource-variable/geist`. Neue Haas Grotesk is proprietary — substitute with **Inter Tight** (closest free analog) and label it "Neue Haas" in the picker, or skip if you want strict licensing.
- Extend `customization.ts` with `FONT_FAMILIES` = {jakarta, neueHaas, bebas, geist} and `BACKGROUNDS` palette set: Crimson Cobalt, Neon Navy, Purple Cream, Party Pinky, Cyber Mint, Midnight Obsidian, Slate Minimal. Each palette ships paired dark+light tokens.
- Rewrite light-mode tokens in `styles.css` so every surface/border/text variable has a tested contrast pair. Use `oklch` with L≥0.95 for surfaces and L≤0.25 for foregrounds.
- Settings → `ThemeCustomizer` already wires `applyCustomization`; verify propagation by tagging `<html>` with `data-palette` and reading from CSS vars only (no hard-coded `text-white`).

## Phase 3 — Signature gradients + 360° hover + micro-interactions

- 5 gradient utilities in `styles.css`: `@utility gradient-dusk/arctic/solar-flare/neon-tide/quantum-void`.
- `@utility rotating-border`: conic-gradient mask, 6s linear infinite rotate. Applied to `<Card variant="hot">` and primary buttons.
- Chromatic pulse `@keyframes` on `:active` for toggle/like buttons.
- Spring transitions via existing framer-motion (or CSS cubic-bezier presets).

## Phase 4 — Full-screen reels + bottom tabs + comment tray + density

- `ReelsView`: `h-[100dvh] w-screen fixed inset-0`, snap-y mandatory. Hide Shell chrome when reels active.
- Shell bottom nav: shrink to `h-12`, `text-[10px]`, overlay with `backdrop-blur` over reels.
- Comments: slide-up `<Sheet side="bottom">` at 60vh, scrollable, doesn't push video.
- Density: `data-layout-density` already wired (`styles.css` line ~240). Audit components still using hardcoded `p-4`/`gap-4` and switch to `p-(--spacing)`-driven utilities.

## Phase 5 — Backend (Steam, calls, payments, reports)

- **Steam OAuth**: requires `STEAM_WEB_API_KEY` secret. I'll request it via `add_secret` and wire `/api/public/steam.return.ts` (file already exists). Ship a hardcoded top-100 Steam game catalog JSON for selection.
- **WebRTC calls**: peer connection via Supabase Realtime channel for SDP/ICE signaling. Google STUN. Reuse existing `CallSheet.tsx`.
- **Club governance**: SQL trigger `enforce_single_club_membership` already exists — verify it's active. Add banner upload to `clubs` table + storage. Resign/Draw fields on `club_wars`.
- **Reporting**: `user_reports` table exists. Extend `ReportDialog` with reason categories + chat-log attachment. **No email** (per your choice) — admin views via moderation route.
- **Payments**: 720p cap already in `uploadPricing.ts`. Add PayPal + Twint via Stripe Checkout `payment_method_types: ['card','paypal','twint']`. Exponential cost helper already exists server-side.

## Technical notes

- Neue Haas Grotesk: no free webfont exists. Confirm substitute with **Inter Tight** or pay for license elsewhere.
- WebRTC group calls (>2 peers) need an SFU; I'll ship 1:1 only.
- Twint requires the Stripe account to be in CH and enabled in Stripe Dashboard — I'll wire the code, but it won't show up at checkout until the user enables it on their Stripe side.
- Steam OAuth requires you (the developer) to register at https://steamcommunity.com/dev/apikey and paste the key when prompted.

## Order of execution

I'll start **Phase 1 immediately** on your approval. Reply "go" or specify a different starting phase.
