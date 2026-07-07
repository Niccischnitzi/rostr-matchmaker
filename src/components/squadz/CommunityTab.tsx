import { MessageSquare, Megaphone, Lightbulb, Film, Sparkles } from "lucide-react";

const sections = [
  { icon: MessageSquare, label: "Chats", copy: "Open rooms by game, region, and vibe." },
  { icon: Megaphone, label: "Forums", copy: "Threaded discussions, patch notes, meta talk." },
  { icon: Lightbulb, label: "Feedback", copy: "Vote on features and report what's broken." },
  { icon: Film, label: "Shorts", copy: "Bite-sized clips — the good stuff from Reels, curated." },
];

export function CommunityTab() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
        <div className="absolute -inset-24 bg-primary/15 blur-3xl animate-pulse pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 text-primary px-3 py-1 mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Coming Soon</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-black">Community</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Chats, forums, feedback, and short clips — one hub for everything happening across Rostr.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map(({ icon: Icon, label, copy }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 flex gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{copy}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
