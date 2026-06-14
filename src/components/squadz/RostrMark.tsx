import logoAsset from "@/assets/rostr-logo-new.png.asset.json";
import { cn } from "@/lib/utils";

export function RostrMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Rostr"
      width={size}
      height={size}
      className={cn("rounded-xl object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

export const ROSTR_LOGO_URL = logoAsset.url;
