import { useState } from "react";
import { Shield, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClansTab } from "./ClansTab";
import { ClubsTab } from "./ClubsTab";

type Mode = "competitive" | "social";

export function CrewsTab() {
  const [mode, setMode] = useState<Mode>("competitive");
  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="inline-flex p-1 rounded-xl bg-surface/60 border border-border">
          <ModeBtn active={mode === "competitive"} onClick={() => setMode("competitive")} icon={Shield} label="Competitive" hint="Clans · ELO" />
          <ModeBtn active={mode === "social"} onClick={() => setMode("social")} icon={Hash} label="Social" hint="Clubs · Chat" />
        </div>
      </div>
      {mode === "competitive" ? <ClansTab /> : <ClubsTab />}
    </div>
  );
}

function ModeBtn({
  active, onClick, icon: Icon, label, hint,
}: { active: boolean; onClick: () => void; icon: typeof Shield; label: string; hint: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
        active ? "bg-primary text-primary-foreground glow-orange" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span className={cn("text-[9px] font-normal uppercase tracking-widest", active ? "opacity-80" : "opacity-60")}>{hint}</span>
      </span>
    </button>
  );
}
