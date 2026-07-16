import { useMemo, useState } from "react";
import { Sparkles, Check, ExternalLink, PackageOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useInventory, equipItem, type ShopItem } from "@/hooks/use-inventory";
import { EmptyState } from "./EmptyState";
import { CosmeticAvatar } from "@/components/cosmetics/CosmeticAvatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Owned cosmetics manager for Settings. Groups everything the user owns
 * by category so equipping/unequipping never requires opening the shop.
 */
export function OwnedCosmeticsSection() {
  const { rows, loading, reload } = useInventory();
  const [filter, setFilter] = useState<"all" | ShopItem["type"]>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => filter === "all" || r.item.type === filter);
    return list.sort((a, b) => Number(b.equipped) - Number(a.equipped));
  }, [rows, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      halo: rows.filter((r) => r.item.type === "halo").length,
      avatar_frame: rows.filter((r) => r.item.type === "avatar_frame").length,
      background: rows.filter((r) => r.item.type === "background").length,
      tag: rows.filter((r) => r.item.type === "tag").length,
    }),
    [rows],
  );

  const toggle = async (item: ShopItem, equipped: boolean) => {
    setBusy(item.id);
    try {
      await equipItem(item.id, !equipped);
      toast.success(equipped ? `Unequipped ${item.name}` : `Equipped ${item.name}`, {
        description: equipped ? "Removed from your look." : "Applied across your profile.",
      });
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update cosmetic");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="cosmic"
        title="Your loadout is empty"
        body="Head to the shop to unlock halos, frames, tags, and animated backgrounds."
        action={
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" /> Open shop
          </Link>
        }
        className="!py-8"
      />
    );
  }

  const chips: Array<[typeof filter, string, number]> = [
    ["all", "All", counts.all],
    ["halo", "Halos", counts.halo],
    ["avatar_frame", "Frames", counts.avatar_frame],
    ["background", "Backgrounds", counts.background],
    ["tag", "Tags", counts.tag],
  ];

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 mb-3">
        {chips
          .filter(([, , n]) => n > 0 || filter !== "all")
          .map(([id, label, n]) => {
            const active = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "shrink-0 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border transition",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {label}
                <span className="ml-1 opacity-70">{n}</span>
              </button>
            );
          })}
        <Link
          to="/shop"
          className="ml-auto shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border border-primary/40 text-primary hover:bg-primary/10"
        >
          <ExternalLink className="h-3 w-3" /> Shop
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          <PackageOpen className="h-4 w-4 mx-auto mb-1 opacity-60" />
          Nothing in this category yet.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className={cn(
                "relative rounded-xl border p-2.5 flex flex-col items-center gap-2 text-center transition overflow-hidden",
                r.equipped ? "border-primary/60 bg-primary/5" : "border-border bg-surface/60",
                r.item.type === "background" && r.item.css_class,
              )}
            >
              {r.equipped && (
                <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 text-[9px] uppercase tracking-widest font-black text-emerald-500">
                  <Check className="h-2.5 w-2.5" /> On
                </span>
              )}
              <Preview item={r.item} />
              <div className="min-w-0 w-full">
                <p className="text-[11px] font-bold truncate">{r.item.name}</p>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {r.item.type.replace("_", " ")}
                </p>
              </div>
              <button
                disabled={busy === r.item.id}
                onClick={() => toggle(r.item, r.equipped)}
                className={cn(
                  "w-full rounded-md text-[10px] font-bold uppercase tracking-widest py-1 transition disabled:opacity-50",
                  r.equipped
                    ? "bg-surface hover:bg-surface-2 text-muted-foreground"
                    : "bg-primary text-primary-foreground hover:opacity-90",
                )}
              >
                {busy === r.item.id ? "…" : r.equipped ? "Unequip" : "Equip"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Preview({ item }: { item: ShopItem }) {
  if (item.type === "halo") {
    return (
      <CosmeticAvatar size={44} haloClass={item.css_class ?? undefined}>
        <div className="h-full w-full rounded-full bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/10" />
      </CosmeticAvatar>
    );
  }
  if (item.type === "avatar_frame") {
    return (
      <CosmeticAvatar size={44} frameClass={item.css_class ?? undefined}>
        <div className="h-full w-full rounded-full bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/10" />
      </CosmeticAvatar>
    );
  }
  if (item.type === "background") {
    return <div className={cn("h-11 w-full rounded-md border border-border", item.css_class)} />;
  }
  return (
    <span className="text-[9px] px-2 py-1 rounded-full border border-primary/50 text-primary font-black uppercase tracking-widest">
      {item.name}
    </span>
  );
}
