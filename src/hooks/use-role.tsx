import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const DEV_EMAILS = new Set(["nicolas.amacker2010@gmail.com"]);

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    // Fast path: known dev email
    if (user.email && DEV_EMAILS.has(user.email.toLowerCase())) {
      setIsAdmin(true);
      // Still refresh from DB in case role was revoked
    }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as any }).then(({ data }) => {
      if (cancelled) return;
      setIsAdmin(Boolean(data));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  return { isAdmin, loading };
}
