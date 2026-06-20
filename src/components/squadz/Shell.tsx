import { useState, type ReactNode, useEffect, useRef } from "react";
import { Users, MessageCircle, Film, UserCircle, Shield, Swords, Trophy, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FindTab } from "./FindTab";
import { ChatTab } from "./ChatTab";
import { MediaTab } from "./MediaTab";
import { ProfileTab } from "./ProfileTab";
import { ChallengesTab } from "./ChallengesTab";
import { TournamentsTab } from "./TournamentsTab";
import { CrewsTab } from "./CrewsTab";
import { SettingsSheet } from "./SettingsSheet";
import { OnboardingWizard } from "./OnboardingWizard";
import { RostrMark } from "./RostrMark";
import { IncomingCallListener } from "./IncomingCallListener";
import { recordDailyLoginOnce } from "@/lib/streak";
import { sfx } from "@/lib/sfx";
import { toast } from "sonner";
import { TabErrorBoundary } from "./TabErrorBoundary";

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
  const [swipeDx, setSwipeDx] = useState(0);
  // Track which tabs have ever been visited so we mount them once and just toggle visibility.
  const [mounted, setMounted] = useState<Set<TabKey>>(() => new Set<TabKey>(["find"]));
  useEffect(() => { setMounted((m) => m.has(tab) ? m : new Set([...m, tab])); }, [tab]);

  useEffect(() => { sfx.nav(); }, [tab]);
  useEffect(() => {
    recordDailyLoginOnce().then((r) => {
      if (r) toast.success(`Day ${r.streak} streak! +${r.reward} tokens`, { description: "Login bonus credited." });
    });
  }, []);

  const goTab = (dir: 1 | -1) => {
    const idx = tabs.findIndex((t) => t.key === tab);
    const next = tabs[(idx + dir + tabs.length) % tabs.length];
    if (next) setTab(next.key);
  };

  // Helper: walk up the DOM to see if a target sits inside a horizontally scrollable container
  const insideHorizontalScroller = (target: EventTarget | null) => {
    let el = target as HTMLElement | null;
    while (el && el !== document.body) {
      if (el.dataset?.swipeIgnore === "true") return true;
      const style = window.getComputedStyle(el);
      if ((style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
      el = el.parentElement;
    }
    return false;
  };

  // Touch swipe (mobile/tablet) — refs so state survives re-renders, plus velocity tracking
  const touchStart = useRef({ x: 0, y: 0, t: 0, active: false, locked: false, blocked: false });
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = {
      x: t.clientX,
      y: t.clientY,
      t: performance.now(),
      active: true,
      locked: false,
      blocked: insideHorizontalScroller(e.target),
    };
    setSwipeDx(0);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touchStart.current;
    if (!s.active || s.blocked) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        s.blocked = true;
        setSwipeDx(0);
        return;
      }
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) s.locked = true;
    }
    if (s.locked) {
      const damped = Math.sign(dx) * Math.pow(Math.abs(dx), 0.88) * 0.55;
      setSwipeDx(Math.max(-140, Math.min(140, damped)));
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    if (!s.active) return;
    touchStart.current = { x: 0, y: 0, t: 0, active: false, locked: false, blocked: false };
    if (s.blocked) { setSwipeDx(0); return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const dt = Math.max(1, performance.now() - s.t);
    const vx = dx / dt;
    setSwipeDx(0);
    if (Math.abs(dx) > Math.abs(dy) * 1.2 && (Math.abs(dx) > 48 || Math.abs(vx) > 0.45)) {
      goTab(dx < 0 ? 1 : -1);
    }
  };


  // Trackpad / shift+wheel horizontal (desktop). Vertical wheel over the tab bar pages tabs too.
  useEffect(() => {
    let cooldown = false;
    const trigger = (dir: 1 | -1) => {
      if (cooldown) return;
      cooldown = true;
      goTab(dir);
      setTimeout(() => { cooldown = false; }, 380);
    };
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      const overTabBar = !!target?.closest?.("[data-swipe-tabbar='true']");
      if (overTabBar && Math.abs(e.deltaY) > 8 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        trigger(e.deltaY > 0 ? 1 : -1);
        return;
      }
      if (Math.abs(e.deltaX) < 32 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.2) return;
      if (insideHorizontalScroller(target)) return;
      trigger(e.deltaX > 0 ? 1 : -1);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [tab]);




  return (
    <div className="min-h-screen text-foreground flex bg-transparent">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border flex-col p-5 sticky top-0 h-screen bg-surface/40">
        <Brand />
        <nav data-swipe-tabbar="true" className="mt-8 flex flex-col gap-1">
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
        <button
          onClick={() => setSettingsOpen(true)}
          className="mt-auto flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-all"
        >
          <SettingsIcon className="h-5 w-5" /> Settings
        </button>
        <div className="mt-3 text-xs text-muted-foreground">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="font-semibold text-foreground">Rostr v0.1</p>
            <p className="mt-1">One passport. Every platform.</p>
          </div>
        </div>

      </aside>

      {/* Main area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header — ultra-compact */}
        <header data-app-header="true" className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3 py-2 border-b border-border bg-background/85 backdrop-blur-xl">
          <Brand compact />
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success pulse-ring" />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Online</span>
            </span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="h-7 w-7 rounded-lg bg-surface hover:bg-surface-2 grid place-items-center"
              aria-label="Settings"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div
          className="flex-1 pb-16 lg:pb-0 touch-pan-y"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            transform: swipeDx ? `translateX(${swipeDx}px)` : undefined,
            transition: swipeDx === 0 ? "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
            willChange: "transform",
          }}
        >

          {/* Tabs are mounted once visited and toggled with display:none — keeps state, eliminates remount jank. */}
          {mounted.has("find") && (
            <TabFrame active={tab === "find"} tabKey="find">
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
          )}
          {mounted.has("clans") && (
            <TabFrame active={tab === "clans"} tabKey="clans">
              <SubNav
                items={[
                  { key: "crews", label: "Crews", icon: Shield },
                  { key: "cups", label: "Cups", icon: Trophy },
                ]}
                value={clansSub}
                onChange={(v) => setClansSub(v as ClansSub)}
              />
              {clansSub === "crews" && <CrewsTab />}
              {clansSub === "cups" && <TournamentsTab />}
            </TabFrame>
          )}
          {mounted.has("chat")    && <TabFrame active={tab === "chat"}    tabKey="chat"><ChatTab /></TabFrame>}
          {mounted.has("media")   && <TabFrame active={tab === "media"}   tabKey="media"><MediaTab /></TabFrame>}
          {mounted.has("profile") && <TabFrame active={tab === "profile"} tabKey="profile"><ProfileTab /></TabFrame>}


        </div>

        {/* Mobile bottom nav */}
        <nav
          data-swipe-tabbar="true"
          data-mobile-tabbar="true"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl"
        >
          <div className="relative grid grid-cols-5">
            {/* Animated active indicator */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 h-[2px] bg-primary rounded-full shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
              style={{
                width: `${100 / tabs.length}%`,
                left: `${(tabs.findIndex(t => t.key === tab) * 100) / tabs.length}%`,
                transition: "left 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider transition-colors duration-200",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px] transition-transform duration-300", active && "scale-110")} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>


      </main>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OnboardingWizard />
      <IncomingCallListener />
    </div>
  );
}


function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <RostrMark size={compact ? 40 : 56} />
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

function TabFrame({ active, tabKey, children }: { active: boolean; tabKey: string; children: ReactNode }) {
  return (
    <div
      key={tabKey}
      aria-hidden={!active}
      className={active ? "tab-mounted-show relative overflow-hidden" : "tab-mounted-hidden"}
    >
      {active && <div className="arcade-sweep" aria-hidden />}
      <TabErrorBoundary label={tabKey}>{children}</TabErrorBoundary>
    </div>
  );
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
    <div className="sticky top-0 lg:top-0 z-20 px-3 lg:px-6 pt-2 pb-1.5 bg-background/90 backdrop-blur-xl border-b border-border">
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
