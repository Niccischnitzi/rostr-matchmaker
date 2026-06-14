import { useState, type ReactNode } from "react";
import { Users, MessageCircle, Film, UserCircle, Gamepad2, Shield, Swords, Trophy, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FindTab } from "./FindTab";
import { ChatTab } from "./ChatTab";
import { MediaTab } from "./MediaTab";
import { ProfileTab } from "./ProfileTab";
import { ChallengesTab } from "./ChallengesTab";
import { TournamentsTab } from "./TournamentsTab";
import { CrewsTab } from "./CrewsTab";
import { SettingsSheet } from "./SettingsSheet";

export type TabKey = "find" | "clans" | "chat" | "media" | "profile";

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "find", label: "Find", icon: Users },
  { key: "clans", label: "Crews", icon: Shield },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "media", label: "Media", icon: Film },
  { key: "profile", label: "Me", icon: UserCircle },
];

type FindSub = "players" | "1v1";
type ClansSub = "crews" | "cups";

export function Shell() {
  const [tab, setTab] = useState<TabKey>("find");
  const [findSub, setFindSub] = useState<FindSub>("players");
  const [clansSub, setClansSub] = useState<ClansSub>("crews");
  const [settingsOpen, setSettingsOpen] = useState(false);


  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border flex-col p-5 sticky top-0 h-screen bg-surface/40">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all",
                  active ? "bg-primary text-primary-foreground glow-orange" : "text-muted-foreground hover:bg-surface hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto text-xs text-muted-foreground">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="font-semibold text-foreground">Rostr v0.1</p>
            <p className="mt-1">One passport. Every platform.</p>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
          <Brand compact />
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success pulse-ring" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </header>

        <div className="flex-1 pb-20 lg:pb-0">
          <TabFrame visible={tab === "find"}>
            <SubNav
              items={[
                { key: "players", label: "Players", icon: Users },
                { key: "1v1", label: "1v1 Challenges", icon: Swords },
              ]}
              value={findSub}
              onChange={(v) => setFindSub(v as FindSub)}
            />
            {findSub === "players" ? <FindTab /> : <ChallengesTab />}
          </TabFrame>
          <TabFrame visible={tab === "clans"}>
            <SubNav
              items={[
                { key: "roster", label: "Clans", icon: Shield },
                { key: "cups", label: "Cups", icon: Trophy },
                { key: "clubs", label: "Clubs", icon: Hash },
              ]}
              value={clansSub}
              onChange={(v) => setClansSub(v as ClansSub)}
            />
            {clansSub === "roster" && <ClansTab />}
            {clansSub === "cups" && <TournamentsTab />}
            {clansSub === "clubs" && <ClubsTab />}
          </TabFrame>
          <TabFrame visible={tab === "chat"}><ChatTab /></TabFrame>
          <TabFrame visible={tab === "media"}><MediaTab /></TabFrame>
          <TabFrame visible={tab === "profile"}><ProfileTab /></TabFrame>
        </div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="grid grid-cols-5">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className={cn("relative", active && "after:absolute after:-top-2.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-primary")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center glow-orange">
        <Gamepad2 className="h-5 w-5 text-primary-foreground" />
      </div>
      {!compact && (
        <div>
          <p className="font-display font-black text-xl tracking-tight">Rostr</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Gaming social hub</p>
        </div>
      )}
      {compact && <p className="font-display font-black text-lg tracking-tight">Rostr</p>}
    </div>
  );
}

function TabFrame({ visible, children }: { visible: boolean; children: ReactNode }) {
  if (!visible) return null;
  return <div className="animate-in fade-in duration-200">{children}</div>;
}

function SubNav({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string; icon: typeof Users }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="sticky top-0 lg:top-0 z-20 px-4 lg:px-6 pt-3 pb-2 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="flex gap-1 p-1 rounded-xl bg-surface/60 border border-border w-full overflow-x-auto">
        {items.map((it) => {
          const Icon = it.icon;
          const active = value === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={cn(
                "flex-1 min-w-fit flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                active ? "bg-primary text-primary-foreground glow-orange" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
