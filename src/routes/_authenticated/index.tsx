import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/squadz/Shell";
import { SquadzProvider } from "@/lib/squadz-store";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/")({
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
      <SquadzProvider>
        <Shell />
        <Toaster theme="dark" position="top-center" />
      </SquadzProvider>
    </div>
  );
}
