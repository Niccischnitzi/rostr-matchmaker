// Server-only Google Search Console gateway helpers.
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

function headers() {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const connectionApiKey = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
  if (!lovableApiKey || !connectionApiKey) throw new Error("Search Console is not connected");
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": connectionApiKey,
  };
}

export type SiteEntry = { siteUrl: string; permissionLevel?: string };

function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

export async function listVerifiedSites(targetUrl: string) {
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: headers() });
  if (!res.ok) throw new Error(`Could not list properties [${res.status}]: ${await res.text()}`);
  const { siteEntry = [] } = (await res.json()) as { siteEntry?: SiteEntry[] };
  const target = new URL(targetUrl);
  return siteEntry.filter(
    (e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target),
  );
}

export async function fetchSitemaps(siteUrl: string) {
  const res = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`Sitemaps request failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as {
    sitemap?: Array<{
      path: string;
      lastSubmitted?: string;
      lastDownloaded?: string;
      isPending?: boolean;
      errors?: string;
      warnings?: string;
      contents?: Array<{ type: string; submitted: string; indexed?: string }>;
    }>;
  };
}

export async function submitSitemap(siteUrl: string, sitemapUrl: string) {
  const res = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    { method: "PUT", headers: headers() },
  );
  if (!res.ok) throw new Error(`Sitemap submit failed [${res.status}]: ${await res.text()}`);
  return true;
}

export async function querySearchAnalytics(siteUrl: string, days = 28) {
  const end = new Date();
  const start = new Date(Date.now() - days * 86_400_000);
  const body = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    dimensions: ["query"],
    rowLimit: 10,
  };
  const res = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (res.status === 403) throw new Error("The connected Google account cannot access this property");
  if (!res.ok) throw new Error(`Search analytics failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as {
    rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
  };
}

export async function inspectUrl(siteUrl: string, inspectionUrl: string) {
  const res = await fetch(`${GATEWAY}/v1/urlInspection/index:inspect`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  if (!res.ok) throw new Error(`URL inspection failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as any;
}
