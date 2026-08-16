import { useEffect } from "react";
import { useInventory } from "./use-inventory";

/**
 * Applies the currently-equipped cosmetics globally:
 *  - `tag` item      → CSS class on <body data-tag="..."> for pill styling
 * Halo & frame are consumed per-avatar via `useInventory().equipped`.
 *
 * Mount ONCE at the app shell level.
 */
export function useApplyEquippedCosmetics() {
  const { equipped } = useInventory();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const prevClasses: string[] = [];

    // Animated cosmetic backgrounds were removed — the app background is
    // owned entirely by the theme.
    delete body.dataset.cosmeticBg;

    if (equipped.tag?.key) {
      body.dataset.cosmeticTag = equipped.tag.key;
    } else {
      delete body.dataset.cosmeticTag;
    }

    return () => {
      prevClasses.forEach((c) => body.classList.remove(c));
    };
  }, [equipped.tag?.key]);

  return equipped;
}

/** Read-only accessor for the equipped cosmetics — used inside avatars/badges. */
export function useEquippedCosmetics() {
  return useInventory().equipped;
}
