import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Loader2 } from "lucide-react";

export type AttachMeta = { path: string; name: string; mime: string; size: number };

const MARKER = "[[attach]]";

export function parseAttachment(body: string): AttachMeta | null {
  if (!body?.startsWith(MARKER)) return null;
  try {
    return JSON.parse(body.slice(MARKER.length));
  } catch {
    return null;
  }
}

export function encodeAttachment(meta: AttachMeta): string {
  return MARKER + JSON.stringify(meta);
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachment({ meta, me }: { meta: AttachMeta; me: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("dm-attachments")
      .createSignedUrl(meta.path, 60 * 60 * 6)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => { cancelled = true; };
  }, [meta.path]);

  if (!url) {
    return (
      <div className="h-32 w-48 grid place-items-center bg-surface rounded-xl">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mime = meta.mime || "";
  if (mime.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={meta.name}
          className="max-w-[260px] max-h-[320px] rounded-xl object-cover"
          loading="lazy"
        />
      </a>
    );
  }
  if (mime.startsWith("video/")) {
    return <video src={url} controls className="max-w-[260px] rounded-xl" />;
  }
  if (mime.startsWith("audio/")) {
    return <audio src={url} controls className="max-w-[260px]" />;
  }
  // generic file card
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={meta.name}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border max-w-[260px] ${
        me ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-border bg-surface"
      }`}
    >
      <div className="h-10 w-10 rounded-lg bg-background/40 grid place-items-center shrink-0">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{meta.name}</p>
        <p className="text-[10px] opacity-70">{fmtSize(meta.size)}</p>
      </div>
      <Download className="h-4 w-4 opacity-70 shrink-0" />
    </a>
  );
}
