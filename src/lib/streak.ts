import { supabase } from "@/integrations/supabase/client";

const KEY = "rostr:streak-checked";

export async function recordDailyLoginOnce() {
  if (typeof window === "undefined") return null;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(KEY) === today) return null;
  const { data, error } = await (supabase as any).rpc("record_daily_login");
  if (error) return null;
  localStorage.setItem(KEY, today);
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.reward > 0) return { streak: row.streak as number, reward: row.reward as number };
  return null;
}
