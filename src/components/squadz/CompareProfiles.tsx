import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./UserAvatar";
import { X } from "lucide-react";
import type { Player } from "@/lib/squadz-data";

export type CompareCard = Player & { isLfg?: boolean; realId?: string; lfgTitle?: string | null };

const ROWS: Array<{ label: string; get: (c: CompareCard) => string }> = [
  { label: "Type", get: (c) => (c.isLfg ? "LFG ad" : "Player") },
  { label: "Age", get: (c) => (c.age ? String(c.age) : "—") },
  { label: "Country", get: (c) => c.location || c.country || "—" },
  { label: "Timezone", get: (c) => c.timezone || "—" },
  { label: "Status", get: (c) => c.playstyle || "—" },
  { label: "Games", get: (c) => (c.games.length ? c.games.map((g) => g.name).join(", ") : "—") },
  { label: "Traits", get: (c) => (c.traits.length ? c.traits.join(", ") : "—") },
];

/** Side-by-side comparison of up to 3 candidates from the Find deck. */
export function CompareProfiles({
  cards,
  open,
  onOpenChange,
  onRemove,
}: {
  cards: CompareCard[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare {cards.length} {cards.length === 1 ? "player" : "players"}</DialogTitle>
        </DialogHeader>

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add players from the deck to compare them here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="w-24" />
                  {cards.map((c) => (
                    <th key={c.id} className="p-2 align-bottom min-w-[9rem]">
                      <div className="flex flex-col items-center gap-1.5">
                        <UserAvatar userId={c.realId ?? c.id} avatarUrl={c.avatar} fallback={c.username} size={48} className="rounded-xl" />
                        <span className="font-bold truncate max-w-[8rem]">{c.username}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => onRemove(c.id)}>
                          <X className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? "bg-surface/50" : undefined}>
                    <td className="p-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground align-top">
                      {row.label}
                    </td>
                    {cards.map((c) => (
                      <td key={c.id} className="p-2 align-top text-xs">{row.get(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
