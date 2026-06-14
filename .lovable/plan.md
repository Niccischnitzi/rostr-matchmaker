# Plan

## 1. Merge Clubs + Clans into one unified "Crews" surface
The "Clans" tab currently has 3 sub-tabs (Clans / Cups / Clubs). Since clubs (social hangout groups) and clans (competitive rosters) overlap a lot conceptually, I'll merge them into a single **Crews** list with a filter chip (`All · Competitive · Social`) backed by a new `kind` flag on the existing `clans` table (`'competitive' | 'social'`). Cups stays as its own sub-tab.

- Migration: add `kind` column to `clans` (default `'competitive'`), backfill old clubs.
- Migration: copy existing `clubs` rows into `clans` with `kind='social'`, then keep the `clubs` table around (read-only) for the chat channels feature. Club channels stay accessible from inside a "social" crew's detail view.
- New `CrewsTab.tsx` replacing `ClansTab` + `ClubsTab` in the sub-nav. Bottom nav becomes: **Find · Crews · Chat · Media · Me · Settings** (or settings as a gear in the header — see #3).
- `Shell.tsx` `ClansSub` becomes `'crews' | 'cups'`.

## 2. Fix the bugged neon gradient text
The `text-gradient-orange` utility in `src/styles.css` renders as a solid orange rectangle in the user's browser. Cause: missing `-webkit-text-fill-color: transparent` and no `display: inline-block`, so `background-clip: text` falls back to painting the box.

Fix: update the utility to:
```css
@utility text-gradient-orange {
  background-image: linear-gradient(135deg, var(--primary), oklch(0.78 0.18 55));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
```

## 3. Settings / Options menu
Add a gear icon in the desktop sidebar footer and mobile header that opens a `SettingsSheet` (shadcn Sheet) with:
- Theme (dark / system) — written to `localStorage`.
- Notifications toggles (squad requests, DM, challenge results) — stored on `profiles` as a `notification_prefs jsonb`.
- Default platform (PC / PS / Xbox / Switch) — stored on `profiles.default_platform`.
- Privacy: profile visibility (public / squad only) — stored on `profiles.visibility`.
- Sign out.

Migration adds `notification_prefs jsonb`, `default_platform text`, `visibility text` to `profiles`.

## 4. Availability schedule on profile
Add an "When I play" card to `ProfileTab.tsx` so squadmates can see when you're around.

- New table `public.availability_slots` with columns: `user_id`, `weekday` (0–6), `start_minute` (0–1439), `end_minute` (0–1439).
- RLS: public read (for discovery), owner write.
- UI: a 7×24 grid where the user toggles hour blocks on each weekday, plus a timezone select stored on `profiles.timezone`. Other users viewing a profile see a compact heatmap of the same grid.
- Surfaced as a small "Available now" / "Next online: Sat 8pm" badge on Find cards (read-only consumption, no Find UI rewrite).

## Technical notes (for reference)
- New files: `src/components/squadz/CrewsTab.tsx`, `src/components/squadz/SettingsSheet.tsx`, `src/components/squadz/AvailabilityGrid.tsx`.
- Removed from nav: `ClansTab` + `ClubsTab` direct entries (files kept, used inside CrewsTab detail views).
- Two migrations: (a) `clans.kind` + copy clubs → clans + profile prefs columns, (b) `availability_slots` table with RLS + grants.
- All new tables get explicit GRANTs and RLS per project rules.
- `tracker.gg` integration from the previous turn is unaffected.

Want me to proceed with all four, or trim scope (e.g. skip the clubs→clans data copy and just relabel)?
