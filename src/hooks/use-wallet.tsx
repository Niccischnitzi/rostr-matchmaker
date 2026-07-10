import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/** Wallet hook — `balance_points` doubles as the ROSTR token balance. */
export function useWallet() {
  const { user } = useAuth();
  const instanceId = useRef(Math.random().toString(36).slice(2));
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance_points")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setBalance(data?.balance_points ?? 0);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel(`wallet:${user.id}:${instanceId.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return { balance, loading };
}
