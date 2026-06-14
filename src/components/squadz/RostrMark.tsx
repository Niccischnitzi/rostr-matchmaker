import logoAsset from "@/assets/rostr-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function RostrMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("rounded-xl overflow-hidden bg-black grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <img src={logoAsset.url} alt="Rostr" className="h-full w-full object-cover" />
    </div>
  );
}

export const ROSTR_LOGO_URL = logoAsset.url;
