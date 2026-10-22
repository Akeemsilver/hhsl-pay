import type { SiteRates, TierCaps } from "./engine";

/** Ready-made overtime hours, so a new site does not need the 1x / 1.5x / 2x / 3x boxes filled in by hand. */
export interface HoursTemplate {
  id: string;
  name: string;
  description: string;
  weekday: TierCaps;
  weekend: TierCaps;
  holiday: TierCaps;
}

export const HOURS_TEMPLATES: HoursTemplate[] = [
  {
    id: "straight", name: "Standard straight time",
    description: "Weekday: first 12 h at 1x, the rest at 2x. Weekend: 12 h at 1.5x, then 2x. Holiday / TAR: all 2x.",
    weekday: { x1: 12, x2: 1000 }, weekend: { x15: 12, x2: 1000 }, holiday: { x2: 1000 },
  },
  {
    id: "overtime", name: "Standard overtime",
    description: "Weekday: first 8 h at 1x, next 4 h at 1.5x, the rest at 2x. Weekend: 12 h at 1.5x, then 2x. Holiday / TAR: all 2x.",
    weekday: { x1: 8, x15: 4, x2: 1000 }, weekend: { x15: 12, x2: 1000 }, holiday: { x2: 1000 },
  },
  {
    id: "atlantic", name: "Atlantic standard",
    description: "Weekday and weekend: all 1x. Holiday / TAR (holiday, turnaround or shutdown): first 8 h at 2x, then 3x.",
    weekday: { x1: 1000 }, weekend: { x1: 1000 }, holiday: { x2: 8, x3: 1000 },
  },
];

export const templateById = (id: string | undefined) => HOURS_TEMPLATES.find((t) => t.id === id);

/** Which template a site's overtime hours match, if any. */
export function detectTemplate(s: Pick<SiteRates, "weekday" | "weekend" | "holiday">): string | undefined {
  const key = JSON.stringify([s.weekday, s.weekend, s.holiday]);
  return HOURS_TEMPLATES.find((t) => JSON.stringify([t.weekday, t.weekend, t.holiday]) === key)?.id;
}

export function applyTemplate<T extends Pick<SiteRates, "weekday" | "weekend" | "holiday">>(s: T, id: string): T {
  const t = templateById(id);
  return t ? { ...s, weekday: { ...t.weekday }, weekend: { ...t.weekend }, holiday: { ...t.holiday } } : s;
}
