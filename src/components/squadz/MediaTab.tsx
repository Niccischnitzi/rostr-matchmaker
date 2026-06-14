import { useSquadz } from "@/lib/squadz-store";
import { Play, Flame, Eye } from "lucide-react";
import { toast } from "sonner";

export function MediaTab() {
  const { clips, likeClip } = useSquadz();
  const featured = clips[0];
  const rest = clips.slice(1);

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Media</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">Clips, highlights, and the weekly featured drop.</p>

      {/* Featured */}
      <div className="relative rounded-3xl overflow-hidden border border-primary/30 mb-8 aspect-[16/9] sm:aspect-[21/9] group cursor-pointer">
        <img src={featured.thumb} alt={featured.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground uppercase tracking-wider">
          <Flame className="h-3 w-3" /> Weekly Featured
        </div>
        <button className="absolute inset-0 grid place-items-center" onClick={() => toast(`Playing "${featured.title}"`)}>
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary text-primary-foreground grid place-items-center glow-orange group-hover:scale-110 transition-transform">
            <Play className="h-7 w-7 fill-current ml-1" />
          </div>
        </button>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <p className="font-display text-xl sm:text-2xl font-black">{featured.title}</p>
          <p className="text-sm opacity-80 mt-1">{featured.game} · @{featured.author} · {featured.views} views</p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {rest.map((c) => (
          <div key={c.id} className="group relative rounded-2xl overflow-hidden border border-border bg-card aspect-[3/4] cursor-pointer">
            <img src={c.thumb} alt={c.title} className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute top-2 left-2 flex gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur text-white px-2 py-0.5 rounded">{c.game}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded">{c.type}</span>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white bg-black/60 backdrop-blur px-2 py-0.5 rounded">
              <Eye className="h-3 w-3" />{c.views}
            </div>
            <button onClick={(e) => { e.stopPropagation(); likeClip(c.id); }}
              className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold text-white bg-black/60 backdrop-blur px-2 py-1 rounded-full hover:bg-primary transition-colors">
              <Flame className="h-3 w-3" /> {c.likes.toLocaleString()}
            </button>
            <div className="absolute bottom-2 left-2 right-16 text-white">
              <p className="text-xs font-bold truncate">{c.title}</p>
              <p className="text-[10px] opacity-70">@{c.author}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
