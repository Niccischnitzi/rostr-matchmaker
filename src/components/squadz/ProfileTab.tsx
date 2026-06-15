import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { useSquadz } from "@/lib/squadz-store";
import { Check, Copy, Plus, Trophy, Users, Loader2, Pencil, LogOut, Camera, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AvailabilityGrid } from "./AvailabilityGrid";

const statuses = ["Online", "In-Game", "Busy", "Looking for Squad"] as const;
const statusColors: Record<string, string> = {
  "Online": "bg-success",
  "In-Game": "bg-primary",
  "Busy": "bg-destructive",
  "Looking for Squad": "bg-orange-500",
};

const PLATFORMS = ["Steam", "PSN", "Xbox", "Riot", "BattleNet", "Faceit"] as const;
const platformMeta: Record<string, { icon: string; color: string }> = {
  Steam:     { icon: "🎮", color: "#171a21" },
  PSN:       { icon: "🅿️", color: "#003791" },
  Xbox:      { icon: "🟢", color: "#107C10" },
  Riot:      { icon: "⚡", color: "#D32936" },
  BattleNet: { icon: "⚔️", color: "#148EFF" },
  Faceit:    { icon: "🔥", color: "#FF5500" },
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  age: number | null;
  country: string | null;
  timezone: string | null;
  availability_status: string;
  current_game_activity: string | null;
};

type LinkedAccount = {
  id: number;
  user_id: string;
  platform: string;
  gamertag: string;
  current_rank_display: string | null;
};

