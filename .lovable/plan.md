## What I verified

- **Settings:** `Your cosmetics` is currently a separate settings accordion section. I will move it under **Look & feel** as requested.
- **LFG interactions:** the visible Find deck still uses profile-level LFG fields (`profiles.lfg_title`, etc.), while the Chat tab's LFG Board uses the old mock/local store. The real `lfg_ads` table currently has **0 open rows**, so the LFG Board cannot be interacted with as a real product surface yet.
- **Messaging:** the database has conversations and direct messages, and RLS exists, but the app creates DMs directly from the browser using the unordered pair rules. I will move this into a reliable backend function so creating/opening/sending a DM is idempotent and works consistently.
- **Friends:** friend requests exist, but there is no single reliable “add/request/message” action shared by Find, Friends, profiles, and LFG.

## Plan

### 1. Fix real user interactions first
- Add backend RPCs for:
  - `get_or_create_conversation(other_user_id)`
  - `send_dm(other_user_id, body)`
  - `request_friend(target_user_id)`
  - `join_lfg_ad(ad_id)`
- Make each action idempotent so repeated taps do not fail or create duplicates.
- Keep all authorization tied to the signed-in user.
- Return clear errors for blocked/self/full/expired cases.

### 2. Replace mock LFG Board with real LFG data
- Rebuild the Chat tab **LFG Board** to read/write `lfg_ads` instead of the local mock store.
- Let users post a real LFG ticket, join another user's ticket, and message the host.
- Add animated empty state with a large primary CTA when there are no open LFGs.
- Keep the existing Find swipe deck working, but unify its “squad up” action with the new real interaction functions.

### 3. Repair DM UX end-to-end
- Update Chat “New DM”, Friends “message”, Find “message/squad”, and profile actions to all use the same reliable DM helper.
- Add optimistic UI for sending messages and roll back on failure.
- Add visible loading/error/empty states so the tab never looks stuck.
- Make realtime channel names unique to avoid collisions.

### 4. Move cosmetics into Look & feel
- Remove the separate `Your cosmetics` accordion section.
- Place `OwnedCosmeticsSection` inside **Look & feel**, below theme controls.
- Keep text labels explicit: theme, accent, backgrounds, avatar frames, halos, tags.
- Ensure the save/apply behavior is obvious and consistent.

### 5. Universal light/dark mode cleanup
- Audit the remaining hardcoded dark/light styles in the major tabs.
- Replace them with semantic theme tokens where needed.
- Ensure all theme palettes obey the global **Light / Dark / System** setting.
- Verify contrast for normal and high-contrast modes.

### 6. Add “the rest” of Batch C in order
- **Post-Game Quick Rate**
  - Add `match_ratings` table, safe fixed tags, aggregate-only profile display, and minimum sample-size threshold.
- **Chemistry Score**
  - Add pairwise tracked-match aggregation for challenges/club wars only.
  - Show chemistry only when shared history exists and sample size is meaningful.
- **Voice Snippets**
  - Add one active 15-second profile voice snippet per user.
  - Enforce duration client-side and backend-side.
  - Require deliberate tap to play, never autoplay.
  - Add report action.

### 7. Normalize branding and Shards labels
- Sweep remaining “tokens” copy in visible UI and change it to **Shards**.
- Keep database/internal names unchanged where renaming would be risky.
- Ensure logo/brand treatment is consistent across settings, shop, pricing, chat, and empty states.

### 8. UI test coverage
- Add tests for:
  - Settings: cosmetics live under Look & feel.
  - Chat: empty state shows a large New DM CTA.
  - Friends: add/request/message actions are present.
  - LFG Board: real empty state and post/join controls.
  - Theme: light/dark/high-contrast attributes persist after refresh.

## Still necessary after this pass

- Real users need actual LFG rows, not profile-only mock ads.
- DM/friend/LFG actions need one reliable backend path instead of several direct browser insert paths.
- Chat LFG Board must be converted from mock local state to database-backed state.
- Batch C database migrations and UI surfaces still need to be built.
- Contrast and theme persistence need a final Playwright sweep after the UI changes.
- Tests need to be added after the interaction surfaces are stabilized.