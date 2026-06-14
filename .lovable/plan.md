# Polish pass: sound, nav, LFG, settings

## 1. Subtler sound effects
Rewrite `src/lib/sfx.ts` so tones are softer and less piercing:
- Lower master gain (~0.04 instead of 0.15)
- Use `sine`/`triangle` waves (no `square`/`sawtooth`)
- Shorter envelopes (~60–90ms) with gentle attack/release ramps
- Drop high frequencies (cap around 700–900Hz for taps/nav, 220–440Hz for sends)
- Add a tiny lowpass filter to round off harshness

## 2. Fewer tabs in the bottom nav
Current: Home, Find, Crews, Media, Chat, Friends, Profile (7).
New (5):
- Home
- Find
- Crews
- Media
- Chat (Friends becomes a sub-view inside Chat)
- Profile

Inside `ChatTab.tsx`, add a top segmented control: **Messages | Friends**. The Friends list (current `FriendsTab.tsx`) renders under the Friends segment; tapping a friend opens a DM in the Messages segment. Remove the Friends entry from `Shell.tsx` nav.

## 3. LFG ad includes playing times
Extend `LfgAdSheet.tsx` so creating/editing an LFG ad includes an availability block:
- Reuse the existing `AvailabilityGrid` (days × time-of-day) already used on Profile
- Persist to existing `availability_slots` table (no schema change) tied to user; the ad on the Find page shows a compact "Plays: Mon/Wed/Fri evenings" summary derived from those slots
- Add a small day/time chip row on each LFG card on the Find page

## 4. Fix the Sound on/off toggle in Settings
In `SettingsSheet.tsx` the toggle currently flips local state but `sfx.ts` never checks it. Fix by:
- Storing `sfx_enabled` in `localStorage` (key `squadz:sfx`)
- Having every `play()` call in `sfx.ts` early-return when disabled
- Toggle writes to localStorage and dispatches a `storage`-like event so the module picks it up immediately
- Default: enabled

## Files touched
- `src/lib/sfx.ts` — softer tones + enabled flag
- `src/components/squadz/Shell.tsx` — remove Friends tab
- `src/components/squadz/ChatTab.tsx` — Messages/Friends segmented control, mount FriendsTab inside
- `src/components/squadz/LfgAdSheet.tsx` — availability picker + save to `availability_slots`
- `src/components/squadz/FindTab.tsx` — show playing-times chips on LFG cards
- `src/components/squadz/SettingsSheet.tsx` — wire toggle to localStorage

No database migrations required.
