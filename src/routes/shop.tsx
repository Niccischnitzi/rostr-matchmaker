import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Coins, Lock, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/hooks/use-wallet";
import { useShopItems, useInventory, purchaseItem, equipItem, type ShopItem } from "@/hooks/use-inventory";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { TokenBalance } from "@/components/cosmetics/TokenBalance";
import { CosmeticAvatar } from "@/components/cosmetics/CosmeticAvatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  errorComponent: () => <div className="p-6">Failed to load the shop.</div>,
  notFoundComponent: () => <div className="p-6">Not found.</div>,
  head: () => ({
    meta: [
      { title: "Token Shop — Rostr" },
      { name: "description", content: "Buy Rostr tokens and unlock halos, avatar frames, and animated backgrounds." },
      { property: "og:title", content: "Token Shop — Rostr" },
      { property: "og:description", content: "Buy Rostr tokens and unlock cosmetics." },
      { property: "og:type", content: "website" },
    ],
  }),
});

const TOKEN_PACKS = [
  { priceId: "tokens_500", tokens: 500, price: "$4.99" },
  { priceId: "tokens_1200", tokens: 1200, price: "$9.99", badge: "Popular" },
  { priceId: "tokens_3000", tokens: 3000, price: "$19.99" },
  { priceId: "tokens_7500", tokens: 7500, price: "$39.99", badge: "Best value" },
];

type TabKey = "cosmetics" | "tokens";

function ShopPage() {
  const { user, loading: authLoading } = useAuth();
  const { balance, adjust, refresh } = useWallet();
  const { items, loading } = useShopItems();
  const { rows, equipped, reload } = useInventory();
  const [tab, setTab] = useState<TabKey>("cosmetics");
  const [activePrice, setActivePrice] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [optimisticOwned, setOptimisticOwned] = useState<Set<string>>(new Set());

  const ownedIds = useMemo(
    () => new Set([...rows.map((r) => r.item_id), ...optimisticOwned]),
    [rows, optimisticOwned],
  );

  const buy = async (item: ShopItem) => {
    if (!user) return;
    if ((balance ?? 0) < item.cost_tokens) {
      toast.error("Not enough tokens", { description: "Grab a token pack below." });
      setTab("tokens");
      return;
    }
    setBusyId(item.id);
    // Optimistic: mark owned + debit balance immediately.
    setOptimisticOwned((s) => new Set(s).add(item.id));
    adjust(-item.cost_tokens);
    try {
      const res = await purchaseItem(item.id);
      if (res.already_owned) toast.info("You already own this");
      else toast.success(`Unlocked ${item.name}`);
      await Promise.all([reload(), refresh()]);
    } catch (e: any) {
      // Revert optimistic state on failure.
      setOptimisticOwned((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
      adjust(item.cost_tokens);
      toast.error(e?.message ?? "Purchase failed");
    } finally {
      setBusyId(null);
    }
  };

  const toggleEquip = async (item: ShopItem) => {
    const row = rows.find((r) => r.item_id === item.id);
    if (!row) return;
    try {
      await equipItem(item.id, !row.equipped);
      toast.success(row.equipped ? `Unequipped ${item.name}` : `Equipped ${item.name}`);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not equip");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold">Sign in to visit the shop</h1>
          <Link to="/auth" className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (activePrice) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="max-w-2xl mx-auto p-4">
          <button
            onClick={() => setActivePrice(null)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to shop
          </button>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <StripeEmbeddedCheckout priceId={activePrice} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <header className="max-w-6xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <TokenBalance />
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Token Shop</h1>
          <p className="text-muted-foreground">Unlock halos, frames, and animated backgrounds with tokens.</p>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-muted p-1">
            {([
              ["cosmetics", "Cosmetics"],
              ["tokens", "Buy Tokens"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition",
                  tab === id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "cosmetics" && (
          <>
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const owned = ownedIds.has(item.id);
                  const isEquipped = rows.find((r) => r.item_id === item.id)?.equipped ?? false;
                  const busy = busyId === item.id;
                  const canAfford = (balance ?? 0) >= item.cost_tokens;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "relative rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 overflow-hidden transition",
                        item.type === "background" && item.css_class,
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.type.replace("_", " ")}</div>
                          <div className="font-display text-lg font-bold">{item.name}</div>
                        </div>
                        {owned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">
                            <Check className="h-3 w-3" /> OWNED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-center h-24 rounded-xl bg-background/60 border border-border/60">
                        <PreviewGlyph item={item} />
                      </div>

                      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-sm font-bold">
                          <Coins className="h-4 w-4 text-primary" />
                          {item.cost_tokens.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewItem(item)}
                            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
                          >
                            Preview
                          </button>
                          {owned ? (
                            <button
                              onClick={() => toggleEquip(item)}
                              className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                                isEquipped
                                  ? "bg-emerald-500 text-white hover:opacity-90"
                                  : "bg-primary text-primary-foreground hover:opacity-90",
                              )}
                            >
                              {isEquipped ? "Equipped" : "Equip"}
                            </button>
                          ) : (
                            <button
                              disabled={busy || !canAfford}
                              onClick={() => buy(item)}
                              className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                            >
                              {!canAfford && <Lock className="h-3 w-3" />}
                              {busy ? "…" : canAfford ? "Buy" : "Need more"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "tokens" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TOKEN_PACKS.map((p) => (
              <div key={p.priceId} className="relative rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
                {p.badge && (
                  <span className="absolute -top-2 right-4 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-wide px-2 py-0.5">
                    {p.badge}
                  </span>
                )}
                <Coins className="h-6 w-6 text-primary" />
                <div className="font-display text-3xl font-bold">{p.tokens.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">tokens</div>
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="font-semibold">{p.price}</span>
                  <button
                    onClick={() => setActivePrice(p.priceId)}
                    className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className={cn(
              "relative rounded-3xl border border-border bg-card p-8 max-w-sm w-full flex flex-col items-center gap-4 overflow-hidden",
              previewItem.type === "background" && previewItem.css_class,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Preview</div>
            <div className="text-lg font-bold">{previewItem.name}</div>
            <CosmeticAvatar
              size={112}
              haloClass={previewItem.type === "halo" ? previewItem.css_class : equipped.halo?.css_class}
              frameClass={previewItem.type === "avatar_frame" ? previewItem.css_class : equipped.avatar_frame?.css_class}
            >
              <div className="h-full w-full rounded-full bg-gradient-to-br from-primary/60 to-primary/20 grid place-items-center text-3xl font-black">
                <Sparkles className="h-10 w-10" />
              </div>
            </CosmeticAvatar>
            <p className="text-sm text-muted-foreground text-center">{previewItem.description}</p>
            <button onClick={() => setPreviewItem(null)} className="mt-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewGlyph({ item }: { item: ShopItem }) {
  if (item.type === "halo") {
    return (
      <CosmeticAvatar size={72} haloClass={item.css_class}>
        <div className="h-full w-full rounded-full bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/10" />
      </CosmeticAvatar>
    );
  }
  if (item.type === "avatar_frame") {
    return (
      <CosmeticAvatar size={72} frameClass={item.css_class}>
        <div className="h-full w-full rounded-full bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/10" />
      </CosmeticAvatar>
    );
  }
  if (item.type === "background") {
    return <div className={cn("h-16 w-40 rounded-lg", item.css_class)} />;
  }
  return <div className="text-xs px-3 py-1 rounded-full border border-primary/50 text-primary font-bold uppercase tracking-widest">{item.name}</div>;
}
