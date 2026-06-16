import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Gamepad2, MapPin, Cake } from "lucide-react";
import { toast } from "sonner";
import { RostrMark } from "./RostrMark";
import { sfx } from "@/lib/sfx";

const TRAITS = ["Toxic-free", "Tryhard", "Chill", "Shot-caller", "Night Owl", "Funny", "Mic'd up"];
const GAMES = ["Valorant", "Apex", "CS2", "Fortnite", "League", "Rocket League", "Overwatch", "Warzone", "Minecraft", "Other"];

export function OnboardingWizard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [games, setGames] = useState<string[]>([]);
  const [traits, setTraits] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [dob, setDob] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("onboarded_at, country").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data && !(data as any).onboarded_at) setOpen(true);
        if ((data as any)?.country) setCountry((data as any).country);
      });
  }, [user]);

  if (!open || !user) return null;

  const next = () => { sfx.tap(); setStep((s) => s + 1); };
  const back = () => { sfx.tap(); setStep((s) => Math.max(0, s - 1)); };

  async function finish() {
    if (!user) return;
    setBusy(true);
    try {
      // age gate
      if (dob) {
        const birth = new Date(dob);
        const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
        if (age < 13) {
          toast.error("You must be 13 or older to use Rostr.");
          setBusy(false);
          await supabase.auth.signOut();
          window.location.href = "/auth";
          return;
        }
      }
      const { error } = await supabase.from("profiles").update({
        country: country.trim() || null,
        bio: bio.trim() || null,
        date_of_birth: dob || null,
        onboarded_at: new Date().toISOString(),
        lfg_games: games,
      } as any).eq("id", user.id);
      if (error) throw error;
      sfx.win();
      toast.success("Welcome to Rostr!");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    {
      title: "Welcome to Rostr",
      icon: Sparkles,
      body: (
        <div className="text-center">
          <RostrMark size={96} className="mx-auto rounded-2xl" />
          <p className="mt-4 text-sm text-muted-foreground">
            Let's get you set up so you build your rostr fast. Takes 30 seconds.
          </p>
        </div>
      ),
    },
    {
      title: "Pick your main games",
      icon: Gamepad2,
      body: (
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => {
            const on = games.includes(g);
            return (
              <button key={g} onClick={() => setGames((p) => on ? p.filter((x) => x !== g) : [...p, g])}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface"}`}>
                {g}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: "Your vibe",
      icon: Sparkles,
      body: (
        <div className="flex flex-wrap gap-2">
          {TRAITS.map((t) => {
            const on = traits.includes(t);
            return (
              <button key={t} onClick={() => setTraits((p) => on ? p.filter((x) => x !== t) : [...p, t])}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface"}`}>
                {t}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: "Where & when",
      icon: MapPin,
      body: (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Country</span>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Germany" maxLength={48} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Short bio</span>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="EU evenings, ranked Valorant, comms always on." maxLength={200} className="min-h-[70px]" />
          </label>
        </div>
      ),
    },
    {
      title: "Age verification",
      icon: Cake,
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Required for safety. Never shown to others.</p>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date of birth</span>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
        </div>
      ),
    },
  ];

  const cur = steps[step];
  const Icon = cur.icon;
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[90] bg-background/95 backdrop-blur-xl grid place-items-center p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl overflow-hidden soft-rise">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Step {step + 1} of {steps.length}</p>
            <p className="font-display text-lg font-black">{cur.title}</p>
          </div>
        </div>
        <div className="p-5 min-h-[180px]">{cur.body}</div>
        <div className="p-4 border-t border-border flex gap-2">
          {step > 0 && <Button variant="outline" onClick={back} disabled={busy} className="flex-1">Back</Button>}
          {!last ? (
            <Button onClick={next} className="flex-1">Continue</Button>
          ) : (
            <Button onClick={finish} disabled={busy} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Let's go"}
            </Button>
          )}
        </div>
        <div className="px-5 pb-4">
          <div className="h-1 rounded-full bg-surface overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
