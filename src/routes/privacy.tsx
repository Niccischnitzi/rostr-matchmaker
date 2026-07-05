import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Rostr" },
      { name: "description", content: "How Rostr collects, stores, and uses your data." },
      { property: "og:title", content: "Privacy Policy — Rostr" },
      { property: "og:description", content: "How Rostr collects, stores, and uses your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-black">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-1">Last updated: July 5, 2026</p>
        </div>

        <Card>
          <CardHeader><CardTitle>What we collect</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>We store the information you provide when creating an account (email, username, avatar) and content you post (clips, messages, LFG posts). We also store platform identifiers like your Steam ID when you link a gaming account.</p>
            <p>Basic device and usage telemetry (browser, IP, page views) is used to keep the service secure and functional.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Steam and third-party accounts</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Connecting Steam links your public SteamID to your Rostr profile so we can show your games, avatar, and public stats. We do not receive your Steam password. You can unlink at any time from Settings.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Payments are processed by Stripe. Rostr never sees or stores your full card details. We store the minimum billing metadata (customer id, subscription status, plan) required to deliver purchased features.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Your rights</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>You can request a copy of your data, correct inaccuracies, or delete your account by contacting support. Deleting your account removes your profile, posts, and linked identities from our active systems.</p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          See also <Link to="/terms" className="underline">Terms of Service</Link>.
        </p>
      </div>
    </main>
  );
}
