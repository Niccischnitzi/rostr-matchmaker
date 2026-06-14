import { createContext, useContext, useState, type ReactNode } from "react";
import {
  initialPlayers, initialClubs, initialChats, initialLFG, initialClips, initialLinked,
  type Player, type Club, type Chat, type LFG, type Clip, type LinkedAccount, type Message,
} from "./squadz-data";

type Ctx = {
  players: Player[];
  connected: Player[];
  skipped: string[];
  swipe: (id: string, dir: "skip" | "squad") => void;

  clubs: Club[];
  joinClub: (id: string) => void;

  chats: Chat[];
  sendMessage: (chatId: string, text: string) => void;
  joinInvite: (game: string, lobby: string) => void;

  lfg: LFG[];
  joinLFG: (id: string) => void;
  postLFG: (data: Omit<LFG, "id" | "host" | "postedAt" | "slotsOpen"> & { slotsOpen: number }) => void;

  clips: Clip[];
  likedClips: Set<string>;
  likeClip: (id: string) => void;


  linked: LinkedAccount[];
  status: "Online" | "In-Game" | "Busy" | "Looking for Squad";
  setStatus: (s: Ctx["status"]) => void;
};

const StoreCtx = createContext<Ctx | null>(null);

export function SquadzProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [connected, setConnected] = useState<Player[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [clubs, setClubs] = useState(initialClubs);
  const [chats, setChats] = useState(initialChats);
  const [lfg, setLfg] = useState(initialLFG);
  const [clips, setClips] = useState(initialClips);
  const [linked] = useState(initialLinked);
  const [likedClips, setLikedClips] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<Ctx["status"]>("Looking for Squad");


  const swipe: Ctx["swipe"] = (id, dir) => {
    const p = players.find((x) => x.id === id);
    if (!p) return;
    setPlayers((prev) => prev.filter((x) => x.id !== id));
    if (dir === "squad") setConnected((c) => [p, ...c]);
    else setSkipped((s) => [id, ...s]);
  };

  const joinClub: Ctx["joinClub"] = (id) =>
    setClubs((prev) => prev.map((c) => (c.id === id ? { ...c, joined: !c.joined, members: c.joined ? c.members - 1 : c.members + 1 } : c)));

  const sendMessage: Ctx["sendMessage"] = (chatId, text) => {
    if (!text.trim()) return;
    const msg: Message = { id: Math.random().toString(36).slice(2), from: "me", text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, msg], lastTime: "now", unread: 0 } : c)));
  };

  const joinInvite: Ctx["joinInvite"] = () => {};

  const joinLFG: Ctx["joinLFG"] = (id) =>
    setLfg((prev) => prev.map((l) => (l.id === id && l.slotsOpen > 0 ? { ...l, slotsOpen: l.slotsOpen - 1 } : l)));

  const postLFG: Ctx["postLFG"] = (data) =>
    setLfg((prev) => [{ ...data, id: Math.random().toString(36).slice(2), host: "you", postedAt: "now" }, ...prev]);

  const likeClip: Ctx["likeClip"] = (id) => {
    if (likedClips.has(id)) return;
    setLikedClips((prev) => new Set(prev).add(id));
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, likes: c.likes + 1 } : c)));
  };

  return (
    <StoreCtx.Provider value={{ players, connected, skipped, swipe, clubs, joinClub, chats, sendMessage, joinInvite, lfg, joinLFG, postLFG, clips, likedClips, likeClip, linked, status, setStatus }}>
      {children}
    </StoreCtx.Provider>
  );
}


export const useSquadz = () => {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useSquadz must be inside SquadzProvider");
  return ctx;
};
