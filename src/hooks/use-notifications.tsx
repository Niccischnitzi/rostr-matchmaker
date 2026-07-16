import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  link: string | null;

  read_at: string | null;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setUnread(0);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notifications" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data ?? []) as unknown as NotificationRow[];
    setRows(list);
    setUnread(list.filter((r) => !r.read_at).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`notifs:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  const markAllRead = useCallback(async () => {
    await supabase.rpc("mark_all_notifications_read" as any);
    load();
  }, [load]);

  return { rows, unread, loading, reload: load, markAllRead };
}
