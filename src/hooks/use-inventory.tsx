import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type ShopItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: "halo" | "avatar_frame" | "background" | "tag";
  cost_tokens: number;
  asset_url: string | null;
  preview_url: string | null;
  css_class: string | null;
  is_active: boolean;
  sort_order: number;
};

export type InventoryRow = {
  id: string;
  item_id: string;
  equipped: boolean;
  purchased_at: string;
  item: ShopItem;
};

export function useShopItems() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("shop_items")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (!cancelled) {
        setItems((data ?? []) as ShopItem[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return { items, loading };
}

export function useInventory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setRows([]); setLoading(false); return; }
    const { data } = await supabase
      .from("user_inventory")
      .select("id, item_id, equipped, purchased_at, item:shop_items(*)")
      .eq("user_id", user.id);
    setRows((data ?? []) as unknown as InventoryRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`inv:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_inventory", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const equipped = {
    halo: rows.find((r) => r.equipped && r.item.type === "halo")?.item ?? null,
    avatar_frame: rows.find((r) => r.equipped && r.item.type === "avatar_frame")?.item ?? null,
    background: rows.find((r) => r.equipped && r.item.type === "background")?.item ?? null,
    tag: rows.find((r) => r.equipped && r.item.type === "tag")?.item ?? null,
  };

  return { rows, equipped, loading, reload: load };
}

export async function purchaseItem(itemId: string) {
  const { data, error } = await supabase.rpc("purchase_shop_item", { _item_id: itemId });
  if (error) throw error;
  return data as { ok: boolean; balance?: number; already_owned?: boolean; item_key?: string };
}

export async function equipItem(itemId: string, equip: boolean) {
  const { error } = await supabase.rpc("equip_cosmetic", { _item_id: itemId, _equip: equip });
  if (error) throw error;
}
