import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";
import type { Profile } from "@/lib/squadz-supabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  peer: Profile | null;
  conversationId: string;
  selfId: string;
};

type Phase = "ringing" | "in-call" | "ended";

export function CallSheet({ open, onClose, peer, conversationId, selfId }: Props) {
  const [phase, setPhase] = useState<Phase>("ringing");
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ringSfxRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("ringing");
    setElapsed(0);
    setMuted(false);

    // soft ringtone via sfx (every 1.8s)
    const ring = () => sfx.nav();
    ring();
    ringSfxRef.current = window.setInterval(ring, 1800) as unknown as number;

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.ontrack = (e) => {
          if (audioRef.current) {
            audioRef.current.srcObject = e.streams[0];
            audioRef.current.play().catch(() => {});
          }
        };

        const channel = supabase.channel(`call-${conversationId}`, {
          config: { broadcast: { ack: false, self: false } },
        });
        channelRef.current = channel;

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.send({ type: "broadcast", event: "ice", payload: { from: selfId, candidate: e.candidate } });
          }
        };

        channel.on("broadcast", { event: "answer" }, async (msg) => {
          if (msg.payload.from === selfId || !pcRef.current) return;
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload.answer));
            setPhase("in-call");
          } catch {/* ignore */}
        });
        channel.on("broadcast", { event: "ice" }, async (msg) => {
          if (msg.payload.from === selfId || !pcRef.current) return;
          try { await pcRef.current.addIceCandidate(msg.payload.candidate); } catch {/* ignore */}
        });

        await channel.subscribe(async (status) => {
          if (status !== "SUBSCRIBED" || !pcRef.current) return;
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          channel.send({ type: "broadcast", event: "offer", payload: { from: selfId, offer } });
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Mic access denied");
        end();
      }
    })();

    // auto-fail after 30s if not answered
    const failTimer = window.setTimeout(() => {
      if (phase === "ringing") {
        toast("No answer");
        end();
      }
    }, 30000);

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId]);

  // call timer
  useEffect(() => {
    if (phase !== "in-call") return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  function cleanup() {
    if (ringSfxRef.current) { window.clearInterval(ringSfxRef.current); ringSfxRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }

  function end() {
    cleanup();
    setPhase("ended");
    sfx.tap();
    setTimeout(onClose, 200);
  }

  function toggleMute() {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
    sfx.tap();
  }

  if (!open) return null;
  const name = peer?.display_name ?? peer?.username ?? "…";
  const initial = (name || "?").slice(0, 1).toUpperCase();
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl grid place-items-center p-6 animate-in fade-in duration-200">
      <audio ref={audioRef} autoPlay />
      <div className="w-full max-w-sm text-center">
        {/* Avatar with concentric ringing rings */}
        <div className="relative mx-auto h-40 w-40 grid place-items-center">
          {phase === "ringing" && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-primary/60 animate-call-ring" />
              <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-call-ring [animation-delay:600ms]" />
              <span className="absolute inset-0 rounded-full border-2 border-primary/20 animate-call-ring [animation-delay:1200ms]" />
            </>
          )}
          <div className={cn(
            "relative h-28 w-28 rounded-full overflow-hidden border-4 grid place-items-center font-display text-4xl font-black",
            phase === "in-call" ? "border-success" : "border-primary",
            phase === "ringing" && "animate-call-pulse",
          )}>
            {peer?.avatar_url ? (
              <img src={peer.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="bg-surface-2 h-full w-full grid place-items-center">{initial}</span>
            )}
          </div>
        </div>

        <p className="mt-6 font-display text-2xl font-black">{name}</p>
        <p className="mt-1 text-sm text-muted-foreground flex items-center justify-center gap-1">
          {phase === "ringing" && (
            <>
              <span>Calling</span>
              <span className="inline-flex">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce [animation-delay:120ms]">.</span>
                <span className="animate-bounce [animation-delay:240ms]">.</span>
              </span>
            </>
          )}
          {phase === "in-call" && (
            <span className="text-success font-mono">{mm}:{ss}</span>
          )}
          {phase === "ended" && <span>Call ended</span>}
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={cn(
              "h-14 w-14 rounded-full grid place-items-center transition-transform hover:scale-105 border-2",
              muted ? "bg-surface-2 text-foreground border-border" : "bg-surface text-foreground border-border",
            )}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            onClick={end}
            className="h-16 w-16 rounded-full bg-destructive text-white grid place-items-center hover:scale-105 transition-transform shadow-lg"
            aria-label="End call"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
          {phase === "ringing" && (
            <button
              onClick={() => { sfx.win(); setPhase("in-call"); }}
              className="h-14 w-14 rounded-full bg-success text-white grid place-items-center hover:scale-105 transition-transform"
              aria-label="Accept (preview)"
              title="Accept (preview)"
            >
              <Phone className="h-5 w-5" />
            </button>
          )}
        </div>

        <p className="mt-6 text-[10px] text-muted-foreground uppercase tracking-widest">
          Peer-to-peer · End-to-end audio
        </p>
      </div>
    </div>
  );
}
