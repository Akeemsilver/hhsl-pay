import type { AppData } from "./model";

export const SITE_COLORS = [
  { name: "Teal", hex: "#0f9488" },
  { name: "Amber", hex: "#d97706" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Pink", hex: "#db2777" },
  { name: "Lime", hex: "#65a30d" },
  { name: "Cyan", hex: "#0891b2" },
  { name: "Brown", hex: "#92400e" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Slate", hex: "#475569" },
  { name: "Green", hex: "#16a34a" },
] as const;

/** Sites in the order they were first set up, so each keeps the same default colour. */
function siteOrder(data: AppData): string[] {
  const seen: string[] = [];
  for (const v of [...data.history.sites].reverse()) {
    for (const k of Object.keys(v.value)) {
      const key = k.toLowerCase();
      if (!seen.includes(key)) seen.push(key);
    }
  }
  return seen;
}

/** The colour number (0–11) for a site: the one chosen in its settings, otherwise the next unused one in order. */
export function siteColorIndex(data: AppData, site: string): number {
  const key = site.toLowerCase();
  const chosen = data.siteColors?.[key];
  if (chosen !== undefined) return chosen % SITE_COLORS.length;
  const order = siteOrder(data);
  const i = order.indexOf(key);
  return (i < 0 ? 0 : i) % SITE_COLORS.length;
}
