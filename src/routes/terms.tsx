import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Rostr" },
      { name: "description", content: "Rules for using Rostr, including content, payments, and copyright." },
      { property: "og:title", content: "Terms of Service — Rostr" },
      { property: "og:description", content: "Rules for using Rostr, including content, payments, and copyright." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-black">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-1">Last updated: July 5, 2026</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Your account</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>You are responsible for activity on your account. Don't share credentials. You must be at least 13 years old to use Rostr.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>User content</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>You keep ownership of clips, screenshots, and posts you upload. By posting, you grant Rostr a non-exclusive license to host and display that content within the app. Don't upload anything illegal, harassing, or infringing.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payments and subscriptions</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Paid plans and in-app purchases are billed via Stripe. Subscriptions renew until cancelled from your account settings. Refunds are handled case-by-case in line with local consumer law.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Copyright and DMCA</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Rostr respects intellectual property. If you believe a clip or post infringes your copyright, send a DMCA notice to our designated agent including: the work claimed, the URL of the infringing content, your contact details, a good-faith statement, and a signature.</p>
            <p>Repeat infringers will have their accounts terminated.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Termination</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>We may suspend or terminate accounts that violate these terms or harm other users. You may close your account at any time.</p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          See also <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
