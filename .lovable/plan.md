# Rostr — Notifications, Clans, Light Mode & Hardening

Scope is large. I'll ship in five ordered sub-batches so you can review after each. Anything ambiguous stops for your call instead of guessing.

## 1. Notifications (friend requests, LFG, DM)

Backend
- Extend the existing `notifications` table with kinds: `friend_request`, `friend_accepted`, `dm_received`, `lfg_joined`, `lfg_accepted`, `clan_invite`, `clan_role_changed`.
- Add DB triggers so notifications are written server-side (no client trust):
  - `after insert on friends` where `status='pending'` → notify recipient.
  - `after update on friends` where transition to `accepted` → notify requester.
  - `after insert on direct_messages` → notify the other participant (dedup within 60s per conversation).
  - `after insert on lfg_ad_joiners` → notify LFG ad owner.
- Keep `mark_all_notifications_read` RPC; add `mark_notification_read(_id uuid)`.

Frontend
- `NotificationsBell` already toasts new rows — extend `iconFor` and `/inbox` rendering to include LFG + clan icons and link targets (`/inbox` → deep link via `row.link`).
- Row click marks that one read and navigates to `link` (DM thread, LFG card, clan page).

## 2. Clan hierarchy admin + leave/delete

- New RPC `set_clan_member_role(_clan uuid, _user uuid, _role text)`:
  - Only `leader` or `co_leader` can promote/demote, cannot exceed own rank, only leader can set co_leader, cannot demote the leader.
- New RPC `kick_clan_member(_clan uuid, _user uuid)` with same rank rules.
- New RPC `leave_clan(_clan uuid)`:
  - If caller is leader and other members remain → block with clear error asking to transfer leadership first (or auto-promote highest-ranked officer if `force=true`).
- New RPC `delete_clan(_clan uuid)` — leader only, cascades members/invites.
- `ClansTab` / `ClanDetail`:
  - Roster row → context menu (promote/demote/kick) for leaders+co_leaders.
  - "Transfer leadership" dialog.
  - "Delete clan" in danger zone for leader; "Leave clan" everywhere else with proper confirmation.

## 3. Clan cosmetics application

- Add `clans.cosmetic` jsonb (banner_id, badge_id, accent_hex, tag_style).
- `ClanAppearance` sheet (leaders only) — pick from clan-eligible items in `shop_items` (new `scope='clan'` category) and equipped items in `user_inventory` owned by a leader.
- Render across surfaces: `ClanCard`, `ClanDetail` header, roster tag chip, and member profile chips (`UserAvatar` reads clan cosmetic when a user's active clan has one equipped).
- Reuse cosmetics application layer in `use-equipped-cosmetics` — add a `useClanCosmetic(clanId)` hook.

## 4. Universal light mode

- Audit hardcoded `bg-black/white`, `text-white/black`, `#hex` in components — replace with tokens.
- Extend `src/styles.css` `:root` light palette so `--surface`, `--surface-2`, `--card`, `--muted`, gradient stops, and glow colors all have light-mode counterparts. Test each tab (Find, Chat, Clans, Reels, Shop, Settings, Inbox, Profile) in light.
- Verify Reels/Media overlays remain legible (add scrim tokens instead of hardcoded blacks).
- Ensure `data-contrast="high"` still overrides.

## 5. Security + graphical bugs

- Run `security--run_security_scan`, fix outstanding findings, log rationale to security memory.
- Common bug pass:
  - `NotificationsBell` compact size + pip alignment on mobile header.
  - `ClansTab` avatar fallback uses external dicebear — swap to `UserAvatar` (unifies halo/frame + avoids third-party requests).
  - `FindTab` / `Inbox` skeleton height jump.
  - Empty `EmptyState` CTA button contrast in light mode.

## Technical notes

- Notification triggers use `SECURITY DEFINER` + `search_path=public` and guard with `has_role`/ownership checks; grants: `authenticated` `select/update(read_at)` on `notifications`, no anon.
- All new RPCs: `SECURITY DEFINER`, revoke from anon, rate-limited via `check_rate_limit`.
- Realtime: `notifications` is already in the publication; verify.
- No changes to auto-generated Supabase files.

## What I won't touch this pass

- No new payment flows, no MCP tool changes, no schema for a full "clan wars" bracket (existing table stays as-is).
- No redesign of the Reels player beyond token-swap.

Stop me between any sub-batch if priorities shift. Otherwise I'll execute 1→5 in order.
