import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Search as SearchIcon, Users, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ q: z.string().optional().default("") });

type Person = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
};
type Crew = {
  id: string;
  name: string;
  tag: string | null;
  description: string | null;
  member_count: number | null;
  banner_url: string | null;
};

export const Route = createFileRoute("/search")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Search — Rostr" },
      { name: "description", content: "Find players and crews on Rostr." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});


function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [tab, setTab] = useState<"people" | "crews">("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setPeople([]);
      setCrews([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_all" as any, { _q: query, _limit: 20 });
      if (cancelled) return;
      const payload = (data ?? {}) as { people?: Person[]; crews?: Crew[] };
      setPeople(payload.people ?? []);
      setCrews(payload.crews ?? []);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="h-9 w-9 grid place-items-center rounded-lg bg-surface hover:bg-surface-2 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 relative flex items-center rounded-lg bg-surface border border-border focus-within:border-primary/50 h-10 px-3">
            <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players & crews"
              className="ml-2 flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-1">
          {([
            ["people", "Players", Users, people.length],
            ["crews", "Crews", Shield, crews.length],
          ] as const).map(([id, label, Icon, count]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  active ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {count > 0 && <span className="opacity-70">· {count}</span>}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        {!q.trim() ? (
          <EmptyPitch />
        ) : tab === "people" ? (
          people.length === 0 && !loading ? (
            <NoResults label="players" />
          ) : (
            <ul className="space-y-2">
              {people.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/u/$handle"
                    params={{ handle: p.username }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3 hover:bg-surface/50 transition"
                  >
                    <div className="h-11 w-11 rounded-full overflow-hidden bg-surface grid place-items-center text-sm font-black shrink-0">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (p.display_name ?? p.username).slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{p.display_name ?? p.username}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{p.username}
                        {p.country ? ` · ${p.country}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : crews.length === 0 && !loading ? (
          <NoResults label="crews" />
        ) : (
          <ul className="space-y-2">
            {crews.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3"
              >
                <div className="h-11 w-11 rounded-lg overflow-hidden bg-surface grid place-items-center text-sm font-black shrink-0">
                  {c.banner_url ? <img src={c.banner_url} alt="" className="h-full w-full object-cover" /> : (c.tag ?? c.name).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">
                    {c.name} {c.tag && <span className="text-muted-foreground font-mono text-xs">[{c.tag}]</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.member_count ?? 0} member{(c.member_count ?? 0) === 1 ? "" : "s"}
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyPitch() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
      <SearchIcon className="h-6 w-6 mx-auto mb-3 opacity-60" />
      <p className="font-semibold text-foreground">Search the rostr</p>
      <p className="text-xs mt-1">Type a handle, a name, or a crew. ⌘K opens this anywhere.</p>
    </div>
  );
}
function NoResults({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground text-sm">
      No {label} matched. Try a shorter query.
    </div>
  );
}
