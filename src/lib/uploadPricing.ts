// Sprint 3 — exponential token cost for media uploads.
// Mirrors the SQL helper public.media_upload_cost(user) so the UI can
// preview the next cost without a round-trip after every upload.
import { supabase } from "@/integrations/supabase/client";

export const FREE_RESOLUTION_HEIGHT = 720; // px, free tier video cap
export const PRO_RESOLUTION_HEIGHT = 1080;

export function uploadCost(uploadsToday: number): number {
  // 5 * 2^n, capped at 320
  return Math.min(320, 5 * Math.pow(2, uploadsToday));
}

export async function fetchUploadsToday(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("media_uploads_today" as any, { _user: userId });
  if (error || typeof data !== "number") return 0;
  return data;
}

/** Probe an HTML5 video file for width/height/duration without uploading. */
export function probeVideo(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const out = {
        width: v.videoWidth,
        height: v.videoHeight,
        duration: Math.round(v.duration),
      };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata"));
    };
    v.src = url;
  });
}
