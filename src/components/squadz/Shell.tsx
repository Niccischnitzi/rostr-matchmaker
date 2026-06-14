import { useState, type ReactNode } from "react";
import { Users, MessageCircle, Film, UserCircle, Gamepad2, Shield, Swords, Trophy, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { FindTab } from "./FindTab";
import { ClubsTab } from "./ClubsTab";
import { ChatTab } from "./ChatTab";
import { MediaTab } from "./MediaTab";
import { ProfileTab } from "./ProfileTab";
import { ClansTab } from "./ClansTab";
import { ChallengesTab } from "./ChallengesTab";
import { TournamentsTab } from "./TournamentsTab";

export type TabKey = "find" | "clans" | "challenges" | "tournaments" | "clubs" | "chat" | "media" | "profile";

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "find", label: "Find", icon: Users },
  { key: "clans", label: "Clans", icon: Shield },
  { key: "challenges", label: "1v1", icon: Swords },
  { key: "tournaments", label: "Cups", icon: Trophy },
  { key: "clubs", label: "Clubs", icon: Hash },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "media", label: "Media", icon: Film },
  { key: "profile", label: "Me", icon: UserCircle },
];

export function Shell() {
  const [tab, setTab] = useState<TabKey>("find");

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
            <p className="font-semibold text-foreground">SQUADZ v0.1</p>
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

        <div className="flex-1 pb-24 lg:pb-0">
          <TabFrame visible={tab === "find"}><FindTab /></TabFrame>
          <TabFrame visible={tab === "clans"}><ClansTab /></TabFrame>
          <TabFrame visible={tab === "challenges"}><ChallengesTab /></TabFrame>
          <TabFrame visible={tab === "tournaments"}><TournamentsTab /></TabFrame>
          <TabFrame visible={tab === "clubs"}><ClubsTab /></TabFrame>
          <TabFrame visible={tab === "chat"}><ChatTab /></TabFrame>
          <TabFrame visible={tab === "media"}><MediaTab /></TabFrame>
          <TabFrame visible={tab === "profile"}><ProfileTab /></TabFrame>
        </div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="grid grid-cols-8">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[9px] font-semibold uppercase tracking-wider transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className={cn("relative", active && "after:absolute after:-top-2.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-6 after:rounded-full after:bg-primary")}>
                    <Icon className="h-4 w-4" />
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
          <p className="font-display font-black text-xl tracking-tight">SQUADZ</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Gaming social hub</p>
        </div>
      )}
      {compact && <p className="font-display font-black text-lg tracking-tight">SQUADZ</p>}
    </div>
  );
}

function TabFrame({ visible, children }: { visible: boolean; children: ReactNode }) {
  if (!visible) return null;
  return <div className="animate-in fade-in duration-200">{children}</div>;
}
