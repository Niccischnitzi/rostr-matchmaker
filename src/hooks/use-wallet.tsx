import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/** Wallet hook — `balance_points` doubles as the ROSTR token balance. */
export function useWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setBalance(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("wallets")
      .select("balance_points")
      .eq("user_id", user.id)
      .maybeSingle();
    setBalance(data?.balance_points ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    // Live-update balance when webhook credits tokens or purchases spend them.
    const ch = supabase
      .channel(`wallet:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const next = payload?.new?.balance_points;
          if (typeof next === "number") setBalance(next);
          else load();
        },
      )
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, load]);

  // Optimistic mutation helper used by shop/checkout flows.
  const adjust = useCallback((delta: number) => {
    setBalance((b) => (b == null ? b : Math.max(0, b + delta)));
  }, []);

  return { balance, loading, refresh: load, adjust };
}
