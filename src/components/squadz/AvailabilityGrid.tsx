import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Compact hour buckets (3-hour blocks): 0,3,6,9,12,15,18,21
const HOUR_BUCKETS = [0, 3, 6, 9, 12, 15, 18, 21];
const BUCKET_LABEL = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];

type Slot = { weekday: number; hour: number };

export function AvailabilityGrid({ userId, editable }: { userId: string; editable: boolean }) {
  const qc = useQueryClient();
  const { data: slots = [], isLoading } = useQuery<Slot[]>({
    queryKey: ["availability", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_slots")
        .select("weekday, hour")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
    enabled: !!userId,
  });

  const set = useMemo(() => new Set(slots.map((s) => `${s.weekday}:${s.hour}`)), [slots]);

  const toggle = useMutation({
    mutationFn: async ({ weekday, hour, on }: { weekday: number; hour: number; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("availability_slots").insert({ user_id: userId, weekday, hour });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("availability_slots").delete()
          .eq("user_id", userId).eq("weekday", weekday).eq("hour", hour);
        if (error) throw error;
      }
    },
    onMutate: async ({ weekday, hour, on }) => {
      await qc.cancelQueries({ queryKey: ["availability", userId] });
      const prev = qc.getQueryData<Slot[]>(["availability", userId]) ?? [];
      const next = on
        ? [...prev, { weekday, hour }]
        : prev.filter((s) => !(s.weekday === weekday && s.hour === hour));
      qc.setQueryData(["availability", userId], next);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["availability", userId], ctx.prev);
      toast.error(e instanceof Error ? e.message : "Could not save");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["availability", userId] }),
  });

  // Toggle a 3-hour bucket: store one row per actual hour (3 rows).
  const toggleBucket = (weekday: number, bucketStart: number) => {
    if (!editable) return;
    const hours = [bucketStart, bucketStart + 1, bucketStart + 2];
    const allOn = hours.every((h) => set.has(`${weekday}:${h}`));
    hours.forEach((h) => toggle.mutate({ weekday, hour: h, on: !allOn }));
  };

  const bucketActive = (weekday: number, bucketStart: number) => {
    const hours = [bucketStart, bucketStart + 1, bucketStart + 2];
    const n = hours.filter((h) => set.has(`${weekday}:${h}`)).length;
    return n === 0 ? "off" : n === 3 ? "on" : "partial";
  };

  if (isLoading) {
    return <div className="h-24 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display text-lg font-black">When I play</h3>
          <p className="text-xs text-muted-foreground">
            {editable ? "Tap blocks to mark when you're usually online." : "Times this player is usually online."}
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground">Local time</p>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `48px repeat(${HOUR_BUCKETS.length}, minmax(28px, 1fr))` }}>
          <div />
          {BUCKET_LABEL.map((l) => (
            <div key={l} className="text-[10px] text-muted-foreground text-center font-mono">{l}</div>
          ))}
          {DAYS.map((day, di) => (
            <DayRow
              key={day}
              day={day}
              weekday={di}
              bucketActive={bucketActive}
              onToggle={toggleBucket}
              editable={editable}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayRow({
  day, weekday, bucketActive, onToggle, editable,
}: {
  day: string;
  weekday: number;
  bucketActive: (w: number, h: number) => "on" | "off" | "partial";
  onToggle: (w: number, h: number) => void;
  editable: boolean;
}) {
  return (
    <>
      <div className="text-xs font-semibold text-muted-foreground self-center">{day}</div>
      {HOUR_BUCKETS.map((h) => {
        const state = bucketActive(weekday, h);
        return (
          <button
            key={h}
            disabled={!editable}
            onClick={() => onToggle(weekday, h)}
            className={cn(
              "h-7 rounded-md transition-all",
              state === "on" && "bg-primary glow-orange",
              state === "partial" && "bg-primary/50",
              state === "off" && "bg-surface-2 hover:bg-surface",
              !editable && "cursor-default"
            )}
            aria-label={`${day} ${h}:00`}
          />
        );
      })}
    </>
  );
}
