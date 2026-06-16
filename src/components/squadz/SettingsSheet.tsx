import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, Eye, Volume2, Palette, ShieldAlert, Sparkles } from "lucide-react";
import { signOut } from "@/hooks/use-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { AvatarPicker } from "./AvatarPicker";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { UserCircle, Wand2 } from "lucide-react";

type Prefs = {
  theme: "dark" | "light" | "system";
  notifSquad: boolean;
  notifDM: boolean;
  notifChallenges: boolean;
  sound: boolean;
  visibility: "public" | "squad";
  defaultPlatform: string;
};

const DEFAULTS: Prefs = {
  theme: "system",
  notifSquad: true,
  notifDM: true,
  notifChallenges: true,
  sound: true,
  visibility: "public",
  defaultPlatform: "PC",
};

const KEY = "rostr:settings";

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

export function SettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => { setPrefs(loadPrefs()); }, []);
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return setIsAdmin(false);
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      setIsAdmin(Boolean(data));
    })();
  }, [open]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event("rostr:settings-changed"));
  }, [prefs]);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl font-black">Settings</SheetTitle>
          <SheetDescription>Personalize how Rostr behaves.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Section icon={UserCircle} title="Profile picture">
            <AvatarPickerRow />
          </Section>

          <Section icon={Wand2} title="Customize your Rostr">
            <ThemeCustomizer />
          </Section>

          <Section icon={Palette} title="Appearance">
            <Row label="Theme">
              <Select value={prefs.theme} onValueChange={(v) => set("theme", v as Prefs["theme"])}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>

          <Section icon={Bell} title="Notifications">
            <ToggleRow label="Squad requests" value={prefs.notifSquad} onChange={(v) => set("notifSquad", v)} />
            <ToggleRow label="Direct messages" value={prefs.notifDM} onChange={(v) => set("notifDM", v)} />
            <ToggleRow label="1v1 challenge updates" value={prefs.notifChallenges} onChange={(v) => set("notifChallenges", v)} />
          </Section>

          <Section icon={Volume2} title="Sound">
            <ToggleRow label="Play sound effects" value={prefs.sound} onChange={(v) => set("sound", v)} />
          </Section>

          <Section icon={Eye} title="Privacy">
            <Row label="Profile visibility">
              <Select value={prefs.visibility} onValueChange={(v) => set("visibility", v as Prefs["visibility"])}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="squad">Squad only</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Default platform">
              <Select value={prefs.defaultPlatform} onValueChange={(v) => set("defaultPlatform", v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PC">PC</SelectItem>
                  <SelectItem value="PS">PlayStation</SelectItem>
                  <SelectItem value="Xbox">Xbox</SelectItem>
                  <SelectItem value="Switch">Switch</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>

          <Link
            to="/pricing"
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 hover:bg-amber-400/10 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-amber-500" /> Tokens & Rostr Pro
            </span>
            <span className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Store</span>
          </Link>

          {isAdmin && (
            <Link
              to="/moderation"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <ShieldAlert className="h-4 w-4 text-primary" /> Moderation queue
              </span>
              <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Admin</span>
            </Link>
          )}

          <div className="pt-4 border-t border-border">
            <Button variant="destructive" className="w-full" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Bell; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <p className="font-semibold text-sm">{title}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label}>
      <Switch checked={value} onCheckedChange={onChange} />
    </Row>
  );
}

function AvatarPickerRow() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setCurrent((data as any)?.avatar_url ?? null));
  }, [user]);
  async function pick(url: string) {
    setCurrent(url);
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile picture updated");
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-14 w-14 rounded-2xl overflow-hidden border-2 border-primary/60 bg-surface-2">
          {current ? <img src={current} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">Pick a preset — saved instantly.</p>
      </div>
      <AvatarPicker value={current} onChange={pick} />
    </div>
  );
}
