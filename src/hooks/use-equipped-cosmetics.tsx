import { useEffect } from "react";
import { useInventory } from "./use-inventory";

/**
 * Applies the currently-equipped cosmetics globally:
 *  - `background` item → CSS class on <body> (paints app-wide background)
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

    if (equipped.background?.css_class) {
      const classes = equipped.background.css_class.split(/\s+/).filter(Boolean);
      classes.forEach((c) => {
        if (!body.classList.contains(c)) {
          body.classList.add(c);
          prevClasses.push(c);
        }
      });
      body.dataset.cosmeticBg = equipped.background.key;
    } else {
      delete body.dataset.cosmeticBg;
    }

    if (equipped.tag?.key) {
      body.dataset.cosmeticTag = equipped.tag.key;
    } else {
      delete body.dataset.cosmeticTag;
    }

    return () => {
      prevClasses.forEach((c) => body.classList.remove(c));
    };
  }, [equipped.background?.css_class, equipped.background?.key, equipped.tag?.key]);

  return equipped;
}

/** Read-only accessor for the equipped cosmetics — used inside avatars/badges. */
export function useEquippedCosmetics() {
  return useInventory().equipped;
}
