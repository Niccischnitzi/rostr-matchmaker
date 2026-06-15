import logoAsset from "@/assets/rostr-r-v2.png.asset.json";
import { cn } from "@/lib/utils";

export function RostrMark({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Rostr"
      width={size}
      height={size}
      className={cn("object-contain drop-shadow-[0_4px_18px_rgba(255,87,34,0.35)]", className)}
      style={{ width: size, height: size }}
    />
  );
}

export const ROSTR_LOGO_URL = logoAsset.url;
