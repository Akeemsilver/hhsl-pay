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
  // Added later; the first twelve keep their numbers so existing sites keep their colours.
  { name: "Red", hex: "#dc2626" },
  { name: "Sky", hex: "#38bdf8" },
  { name: "Magenta", hex: "#a21caf" },
  { name: "Gold", hex: "#eab308" },
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Coral", hex: "#fb7185" },
  { name: "Olive", hex: "#4d7c0f" },
  { name: "Maroon", hex: "#7f1d1d" },
  { name: "Lavender", hex: "#a78bfa" },
  { name: "Mint", hex: "#34d399" },
  { name: "Steel", hex: "#94a3b8" },
  { name: "Forest", hex: "#14532d" },
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

/** The colour number (0–23) for a site: the one chosen in its settings, otherwise the next unused one in order. */
export function siteColorIndex(data: AppData, site: string): number {
  const key = site.toLowerCase();
  const chosen = data.siteColors?.[key];
  if (chosen !== undefined) return chosen % SITE_COLORS.length;
  const order = siteOrder(data);
  const i = order.indexOf(key);
  return (i < 0 ? 0 : i) % SITE_COLORS.length;
}

/** Every site's colour spelled out, so a starter kit gives the same colours on another phone. */
export function allSiteColors(data: AppData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of siteOrder(data)) out[key] = siteColorIndex(data, key);
  return out;
}

/** The colours already in use, each with the names of the sites that use it. `except` leaves one site out (the one being edited). */
export function usedColors(data: AppData, except?: string): Map<number, string[]> {
  const names: Record<string, string> = {};
  for (const v of data.history.sites) for (const k of Object.keys(v.value)) names[k.toLowerCase()] ??= k;
  const out = new Map<number, string[]>();
  for (const key of siteOrder(data)) {
    if (key === except?.toLowerCase()) continue;
    const i = siteColorIndex(data, key);
    out.set(i, [...(out.get(i) ?? []), names[key] ?? key]);
  }
  return out;
}

/** The first colour no site uses yet, or the next one in order when every colour is taken. */
export function freeColor(data: AppData): number {
  const used = usedColors(data);
  const free = SITE_COLORS.findIndex((_, i) => !used.has(i));
  return free >= 0 ? free : siteOrder(data).length % SITE_COLORS.length;
}
