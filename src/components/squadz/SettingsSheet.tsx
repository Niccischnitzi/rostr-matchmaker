import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, Eye, Volume2, Palette } from "lucide-react";
import { signOut } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

type Prefs = {
  theme: "dark" | "system";
  notifSquad: boolean;
  notifDM: boolean;
  notifChallenges: boolean;
  sound: boolean;
  visibility: "public" | "squad";
  defaultPlatform: string;
};

const DEFAULTS: Prefs = {
  theme: "dark",
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
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => { setPrefs(loadPrefs()); }, []);
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
          <SheetDescription>Personalize how ostr behaves.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Section icon={Palette} title="Appearance">
            <Row label="Theme">
              <Select value={prefs.theme} onValueChange={(v) => set("theme", v as Prefs["theme"])}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
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
