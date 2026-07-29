// SEO status dashboard data. Admin-only: every handler verifies the caller
// holds the `admin` role through the RLS-scoped client before touching the
// Search Console gateway.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getSeoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ selectedSiteUrl: z.string().max(300).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin, SITE_URL } = await import("./seo.guard.server");
    const admin = await requireAdmin(context.supabase, context.userId);
    if (!admin) return { ok: false as const, error: "Admin only" };

    const { listVerifiedSites, fetchSitemaps, querySearchAnalytics } = await import("./seo.server");

    try {
      const matches = await listVerifiedSites(SITE_URL);
      if (matches.length === 0) {
        return { ok: false as const, error: "No verified Search Console property covers this site yet." };
      }
      if (matches.length > 1 && !data.selectedSiteUrl) {
        return { ok: true as const, status: "selection_required" as const, candidates: matches.map((m) => m.siteUrl) };
      }
      const chosen = data.selectedSiteUrl
        ? matches.find((m) => m.siteUrl === data.selectedSiteUrl)?.siteUrl
        : matches[0].siteUrl;
      if (!chosen) return { ok: false as const, error: "That property is not verified for this site." };

      const [sitemaps, analytics] = await Promise.all([
        fetchSitemaps(chosen).catch(() => ({ sitemap: [] })),
        querySearchAnalytics(chosen).catch(() => ({ rows: [] })),
      ]);

      const rows = analytics.rows ?? [];
      return {
        ok: true as const,
        status: "selected" as const,
        siteUrl: chosen,
        sitemaps: sitemaps.sitemap ?? [],
        totals: {
          clicks: rows.reduce((a, r) => a + (r.clicks ?? 0), 0),
          impressions: rows.reduce((a, r) => a + (r.impressions ?? 0), 0),
          queries: rows.length,
        },
        topQueries: rows,
      };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Search Console request failed" };
    }
  });

export const submitSitemapToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ siteUrl: z.string().max(300) }).parse(data))
  .handler(async ({ data, context }) => {
    const { requireAdmin, SITE_URL } = await import("./seo.guard.server");
    const admin = await requireAdmin(context.supabase, context.userId);
    if (!admin) return { ok: false as const, error: "Admin only" };

    const { listVerifiedSites, submitSitemap } = await import("./seo.server");
    try {
      const matches = await listVerifiedSites(SITE_URL);
      if (!matches.some((m) => m.siteUrl === data.siteUrl)) {
        return { ok: false as const, error: "That property is not verified for this site." };
      }
      await submitSitemap(data.siteUrl, `${SITE_URL}sitemap.xml`);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Sitemap submit failed" };
    }
  });
