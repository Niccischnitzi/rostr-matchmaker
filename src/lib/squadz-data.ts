export type Trait = "Toxic-free" | "Tryhard" | "Chill" | "Shot-caller" | "Night Owl" | "Casual" | "Competitive" | "Mic'd up" | "Funny";

export type Platform = "Steam" | "PSN" | "Xbox" | "Riot" | "Battle.net" | "Epic" | "Nintendo" | "Faceit";

export type Player = {
  id: string;
  username: string;
  avatar: string;
  playstyle: string;
  location: string;
  timezone: string;
  age: number;
  gender: "M" | "F" | "NB";
  country: string;
  games: { name: string; rank: string; color: string }[];
  traits: Trait[];
};

const avatars = (seed: string) => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}&backgroundColor=ff5722,ff8a4c,1f1f23,2d2d33`;

export const initialPlayers: Player[] = [
  { id: "p1", username: "NovaStrike", avatar: avatars("nova"), playstyle: "Competitive • Night Owl", location: "Berlin, DE", timezone: "CET", age: 24, gender: "F", country: "Germany",
    games: [{ name: "Valorant", rank: "Immortal 2", color: "#ff4655" }, { name: "Apex", rank: "Diamond", color: "#da292a" }],
    traits: ["Tryhard", "Shot-caller", "Toxic-free"] },
  { id: "p2", username: "GhostByte", avatar: avatars("ghost"), playstyle: "Chill • Casual", location: "Toronto, CA", timezone: "EST", age: 28, gender: "M", country: "Canada",
    games: [{ name: "CS2", rank: "LE", color: "#f7a500" }, { name: "Rocket League", rank: "Champ 1", color: "#1ba1d9" }],
    traits: ["Chill", "Toxic-free", "Funny"] },
  { id: "p3", username: "Kairo", avatar: avatars("kairo"), playstyle: "Competitive • IGL", location: "Tokyo, JP", timezone: "JST", age: 22, gender: "M", country: "Japan",
    games: [{ name: "Valorant", rank: "Radiant", color: "#ff4655" }],
    traits: ["Shot-caller", "Tryhard", "Mic'd up"] },
  { id: "p4", username: "Lyric", avatar: avatars("lyric"), playstyle: "Casual • Vibes", location: "London, UK", timezone: "GMT", age: 26, gender: "F", country: "UK",
    games: [{ name: "Fortnite", rank: "Unreal", color: "#9d4dff" }, { name: "Overwatch 2", rank: "Diamond", color: "#f99e1a" }],
    traits: ["Chill", "Funny", "Toxic-free"] },
  { id: "p5", username: "Vexen", avatar: avatars("vexen"), playstyle: "Grinder • Night Owl", location: "São Paulo, BR", timezone: "BRT", age: 21, gender: "NB", country: "Brazil",
    games: [{ name: "League of Legends", rank: "Master", color: "#c89b3c" }],
    traits: ["Tryhard", "Night Owl", "Mic'd up"] },
  { id: "p6", username: "Halcyon", avatar: avatars("hal"), playstyle: "Competitive • Coach", location: "Seoul, KR", timezone: "KST", age: 30, gender: "M", country: "South Korea",
    games: [{ name: "Apex", rank: "Predator", color: "#da292a" }, { name: "Valorant", rank: "Ascendant", color: "#ff4655" }],
    traits: ["Shot-caller", "Toxic-free", "Competitive"] },
];

export type Club = {
  id: string;
  name: string;
  tag: string;
  members: number;
  color: string;
  description: string;
  joined: boolean;
  warAgainst?: string;
  warScore?: [number, number];
  warTimeLeft?: string;
  leaderboard: { rank: number; player: string; kills: number; wins: number; points: number }[];
  channels: { name: string; type: "text" | "voice"; sitting?: string[] }[];
};

export const initialClubs: Club[] = [
  { id: "c1", name: "Obsidian Wolves", tag: "OBSW", members: 248, color: "#FF5722", joined: true,
    description: "Top 100 ranked squad. Daily scrims, no toxicity.",
    warAgainst: "Crimson Reapers", warScore: [42, 38], warTimeLeft: "2h 14m",
    leaderboard: [
      { rank: 1, player: "NovaStrike", kills: 312, wins: 28, points: 4820 },
      { rank: 2, player: "Halcyon", kills: 287, wins: 24, points: 4410 },
      { rank: 3, player: "Kairo", kills: 261, wins: 22, points: 4105 },
      { rank: 4, player: "GhostByte", kills: 198, wins: 19, points: 3380 },
      { rank: 5, player: "Vexen", kills: 174, wins: 17, points: 2990 },
    ],
    channels: [
      { name: "general", type: "text" },
      { name: "ranked-lfg", type: "text" },
      { name: "Scrim Room A", type: "voice", sitting: ["NovaStrike", "Kairo", "Halcyon"] },
      { name: "Lounge", type: "voice", sitting: ["GhostByte"] },
    ] },
  { id: "c2", name: "Neon Drift Society", tag: "NDS", members: 92, color: "#1ba1d9", joined: true,
    description: "Casual racing & fighting games crew.",
    leaderboard: [
      { rank: 1, player: "Lyric", kills: 89, wins: 14, points: 1820 },
      { rank: 2, player: "Vexen", kills: 76, wins: 11, points: 1540 },
    ],
    channels: [{ name: "general", type: "text" }, { name: "Garage", type: "voice", sitting: ["Lyric"] }] },
  { id: "c3", name: "Midnight Protocol", tag: "MNP", members: 412, color: "#9d4dff", joined: false,
    description: "Hardcore tactical shooter community.",
    leaderboard: [{ rank: 1, player: "GhostX", kills: 401, wins: 33, points: 5210 }],
    channels: [{ name: "general", type: "text" }] },
  { id: "c4", name: "Sakura Squad", tag: "SKR", members: 156, color: "#ff6699", joined: false,
    description: "Japan-EU friendly. JRPGs and anime games.",
    leaderboard: [{ rank: 1, player: "Kairo", kills: 102, wins: 18, points: 2210 }],
    channels: [{ name: "general", type: "text" }] },
];

export type Message = { id: string; from: string; text: string; time: string; invite?: { game: string; lobby: string } };
export type Chat = { id: string; name: string; avatar: string; isGroup: boolean; lastTime: string; unread: number; messages: Message[] };

export const initialChats: Chat[] = [
  { id: "ch1", name: "NovaStrike", avatar: avatars("nova"), isGroup: false, lastTime: "2m", unread: 2,
    messages: [
      { id: "m1", from: "NovaStrike", text: "yo squad up? ranked grind", time: "20:14" },
      { id: "m2", from: "me", text: "down. one game then dinner", time: "20:15" },
      { id: "m3", from: "NovaStrike", text: "Join my Apex Legends Lobby", time: "20:16", invite: { game: "Apex Legends", lobby: "NOVA-7821" } },
    ] },
  { id: "ch2", name: "Obsidian Wolves", avatar: "🐺", isGroup: true, lastTime: "12m", unread: 5,
    messages: [
      { id: "m1", from: "Halcyon", text: "scrim in 30, get in voice", time: "19:58" },
      { id: "m2", from: "Kairo", text: "loading in", time: "20:02" },
    ] },
  { id: "ch3", name: "Lyric", avatar: avatars("lyric"), isGroup: false, lastTime: "1h", unread: 0,
    messages: [{ id: "m1", from: "Lyric", text: "that clip last night was insane lol", time: "18:40" }] },
];

export type LFG = { id: string; game: string; mode: string; rank: string; slotsOpen: number; slotsTotal: number; host: string; postedAt: string };
export const initialLFG: LFG[] = [
  { id: "l1", game: "Valorant", mode: "Ranked 5v5", rank: "Diamond+", slotsOpen: 2, slotsTotal: 4, host: "NovaStrike", postedAt: "5m ago" },
  { id: "l2", game: "Apex Legends", mode: "Ranked Trios", rank: "Plat+", slotsOpen: 1, slotsTotal: 2, host: "GhostByte", postedAt: "12m ago" },
  { id: "l3", game: "League of Legends", mode: "Flex Queue", rank: "Any", slotsOpen: 3, slotsTotal: 4, host: "Vexen", postedAt: "20m ago" },
  { id: "l4", game: "CS2", mode: "Premier", rank: "LE+", slotsOpen: 2, slotsTotal: 4, host: "Halcyon", postedAt: "1h ago" },
];

export type Clip = { id: string; title: string; game: string; type: string; views: string; likes: number; author: string; thumb: string; pinned?: boolean };
const clipThumb = (i: number, hue: number) => `https://images.unsplash.com/photo-${i}?w=600&h=800&fit=crop&auto=format&q=70&hue=${hue}`;
export const initialClips: Clip[] = [
  { id: "v1", title: "1v4 ace on Haven", game: "Valorant", type: "Clutch", views: "128K", likes: 8420, author: "NovaStrike", thumb: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=800&fit=crop", pinned: true },
  { id: "v2", title: "Insane octane bounce", game: "Apex", type: "Movement", views: "84K", likes: 5102, author: "Halcyon", thumb: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&h=800&fit=crop", pinned: true },
  { id: "v3", title: "Pentakill comeback", game: "League", type: "Clutch", views: "212K", likes: 12300, author: "Vexen", thumb: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=800&fit=crop", pinned: true },
  { id: "v4", title: "Trickshot of the year", game: "CS2", type: "Trickshot", views: "67K", likes: 4210, author: "GhostByte", thumb: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&h=800&fit=crop" },
  { id: "v5", title: "Fail compilation #14", game: "Fortnite", type: "Funny", views: "32K", likes: 2103, author: "Lyric", thumb: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=600&h=800&fit=crop" },
  { id: "v6", title: "Perfect smoke lineup", game: "Valorant", type: "Tutorial", views: "45K", likes: 3001, author: "Kairo", thumb: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=800&fit=crop" },
  { id: "v7", title: "Solo squad win", game: "Apex", type: "Clutch", views: "98K", likes: 6402, author: "NovaStrike", thumb: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=800&fit=crop" },
  { id: "v8", title: "Rocket League goal", game: "Rocket League", type: "Highlight", views: "29K", likes: 1820, author: "GhostByte", thumb: "https://images.unsplash.com/photo-1556438064-2d7646166914?w=600&h=800&fit=crop" },
];

export type LinkedAccount = { platform: Platform; tag: string; color: string; icon: string };
export const initialLinked: LinkedAccount[] = [
  { platform: "Steam", tag: "squadz_main", color: "#1b2838", icon: "🎮" },
  { platform: "PSN", tag: "Squadz-Ace", color: "#0070d1", icon: "🅿" },
  { platform: "Xbox", tag: "SquadzGT", color: "#107c10", icon: "❎" },
  { platform: "Riot", tag: "Squadz#NA1", color: "#d13639", icon: "🔥" },
  { platform: "Battle.net", tag: "Squadz#1234", color: "#00aeff", icon: "⚔" },
  { platform: "Epic", tag: "SquadzEPIC", color: "#313131", icon: "🎯" },
  { platform: "Nintendo", tag: "SW-1234-5678", color: "#e60012", icon: "🍄" },
  { platform: "Faceit", tag: "squadz_fc", color: "#ff5500", icon: "🏆" },
];
