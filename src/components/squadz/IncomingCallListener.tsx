// Listens on the user's personal Realtime channel for incoming call ring events
// from peers. Mount once at app shell. When a ring arrives, render the CallSheet
// in callee mode so signaling can complete.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CallSheet } from "./CallSheet";
import type { Profile } from "@/lib/squadz-supabase";

type Incoming = { conversationId: string; peer: Profile | null; mode: "audio" | "video" };

export function IncomingCallListener() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<Incoming | null>(null);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`ring:${user.id}`, { config: { broadcast: { ack: false, self: false } } });
    channel.on("broadcast", { event: "ring" }, async (msg) => {
      const { from, conversationId, mode } = (msg.payload ?? {}) as { from?: string; conversationId?: string; mode?: "audio" | "video" };
      if (!from || !conversationId) return;
      const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", from).maybeSingle();
      setIncoming({ conversationId, peer: (data as any) ?? null, mode: mode === "video" ? "video" : "audio" });
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user || !incoming) return null;
  return (
    <CallSheet
      open
      onClose={() => setIncoming(null)}
      peer={incoming.peer}
      conversationId={incoming.conversationId}
      selfId={user.id}
      role="callee"
      mode={incoming.mode}
    />
  );
}

/** Helper to broadcast a ring to a peer when starting a call. */
export async function ringPeer(opts: { peerId: string; from: string; conversationId: string; mode: "audio" | "video" }) {
  const ch = supabase.channel(`ring:${opts.peerId}`, { config: { broadcast: { ack: false, self: false } } });
  await new Promise<void>((resolve) => {
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "ring", payload: { from: opts.from, conversationId: opts.conversationId, mode: opts.mode } });
        resolve();
      }
    });
  });
  // give realtime a tick to flush, then drop the channel
  setTimeout(() => { supabase.removeChannel(ch); }, 800);
}
