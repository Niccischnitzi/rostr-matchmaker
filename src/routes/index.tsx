import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useSyncExternalStore } from "react";
import { Shell } from "@/components/squadz/Shell";
import { SquadzProvider } from "@/lib/squadz-store";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";
import { SteamClaimListener } from "@/components/squadz/SteamClaimListener";
import { initThemeMode, getResolvedThemeMode } from "@/lib/theme-mode";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Rostr — Your gaming social hub" },
      { name: "description", content: "Build your rostr, join clubs, share clips, and link every gaming platform in one passport." },
    ],
  }),
  component: Index,
});

function subscribeTheme(cb: () => void) {
  window.addEventListener("rostr:settings-changed", cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener("rostr:settings-changed", cb);
    mq.removeEventListener("change", cb);
  };
}

function Index() {
  useEffect(() => initThemeMode(), []);
  const mode = useSyncExternalStore(
    subscribeTheme,
    () => getResolvedThemeMode(),
    () => "dark" as const,
  );
  return (
    <AuthProvider>
      <SquadzProvider>
        <SteamClaimListener />
        <Shell />
        <Toaster theme={mode} position="top-center" />
      </SquadzProvider>
    </AuthProvider>
  );
}
