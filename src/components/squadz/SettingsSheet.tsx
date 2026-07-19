import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LogOut, Bell, Eye, ShieldAlert, Sparkles, Accessibility,
  UserCircle, Wand2, CreditCard, Trash2,
} from "lucide-react";
import { signOut } from "@/hooks/use-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { AvatarPicker } from "./AvatarPicker";
import { OwnedCosmeticsSection } from "./OwnedCosmeticsSection";
import { PurchasesSection } from "./PurchasesSection";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Prefs = {
  theme: "dark" | "light" | "system";
  notifSquad: boolean;
  notifDM: boolean;
  notifChallenges: boolean;
  sound: boolean;
  visibility: "public" | "squad";
  defaultPlatform: string;
  highContrast: boolean;
  reduceMotion: boolean;
};

const DEFAULTS: Prefs = {
  theme: "system",
  notifSquad: true,
  notifDM: true,
  notifChallenges: true,
  sound: true,
  visibility: "public",
  defaultPlatform: "PC",
  highContrast: false,
  reduceMotion: false,
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
  const [section, setSection] = useState<string>("account");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

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
    navigate({ to: "/auth", replace: true, search: {} });
  };

  const goto = (to: string) => { onOpenChange(false); navigate({ to }); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background text-foreground">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-2xl font-black tracking-tight">Settings</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            One control per row. Tap a section to open it.
          </SheetDescription>
        </SheetHeader>

        <Accordion
          type="single"
          collapsible
          value={section}
          onValueChange={(v) => setSection(v || "")}
          className="mt-4 space-y-2"
        >
          <Group value="account" icon={UserCircle} label="Account" hint="Profile picture, sign in method">
            <AvatarPickerRow />
            <RowStack>
              <RowStatic label="Signed in as">
                <span className="text-sm font-semibold truncate max-w-[180px]">{user?.email ?? "—"}</span>
              </RowStatic>
              <button
                type="button"
                onClick={() => goto("/reset-password")}
                className="w-full text-left text-sm font-semibold text-primary hover:underline"
              >
                Reset password →
              </button>
            </RowStack>
          </Group>

          <Group value="look" icon={Wand2} label="Look & feel" hint="Theme, accent, density">
            <ThemeCustomizer />
            <div className="h-px bg-border" />
            <div>
              <p className="text-xs uppercase tracking-widest font-black text-muted-foreground mb-2">
                My cosmetics
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Equip owned backgrounds, halos, frames, and tags — applied everywhere instantly.
              </p>
            </div>
            <OwnedCosmeticsSection />
          </Group>

          <Group value="notifs" icon={Bell} label="Notifications" hint="Which pings reach you">
            <ToggleRow label="Squad requests" value={prefs.notifSquad} onChange={(v) => set("notifSquad", v)} />
            <ToggleRow label="Direct messages" value={prefs.notifDM} onChange={(v) => set("notifDM", v)} />
            <ToggleRow label="1v1 challenge updates" value={prefs.notifChallenges} onChange={(v) => set("notifChallenges", v)} />
            <div className="h-px bg-border my-1" />
            <ToggleRow label="Play sound effects" value={prefs.sound} onChange={(v) => set("sound", v)} />
          </Group>

          <Group value="privacy" icon={Eye} label="Profile & privacy" hint="Who sees you and where">
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
          </Group>

          <Group value="a11y" icon={Accessibility} label="Accessibility" hint="Contrast and motion">
            <ToggleRow
              label="High contrast mode"
              value={prefs.highContrast}
              onChange={(v) => set("highContrast", v)}
            />
            <p className="text-[11px] text-muted-foreground -mt-1">
              Boosts contrast on backgrounds, text, and borders.
            </p>
            <div className="h-px bg-border my-1" />
            <ToggleRow
              label="Reduce motion"
              value={prefs.reduceMotion}
              onChange={(v) => set("reduceMotion", v)}
            />
            <p className="text-[11px] text-muted-foreground -mt-1">
              Softens transitions and disables auto-playing backgrounds.
            </p>
          </Group>

          <Group value="billing" icon={CreditCard} label="Billing" hint="Shards, Pro, purchase history">
            <Link
              to="/pricing"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/40 bg-primary text-primary-foreground hover:opacity-95 transition-opacity"
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="h-4 w-4" /> Shards &amp; Rostr Pro
              </span>
              <span className="text-[10px] uppercase tracking-widest font-black">Store</span>
            </Link>
            {user && (
              <div className="pt-2">
                <PurchasesSection userId={user.id} />
              </div>
            )}
          </Group>

          {isAdmin && (
            <Group value="admin" icon={ShieldAlert} label="Admin" hint="Moderation tools">
              <Link
                to="/moderation"
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-foreground/40 bg-foreground text-background hover:opacity-95 transition-opacity"
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <ShieldAlert className="h-4 w-4" /> Moderation queue
                </span>
                <span className="text-[10px] uppercase tracking-widest font-black">Open</span>
              </Link>
            </Group>
          )}
        </Accordion>

        {/* DANGER ZONE — visually separated at the bottom */}
        <div className="mt-8 pt-5 border-t-2 border-destructive/40">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 className="h-4 w-4 text-destructive" />
            <p className="font-display text-xs uppercase tracking-widest font-black text-destructive">
              Danger zone
            </p>
          </div>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
            <button
              type="button"
              onClick={() =>
                toast("Delete account", {
                  description: "Email support@rostr.app to permanently delete your account.",
                })
              }
              className="w-full text-left text-xs px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            >
              Delete my account →
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- Building blocks ---------- */

function Group({
  value, icon: Icon, label, hint, children,
}: {
  value: string;
  icon: typeof Bell;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="rounded-2xl border border-border bg-surface/40 data-[state=open]:bg-surface data-[state=open]:border-primary/40 transition-colors overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex min-w-0 items-center gap-3 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground truncate">{label}</span>
            {hint && (
              <span className="block text-[11px] text-muted-foreground truncate">{hint}</span>
            )}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3 pt-1">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RowStatic({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      {children}
    </div>
  );
}

function RowStack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
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
        <div className="h-14 w-14 rounded-2xl overflow-hidden border-2 border-primary/60 bg-surface-2 shrink-0">
          {current ? <img src={current} alt="Your avatar" className="h-full w-full object-cover" /> : null}
        </div>
        <p className="text-xs text-muted-foreground min-w-0">Pick a preset — saved instantly.</p>
      </div>
      <AvatarPicker value={current} onChange={pick} />
    </div>
  );
}
