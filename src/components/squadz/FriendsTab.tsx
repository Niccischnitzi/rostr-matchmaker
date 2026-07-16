import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Users, UserPlus, Check, X, Loader2, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";
import { fetchProfiles, type Profile } from "@/lib/squadz-supabase";
import { useSquadz } from "@/lib/squadz-store";
import { UserSafetyActions } from "./UserSafetyActions";
import { EmptyState } from "./EmptyState";

type Friend = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
};
type RowProfile = Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;

export function FriendsTab() {
  const { user } = useAuth();
  const { connected } = useSquadz();
  const [rows, setRows] = useState<Friend[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [discover, setDiscover] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("friends")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Friend[];
    const ids = Array.from(new Set(list.flatMap((r) => [r.requester_id, r.addressee_id]))).filter((i) => i !== user.id);
    const [friendProfiles, discoverRows] = await Promise.all([
      fetchProfiles(ids),
      supabase.from("profiles").select("*").neq("id", user.id).order("username").limit(50),
    ]);
    setRows(list);
    setProfiles(new Map(friendProfiles.map((p) => [p.id, p])));
    setDiscover((discoverRows.data ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === user?.id);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === user?.id);
  const connectedMatches = connected.filter((p) => p.username.toLowerCase().includes(q.toLowerCase()));

  const filteredAccepted = useMemo(() => {
    if (!q.trim()) return accepted;
    return accepted.filter((r) => {
      const other = r.requester_id === user?.id ? r.addressee_id : r.requester_id;
      const p = profiles.get(other);
      return p?.username?.toLowerCase().includes(q.toLowerCase()) || p?.display_name?.toLowerCase().includes(q.toLowerCase());
    });
  }, [accepted, profiles, q, user]);

  const discoveryResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const existing = new Set(rows.flatMap((r) => [r.requester_id, r.addressee_id]));
    return discover
      .filter((p) => !existing.has(p.id))
      .filter((p) => p.username.toLowerCase().includes(needle) || (p.display_name ?? "").toLowerCase().includes(needle))
      .slice(0, 8);
  }, [discover, q, rows]);

  async function respond(id: string, status: "accepted" | "blocked") {
    const { error } = await supabase.from("friends").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    sfx.win();
    toast.success(status === "accepted" ? "Friend added!" : "Blocked");
    load();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("friends").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  async function add(profile: Profile) {
    if (!user) return;
    const { error } = await supabase.from("friends").upsert(
      { requester_id: user.id, addressee_id: profile.id, status: "pending" },
      { onConflict: "requester_id,addressee_id" },
    );
    if (error) return toast.error(error.message);
    toast.success(`Request sent to ${profile.display_name ?? profile.username}`);
    load();
  }

  if (!user) return null;
  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 lg:pt-10 pb-10 arcade-enter">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Friends</h1>
          <p className="text-sm text-muted-foreground mt-1">Your rostr, requests, and incoming pings.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-24 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          {incoming.length > 0 && (
            <Section title={`Incoming (${incoming.length})`} icon={UserPlus}>
              {incoming.map((r) => {
                const p = profiles.get(r.requester_id);
                return (
                  <Row key={r.id} profile={p}>
                    <Button size="sm" onClick={() => respond(r.id, "accepted")}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => remove(r.id)}><X className="h-4 w-4" /></Button>
                  </Row>
                );
              })}
            </Section>
          )}

          {outgoing.length > 0 && (
            <Section title={`Sent (${outgoing.length})`} icon={UserPlus}>
              {outgoing.map((r) => (
                <Row key={r.id} profile={profiles.get(r.addressee_id)}>
                  <span className="text-xs text-muted-foreground">Pending…</span>
                  <Button size="sm" variant="outline" onClick={() => remove(r.id)}><X className="h-4 w-4" /></Button>
                </Row>
              ))}
            </Section>
          )}

          <Section title={`Rostr (${accepted.length})`} icon={Users}>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search friends or players…"
                className="w-full bg-surface rounded-lg pl-9 pr-3 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {connectedMatches.map((p) => (
              <Row key={p.id} profile={{ id: p.id, username: p.username, display_name: p.username, avatar_url: p.avatar }}>
                <span className="text-xs text-primary font-semibold">Find match</span>
              </Row>
            ))}
            {filteredAccepted.length === 0 && connectedMatches.length === 0 && discoveryResults.length === 0 && (
              q.trim() ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No matches found.</p>
              ) : (
                <EmptyState
                  variant="controller"
                  title="Your rostr is empty"
                  body="Swipe on the Find tab to add players. Every friend request that goes both ways lands here."
                  action={
                    <GlowButton
                      onClick={() => window.dispatchEvent(new CustomEvent("rostr:go-tab", { detail: "find" }))}
                      icon={<UserPlus className="h-5 w-5" />}
                    >
                      Add friends
                    </GlowButton>
                  }
                />

              )
            )}
            {filteredAccepted.map((r) => {
              const other = r.requester_id === user.id ? r.addressee_id : r.requester_id;
              const p = profiles.get(other);
              return (
                <Row key={r.id} profile={p}>
                  <UserSafetyActions targetId={p?.id} targetLabel={p?.display_name ?? p?.username} onBlocked={() => remove(r.id)} />
                  <Button size="sm" variant="outline" onClick={() => toast("Open chat from the Chat tab")}>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(r.id)}><X className="h-4 w-4" /></Button>
                </Row>
              );
            })}
            {discoveryResults.map((p) => (
              <Row key={p.id} profile={p}>
                <UserSafetyActions targetId={p.id} targetLabel={p.display_name ?? p.username} />
                <Button size="sm" onClick={() => add(p)}><UserPlus className="h-4 w-4" /></Button>
              </Row>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 soft-rise">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ profile, children }: { profile?: RowProfile | null; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface/60 transition">
      <div className="h-10 w-10 rounded-full bg-surface-2 overflow-hidden shrink-0">
        {profile?.avatar_url && <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{profile?.display_name ?? profile?.username ?? "…"}</p>
        <p className="text-[11px] text-muted-foreground truncate">@{profile?.username ?? "user"}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}