async function resolveAvatarUrl(value: string | null): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(value, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

export function ProfileTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { clips } = useSquadz();
  const pinned = clips.filter((c) => c.pinned).slice(0, 3);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Current user id
  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  // Profile
  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, age, country, timezone, availability_status, current_game_activity")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  // Resolved avatar URL (signed if needed)
  const { data: avatarUrl } = useQuery({
    queryKey: ["profile-avatar", profile?.avatar_url],
    enabled: !!profile,
    queryFn: () => resolveAvatarUrl(profile?.avatar_url ?? null),
  });

  // Linked accounts
  const { data: linked = [], isLoading: linkedLoading } = useQuery<LinkedAccount[]>({
    queryKey: ["linked-accounts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linked_accounts")
        .select("id, user_id, platform, gamertag, current_rank_display")
        .eq("user_id", userId!)
        .order("platform");
      if (error) throw error;
      return data as LinkedAccount[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (s: string) => {
      if (!userId) return;
      const { error } = await supabase.from("profiles").update({ availability_status: s }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update status"),
  });

  const deleteLinked = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("linked_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linked-accounts", userId] });
      toast.success("Removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  const handleAvatar = async (file: File) => {
    if (!userId) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: profErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (profErr) throw profErr;
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Avatar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  };

  const copy = (platform: string, tag: string) => {
    navigator.clipboard?.writeText(tag).catch(() => {});
    setCopied(platform);
    toast.success(`${platform} ID copied!`, { description: tag });
    setTimeout(() => setCopied(null), 1500);
  };

  const onSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const fallbackAvatar = useMemo(
    () => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${profile?.username ?? "you"}&backgroundColor=ff5722`,
    [profile?.username]
  );

  if (profileLoading || !profile) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      {/* Header card */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-primary via-orange-600 to-accent relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          <button
            onClick={onSignOut}
            className="absolute top-3 right-3 h-9 px-3 rounded-lg bg-black/40 backdrop-blur text-white text-xs font-bold flex items-center gap-2 hover:bg-black/60 transition"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
        <div className="px-5 pb-5 -mt-12">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="relative shrink-0">
              <div className="h-24 w-24 rounded-2xl border-4 border-card bg-surface-2 overflow-hidden">
                <img src={avatarUrl ?? fallbackAvatar} alt={profile.username} className="h-full w-full object-cover" />
              </div>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatar(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => avatarInput.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg hover:opacity-90 disabled:opacity-50"
                aria-label="Change avatar"
              >
                {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex-1 min-w-0 pt-12 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-black truncate">{profile.display_name || profile.username}</h1>
                <p className="text-sm text-muted-foreground truncate">@{profile.username}{profile.country ? ` · ${profile.country}` : ""}</p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="h-9 px-3 rounded-lg bg-surface hover:bg-surface-2 text-xs font-bold flex items-center gap-1.5 border border-border"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-4 text-sm text-muted-foreground whitespace-pre-line">{profile.bio}</p>
          )}

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button key={s} onClick={() => updateStatus.mutate(s)}
                  className={cn("flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all",
                    profile.availability_status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface")}>
                  <span className={cn("h-2 w-2 rounded-full", statusColors[s])} />
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Linked", value: linked.length, icon: Users },
              { label: "Clips", value: clips.length, icon: Trophy },
              { label: "Wins", value: 142, icon: Trophy },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-surface border border-border p-3 text-center">
                <Icon className="h-4 w-4 text-primary mx-auto" />
                <p className="font-display text-xl font-black mt-1">{value}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linked accounts */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-black">Linked accounts</h2>
          <button
            onClick={() => setAdding(true)}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Your universal gaming passport. Players can add you on any platform with one tap.</p>
        {linkedLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : linked.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <p className="font-bold">No platforms linked yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add Steam, PSN, Xbox, Riot and more so squadmates can find you anywhere.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {linked.map((a) => {
              const meta = platformMeta[a.platform] ?? { icon: "🎮", color: "#444" };
              return (
                <div key={a.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl grid place-items-center text-xl shrink-0" style={{ background: meta.color, color: "white" }}>{meta.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{a.platform}</p>
                    <p className="font-mono font-bold truncate text-sm">{a.gamertag}</p>
                    {a.current_rank_display && <p className="text-[10px] text-primary font-semibold">{a.current_rank_display}</p>}
                  </div>
                  <button onClick={() => copy(a.platform, a.gamertag)}
                    className="h-9 w-9 rounded-lg bg-surface hover:bg-surface-2 grid place-items-center transition-colors">
                    {copied === a.platform ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button onClick={() => deleteLinked.mutate(a.id)}
                    className="h-9 w-9 rounded-lg bg-surface hover:bg-destructive/20 hover:text-destructive grid place-items-center transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="mt-6">
        <AvailabilityGrid userId={userId!} editable />
      </div>

      {/* LFG ad shortcut */}
      <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-black">Looking for squad?</p>
          <p className="text-xs text-muted-foreground">Toggle your profile public and post an LFG ad from the Find page.</p>
        </div>
      </div>


      {/* Showcase */}
      <div className="mt-6">

        <h2 className="font-display text-xl font-black mb-3">Showcase</h2>
        <div className="grid grid-cols-3 gap-3">
          {pinned.map((c) => (
            <div key={c.id} className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-border group cursor-pointer">
              <img src={c.thumb} alt={c.title} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{c.game}</p>
                <p className="text-xs font-bold truncate">{c.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && <EditProfileDialog profile={profile} userId={userId!} onClose={() => setEditing(false)} />}
      {adding && (
        <AddLinkedDialog
          userId={userId!}
          existing={linked.map((l) => l.platform)}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function EditProfileDialog({ profile, userId, onClose }: { profile: Profile; userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [timezone, setTimezone] = useState(profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [age, setAge] = useState<string>(profile.age?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const ageNum = age.trim() === "" ? null : Number(age);
      if (ageNum !== null && (isNaN(ageNum) || ageNum < 13 || ageNum > 120)) {
        toast.error("Age must be between 13 and 120");
        setBusy(false);
        return;
      }
      if (!/^[a-z0-9_]{3,24}$/i.test(username)) {
        toast.error("Username must be 3–24 chars, letters/numbers/underscore");
        setBusy(false);
        return;
      }
      const { error } = await supabase.from("profiles").update({
        username: username.toLowerCase(),
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        country: country.trim() || null,
        timezone: timezone.trim() || null,
        age: ageNum,
      }).eq("id", userId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Profile saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <div className="space-y-3">
        <Row label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} maxLength={24} />
        </Row>
        <Row label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} maxLength={40} />
        </Row>
        <Row label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className={`${inputCls} min-h-[80px] py-2`} maxLength={280} />
          <p className="text-[10px] text-muted-foreground text-right mt-1">{bio.length}/280</p>
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Country">
            <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="US" maxLength={40} />
          </Row>
          <Row label="Age">
            <input value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} inputMode="numeric" maxLength={3} />
          </Row>
        </div>
        <Row label="Timezone">
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls} placeholder="America/Los_Angeles" />
        </Row>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border bg-surface text-sm font-bold hover:bg-surface-2">Cancel</button>
          <button onClick={save} disabled={busy} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddLinkedDialog({ userId, existing, onClose }: { userId: string; existing: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const available = PLATFORMS.filter((p) => !existing.includes(p));
  const [platform, setPlatform] = useState<string>(available[0] ?? "Steam");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (available.length === 0) {
      toast.info("All platforms already linked");
      onClose();
    }
  }, [available.length, onClose]);

  const save = async () => {
    if (!tag.trim()) {
      toast.error("Enter a gamertag");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("linked_accounts").insert({
        user_id: userId,
        platform,
        gamertag: tag.trim(),
        current_rank_display: null,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["linked-accounts", userId] });
      toast.success(`${platform} linked`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link");
    } finally {
      setBusy(false);
    }
  };

  // Mock OAuth quick-connect: simulates a third-party handshake and inserts a linked_account.
  const quickConnect = async (provider: "Steam" | "Discord" | "Tracker.gg") => {
    const platformName = provider === "Tracker.gg" ? "Steam" : provider === "Discord" ? "Discord" : "Steam";
    if (existing.includes(platformName)) {
      toast.info(`${platformName} already linked`);
      return;
    }
    setConnecting(provider);
    // Simulate redirect + token exchange
    await new Promise((r) => setTimeout(r, 900));
    const mockTag =
      provider === "Steam" ? `steamuser_${Math.floor(Math.random() * 9000 + 1000)}` :
      provider === "Discord" ? `discord_${Math.floor(Math.random() * 9000 + 1000)}#${Math.floor(Math.random() * 9000 + 1000)}` :
      `tracker_${Math.floor(Math.random() * 9000 + 1000)}`;
    try {
      const { error } = await supabase.from("linked_accounts").insert({
        user_id: userId,
        platform: platformName,
        gamertag: mockTag,
        current_rank_display: provider === "Tracker.gg" ? "Diamond II · 1.45 K/D" : null,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["linked-accounts", userId] });
      toast.success(`${provider} connected`, { description: `Mock account: ${mockTag}` });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <Modal title="Add platform" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Quick connect (mock)</p>
          <div className="grid grid-cols-3 gap-2">
            {(["Steam", "Discord", "Tracker.gg"] as const).map((p) => (
              <button
                key={p}
                onClick={() => quickConnect(p)}
                disabled={connecting !== null}
                className="h-16 rounded-xl border border-border bg-surface hover:bg-surface-2 text-xs font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition"
              >
                {connecting === p ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className="text-lg">{p === "Steam" ? "🎮" : p === "Discord" ? "💬" : "📊"}</span>
                )}
                <span>{p}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Mock OAuth — real Steam/Discord/Tracker.gg integration coming soon.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Or add manually</p>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Row label="Platform">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
            {available.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Row>
        <Row label="Gamertag / ID">
          <input value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} placeholder="ghostshot42#1234" />
        </Row>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border bg-surface text-sm font-bold hover:bg-surface-2">Cancel</button>
          <button onClick={save} disabled={busy} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-card border-t sm:border border-border sm:rounded-3xl rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-black">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface grid place-items-center hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-primary transition";
