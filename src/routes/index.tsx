import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/squadz/Shell";
import { SquadzProvider } from "@/lib/squadz-store";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SQUADZ — Your gaming social hub" },
      { name: "description", content: "Find squads, join clubs, share clips, and link every gaming platform in one passport." },
      { property: "og:title", content: "SQUADZ — Your gaming social hub" },
      { property: "og:description", content: "Find squads, join clubs, share clips, and link every gaming platform in one passport." },
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
