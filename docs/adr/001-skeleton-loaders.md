# 001 - Implement Skeleton Loaders for Data Fetching Fallbacks

**Status:** Accepted
**Date:** 2026-07-05

## Context

Rostr relies on real-time data from our backend (profiles, video feeds,
Clan/Club views, LFG lists). Users currently experience blank screens or
layout shift while queries resolve, which degrades perceived performance
and hurts Cumulative Layout Shift (CLS).

## Decision

Adopt the shadcn/ui `<Skeleton />` primitive across all major data
boundaries, driven by TanStack Query's `isLoading` / `isPending` state
(or React Suspense where a route uses `useSuspenseQuery`).

Guidelines:

- Skeleton shapes must approximate the final layout (avatar circle, line
  widths, card grid) so the transition to real content is invisible.
- Use `src/components/ui/skeleton.tsx` — do not roll bespoke shimmer
  divs per component.
- Prefer per-item skeletons inside lists over a single full-screen
  spinner so above-the-fold content settles first.

## Consequences

**Positive**
- Improved perceived load time.
- Eliminates layout shift on data-heavy screens.
- Consistent loading language across the app.

**Negative**
- Requires maintaining skeleton layouts alongside real UI; UI changes
  need a matching skeleton update.
- Small extra render cost on first mount.
