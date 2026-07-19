import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";
import type { ProfileLite } from "@/lib/squadz-supabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  peer: ProfileLite | null;
  conversationId: string;
  selfId: string;
  /** Caller initiates and creates the WebRTC offer. Callee waits for it. */
  role?: "caller" | "callee";
  /** Initial media modes the caller wants. */
  mode?: "audio" | "video";
};

type Phase = "ringing" | "connecting" | "in-call" | "ended";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function CallSheet({ open, onClose, peer, conversationId, selfId, role = "caller", mode = "audio" }: Props) {
  const [phase, setPhase] = useState<Phase>("ringing");
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(mode === "video");
  const [sharing, setSharing] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const senderRef = useRef<RTCRtpSender | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ringSfxRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase(role === "caller" ? "ringing" : "connecting");
    setElapsed(0);
    setMuted(false);
    setVideoOn(mode === "video");
    setSharing(false);
    setHasRemoteVideo(false);

    if (role === "caller") {
      const ring = () => sfx.nav();
      ring();
      ringSfxRef.current = window.setInterval(ring, 1800) as unknown as number;
    }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => {
          const s = pc.addTrack(t, stream);
          if (t.kind === "video") senderRef.current = s;
        });

        pc.ontrack = (e) => {
          const [remoteStream] = e.streams;
          if (e.track.kind === "video") {
            setHasRemoteVideo(true);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.play().catch(() => {});
            }
          } else if (audioRef.current) {
            audioRef.current.srcObject = remoteStream;
            audioRef.current.play().catch(() => {});
          }
        };

        pc.onconnectionstatechange = () => {
          const st = pc.connectionState;
          if (st === "connected") setPhase("in-call");
          else if (st === "failed" || st === "disconnected" || st === "closed") {
            if (phaseRef.current !== "ended") end();
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

        channel.on("broadcast", { event: "offer" }, async (msg) => {
          if (role !== "callee" || msg.payload.from === selfId || !pcRef.current) return;
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload.offer));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            channel.send({ type: "broadcast", event: "answer", payload: { from: selfId, answer } });
            setPhase("connecting");
          } catch (err) { console.error(err); }
        });
        channel.on("broadcast", { event: "answer" }, async (msg) => {
          if (role !== "caller" || msg.payload.from === selfId || !pcRef.current) return;
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload.answer));
            setPhase("connecting");
          } catch (err) { console.error(err); }
        });
        channel.on("broadcast", { event: "ice" }, async (msg) => {
          if (msg.payload.from === selfId || !pcRef.current) return;
          try { await pcRef.current.addIceCandidate(msg.payload.candidate); } catch { /* */ }
        });
        channel.on("broadcast", { event: "hangup" }, (msg) => {
          if (msg.payload.from === selfId) return;
          toast("Call ended");
          end(true);
        });

        await channel.subscribe(async (status) => {
          if (status !== "SUBSCRIBED" || !pcRef.current) return;
          if (role === "caller") {
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            channel.send({ type: "broadcast", event: "offer", payload: { from: selfId, offer } });
          }
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Camera/Mic access denied");
        end();
      }
    })();

    // auto-fail caller after 35s without an answer
    const failTimer = window.setTimeout(() => {
      if (phaseRef.current === "ringing" || phaseRef.current === "connecting") {
        toast("No answer");
        end();
      }
    }, 35000);

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId, role, mode]);

  // Mirror phase to a ref so async cleanup checks see latest value.
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (phase !== "in-call") return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  function cleanup() {
    if (ringSfxRef.current) { window.clearInterval(ringSfxRef.current); ringSfxRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    cameraTrackRef.current = null;
    senderRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }

  function end(remote = false) {
    if (!remote && channelRef.current) {
      try { channelRef.current.send({ type: "broadcast", event: "hangup", payload: { from: selfId } }); } catch { /* */ }
    }
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

  async function toggleVideo() {
    sfx.tap();
    if (videoOn) {
      cameraTrackRef.current?.stop();
      cameraTrackRef.current = null;
      if (senderRef.current) await senderRef.current.replaceTrack(null);
      setVideoOn(false);
    } else {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = vs.getVideoTracks()[0];
        cameraTrackRef.current = track;
        streamRef.current?.addTrack(track);
        if (localVideoRef.current) localVideoRef.current.srcObject = streamRef.current;
        if (senderRef.current) await senderRef.current.replaceTrack(track);
        else if (pcRef.current && streamRef.current) senderRef.current = pcRef.current.addTrack(track, streamRef.current);
        setVideoOn(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Camera unavailable");
      }
    }
  }

  async function toggleScreenShare() {
    sfx.tap();
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      if (senderRef.current) await senderRef.current.replaceTrack(cameraTrackRef.current);
      setSharing(false);
      return;
    }
    try {
      const ss = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = ss;
      const track = ss.getVideoTracks()[0];
      if (senderRef.current) await senderRef.current.replaceTrack(track);
      else if (pcRef.current && streamRef.current) senderRef.current = pcRef.current.addTrack(track, streamRef.current);
      track.onended = () => { toggleScreenShare(); };
      if (localVideoRef.current) localVideoRef.current.srcObject = ss;
      setSharing(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not share screen");
    }
  }

  if (!open) return null;
  const name = peer?.display_name ?? peer?.username ?? "…";
  const initial = (name || "?").slice(0, 1).toUpperCase();
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const showVideoStage = videoOn || sharing || hasRemoteVideo;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl grid place-items-center p-4 sm:p-6 animate-in fade-in duration-200">
      <audio ref={audioRef} autoPlay />
      <div className="w-full max-w-3xl flex flex-col items-center">
        {showVideoStage ? (
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden border-2 border-border bg-black shadow-2xl">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", hasRemoteVideo ? "opacity-100" : "opacity-0")}
            />
            {!hasRemoteVideo && (
              <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">
                {phase === "in-call" ? "Waiting for video…" : "Connecting…"}
              </div>
            )}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute bottom-3 right-3 h-28 w-44 rounded-xl object-cover border-2 border-white/30 shadow-lg"
            />
          </div>
        ) : (
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
        )}

        <p className="mt-5 font-display text-2xl font-black">{name}</p>
        <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
          {phase === "ringing" && <>Calling<Dots /></>}
          {phase === "connecting" && <>Connecting<Dots /></>}
          {phase === "in-call" && <span className="text-success font-mono">{mm}:{ss}</span>}
          {phase === "ended" && <span>Call ended</span>}
        </p>

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <CallBtn onClick={toggleMute} active={!muted} label={muted ? "Unmute" : "Mute"}>
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </CallBtn>
          <CallBtn onClick={toggleVideo} active={videoOn} label={videoOn ? "Video off" : "Video on"}>
            {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </CallBtn>
          <CallBtn onClick={toggleScreenShare} active={sharing} label={sharing ? "Stop sharing" : "Share screen"} highlight={sharing}>
            {sharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
          </CallBtn>
          <button
            onClick={() => end()}
            className="h-16 w-16 rounded-full bg-destructive text-white grid place-items-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
            aria-label="End call"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
          {role === "callee" && phase !== "in-call" && (
            <CallBtn onClick={() => sfx.win()} active label="Accept" highlight>
              <Phone className="h-5 w-5" />
            </CallBtn>
          )}
        </div>

        <p className="mt-6 text-[10px] text-muted-foreground uppercase tracking-widest">
          Peer-to-peer · Voice · Video · Screen share
        </p>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex ml-1">
      <span className="animate-bounce">.</span>
      <span className="animate-bounce [animation-delay:120ms]">.</span>
      <span className="animate-bounce [animation-delay:240ms]">.</span>
    </span>
  );
}

function CallBtn({ children, onClick, active, label, highlight }: { children: React.ReactNode; onClick: () => void; active: boolean; label: string; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "h-14 w-14 rounded-full grid place-items-center border-2 transition-all duration-200 hover:scale-110 active:scale-95",
        highlight ? "bg-primary text-primary-foreground border-primary glow-orange" :
        active ? "bg-surface text-foreground border-border" : "bg-surface-2 text-muted-foreground border-border",
      )}
    >
      {children}
    </button>
  );
}
