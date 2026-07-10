import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/** Wallet hook — `balance_points` doubles as the ROSTR token balance. */
export function useWallet() {
  const { user } = useAuth();
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
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { balance, loading };
}
