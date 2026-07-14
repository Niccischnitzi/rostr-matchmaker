import { useState, type ReactNode, useEffect, useRef } from "react";
import { Users, MessageCircle, UserCircle, Shield, Trophy, Settings as SettingsIcon, Sparkles, ShoppingBag } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { FindTab } from "./FindTab";
import { ChatTab } from "./ChatTab";
import { CommunityTab } from "./CommunityTab";
import { ProfileTab } from "./ProfileTab";
import { TournamentsTab } from "./TournamentsTab";
import { CrewsTab } from "./CrewsTab";
import { SettingsSheet } from "./SettingsSheet";
import { OnboardingWizard } from "./OnboardingWizard";
import { RostrMark } from "./RostrMark";
import { IncomingCallListener } from "./IncomingCallListener";
import { DevPanel } from "./DevPanel";
import { recordDailyLoginOnce } from "@/lib/streak";
import { sfx } from "@/lib/sfx";
import { toast } from "sonner";
import { TabErrorBoundary } from "./TabErrorBoundary";
import { TokenBalance } from "@/components/cosmetics/TokenBalance";
import { useApplyEquippedCosmetics } from "@/hooks/use-equipped-cosmetics";

export type TabKey = "find" | "clans" | "chat" | "community" | "profile";

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "find", label: "Find", icon: Users },
  { key: "clans", label: "Crews", icon: Shield },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "community", label: "Community", icon: Sparkles },
  { key: "profile", label: "Me", icon: UserCircle },
];

type ClansSub = "crews" | "cups";

export function Shell() {
  const [tab, setTab] = useState<TabKey>("find");
  const [tabDir, setTabDir] = useState<1 | -1>(1);
  const prevTabRef = useRef<TabKey>("find");
  const navigate = useNavigate();
  const [clansSub, setClansSub] = useState<ClansSub>("crews");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [swipeDx, setSwipeDx] = useState(0);
  // Track which tabs have ever been visited so we mount them once and just toggle visibility.
  const [mounted, setMounted] = useState<Set<TabKey>>(() => new Set<TabKey>(["find"]));
  useEffect(() => { setMounted((m) => m.has(tab) ? m : new Set([...m, tab])); }, [tab]);

  // Derive direction from previous tab index and play a soft swoosh.
  useEffect(() => {
    const prevIdx = tabs.findIndex((t) => t.key === prevTabRef.current);
    const nextIdx = tabs.findIndex((t) => t.key === tab);
    if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
      setTabDir(nextIdx > prevIdx ? 1 : -1);
      sfx.swoosh?.();
    }
    prevTabRef.current = tab;
  }, [tab]);

  useEffect(() => { sfx.nav(); }, [tab]);
  // Listen for cross-tab jumps (e.g. Find → Chat after squadding an LFG).
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: TabKey };
      if (detail?.tab) {
        setMounted((m) => m.has(detail.tab!) ? m : new Set([...m, detail.tab!]));
        setTab(detail.tab);
      }
    };
    window.addEventListener("rostr:switch-tab", h);
    return () => window.removeEventListener("rostr:switch-tab", h);
  }, []);
  useEffect(() => {
    recordDailyLoginOnce().then((r) => {
      if (r) toast.success(`Day ${r.streak} streak! +${r.reward} tokens`, { description: "Login bonus credited." });
    });
  }, []);

  // Apply equipped background + tag globally (halo/frame are consumed per-avatar).
  useApplyEquippedCosmetics();

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
                  "hover-spin-ring flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all",
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
        <div className="mt-3 flex items-center gap-2">
          <TokenBalance className="flex-1 justify-center" />
          <button
            onClick={() => navigate({ to: "/shop" })}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
          >
            <ShoppingBag className="h-4 w-4" /> Shop
          </button>
        </div>
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
          <div className="flex items-center gap-1.5">
            <TokenBalance compact />
            <button
              onClick={() => navigate({ to: "/shop" })}
              className="h-7 px-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition"
              aria-label="Shop"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Shop
            </button>
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
            <TabFrame active={tab === "find"} tabKey="find" dir={tabDir}>
              <FindTab />
            </TabFrame>
          )}
          {mounted.has("clans") && (
            <TabFrame active={tab === "clans"} tabKey="clans" dir={tabDir}>
              <SubNav
                items={[
                  { key: "crews", label: "Crews", icon: Shield },
                  { key: "cups", label: "Cups", icon: Trophy },
                ]}
                value={clansSub}
                onChange={(v) => setClansSub(v as ClansSub)}
              />
              <div key={clansSub} className="subpanel-swap">
                {clansSub === "crews" && <CrewsTab />}
                {clansSub === "cups" && <TournamentsTab />}
              </div>
            </TabFrame>
          )}
          {mounted.has("chat")      && <TabFrame active={tab === "chat"}      tabKey="chat"      dir={tabDir}><ChatTab /></TabFrame>}
          {mounted.has("community") && <TabFrame active={tab === "community"} tabKey="community" dir={tabDir}><CommunityTab /></TabFrame>}
          {mounted.has("profile")   && <TabFrame active={tab === "profile"}   tabKey="profile"   dir={tabDir}><ProfileTab /></TabFrame>}


        </div>

        {/* Mobile bottom nav */}
        <nav
          data-swipe-tabbar="true"
          data-mobile-tabbar="true"
          className="lg:hidden fixed bottom-2 inset-x-2 z-40 rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-lg overflow-hidden"
        >
          <div className="relative grid grid-cols-5 p-1">
            {/* Contained active pill */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-1 bottom-1 rounded-xl bg-primary/15 ring-1 ring-primary/30 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)]"
              style={{
                width: `calc(${100 / tabs.length}% - 0.25rem)`,
                left: `calc(${(tabs.findIndex(t => t.key === tab) * 100) / tabs.length}% + 0.125rem)`,
                transition: "left 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {/* BattleCard-style neon halo — contained by nav's overflow-hidden */}
              <div className="absolute inset-0 -z-10 rounded-xl bg-primary/20 blur-3xl animate-pulse" />
            </div>
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "relative z-10 flex flex-col items-center gap-0.5 py-1.5 text-[9px] uppercase tracking-wider transition-colors duration-200",
                    active ? "text-primary font-bold" : "text-muted-foreground font-semibold hover:text-foreground"
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
      <DevPanel />
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

function TabFrame({ active, tabKey, dir = 1, children }: { active: boolean; tabKey: string; dir?: 1 | -1; children: ReactNode }) {
  return (
    <div
      key={tabKey + (active ? `:${dir}` : "")}
      aria-hidden={!active}
      className={active
        ? `tab-mounted-show ${dir === 1 ? "tab-swap-right" : "tab-swap-left"} relative overflow-hidden`
        : "tab-mounted-hidden"}
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
              onClick={() => { sfx.pop(); onChange(it.key); }}
              className={cn(
                "hover-spin-ring flex-1 min-w-fit flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
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
