import { createFileRoute, redirect } from "@tanstack/react-router";
import { Shell } from "@/components/squadz/Shell";
import { SquadzProvider } from "@/lib/squadz-store";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/use-auth";

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
      { title: "SQUADZ — Your gaming social hub" },
      { name: "description", content: "Find squads, join clubs, share clips, and link every gaming platform in one passport." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="dark">
      <AuthProvider>
        <SquadzProvider>
          <Shell />
          <Toaster theme="dark" position="top-center" />
        </SquadzProvider>
      </AuthProvider>
    </div>
  );
}
