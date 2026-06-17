import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/guides/finding-gamers")({
  component: GuidePage,
  head: () => ({
    meta: [
      { title: "How to Find Gaming Friends — Best Sites for Gamers | Rostr" },
      {
        name: "description",
        content:
          "A practical guide to finding gaming friends and the best sites for gamers in 2026 — compare Discord, LFG apps, and Rostr for finding consistent teammates.",
      },
      { property: "og:type", content: "article" },
      { property: "og:title", content: "How to Find Gaming Friends — Best Sites for Gamers" },
      {
        property: "og:description",
        content:
          "Compare the best sites for gamers and learn how to find gaming friends you actually want to queue with.",
      },
      { property: "og:url", content: "https://rostr-matchmaker.lovable.app/guides/finding-gamers" },
    ],
    links: [{ rel: "canonical", href: "https://rostr-matchmaker.lovable.app/guides/finding-gamers" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "How to Find Gaming Friends — Best Sites for Gamers",
          description:
            "A practical guide to finding gaming friends and the best sites for gamers in 2026.",
          author: { "@type": "Organization", name: "Rostr" },
          publisher: { "@type": "Organization", name: "Rostr" },
          mainEntityOfPage: "https://rostr-matchmaker.lovable.app/guides/finding-gamers",
        }),
      },
    ],
  }),
});

function GuidePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <article className="prose prose-invert max-w-none space-y-6">
          <header className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
              Guide
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              How to Find Gaming Friends (and the Best Sites for Gamers)
            </h1>
            <p className="text-muted-foreground text-lg">
              Solo queue gets old fast. Here's how to find gaming friends you actually
              want to play with — and which platforms work best for it in 2026.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">Why finding gaming friends is harder than it should be</h2>
            <p>
              Most "find a gamer" tools were built for one game or one console. Your Steam
              friends list doesn't know your Xbox tag, Discord servers are massive and noisy,
              and LFG sub-reddits surface one-off groups, not people you'll queue with next
              week. The result: thousands of players, but no easy way to find the handful
              who match your game, rank, schedule, and vibe.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">The best sites for gamers, compared</h2>
            <ul className="space-y-3">
              <li>
                <strong>Discord</strong> — great for ongoing communities you're already in.
                Weak for cold discovery: huge LFG servers move too fast and don't show rank,
                region, or playstyle.
              </li>
              <li>
                <strong>Steam groups & friend finders</strong> — useful if you only play on
                PC, but invisible to console and mobile players, and there's no profile
                beyond hours played.
              </li>
              <li>
                <strong>Subreddits like r/LFG and r/Teams</strong> — fine for one-night
                squads. Not built for repeat teammates, voice tests, or scheduling.
              </li>
              <li>
                <strong>In-game LFG / clan finders</strong> — locked to one title. The
                moment you switch games, your network resets.
              </li>
              <li>
                <strong>Rostr</strong> — a cross-platform passport that links Steam, Xbox,
                PlayStation, and more, so you can search by game, rank, region, and
                availability and actually build a roster of people you keep playing with.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">How to find gaming friends (the short version)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong>Link your accounts in one place.</strong> A single passport beats
                ten scattered friend lists.
              </li>
              <li>
                <strong>Post an LFG ad with specifics.</strong> Game, rank, region, mic,
                schedule. Vague posts attract vague teammates.
              </li>
              <li>
                <strong>Join a club or clan, not just a one-off lobby.</strong> Repeated
                games turn strangers into teammates.
              </li>
              <li>
                <strong>Share clips.</strong> A 20-second highlight tells people more about
                how you play than any bio.
              </li>
              <li>
                <strong>Run small cups.</strong> Tournaments and club wars give your group
                a reason to log in at the same time.
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">How Rostr fits in</h2>
            <p>
              Rostr is a gaming social hub built around finding consistent teammates instead
              of one-off lobbies. Your passport links every gaming platform you play on,
              your LFG ads filter by what you actually care about, and clubs and clans give
              the group somewhere to live between matches.
            </p>
            <div className="pt-2">
              <Link
                to="/auth"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                Create your Rostr passport
              </Link>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">FAQ</h2>
            <div>
              <h3 className="font-semibold">What's the best free site to find gaming friends?</h3>
              <p>
                For one-off teammates, Discord LFG servers and r/LFG work. For people you'll
                keep playing with, a cross-platform hub like Rostr makes it easier to filter
                by game, rank, and schedule.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">How do I find gaming friends on console?</h3>
              <p>
                Link your Xbox or PlayStation tag to a profile that other players can find,
                then post an LFG ad with your game, region, and rank. In-game friend codes
                alone rarely lead to repeat sessions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Is Rostr only for competitive players?</h3>
              <p>
                No. Casual squads, club hangouts, and creator communities all use Rostr —
                competitive cups and club wars are optional.
              </p>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
