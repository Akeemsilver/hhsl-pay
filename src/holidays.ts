import type { AppData } from "./model";

export interface Holiday { date: string; name: string }

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

const FIXED: [number, number, string][] = [
  [1, 1, "New Year's Day"],
  [3, 30, "Spiritual Baptist Shouter Liberation Day"],
  [5, 30, "Indian Arrival Day"],
  [6, 19, "Labour Day"],
  [8, 1, "Emancipation Day"],
  [8, 31, "Independence Day"],
  [9, 24, "Republic Day"],
  [12, 25, "Christmas Day"],
  [12, 26, "Boxing Day"],
];

/** Trinidad & Tobago public holidays that follow a fixed rule. Divali and Eid ul-Fitr move with the moon, so they are added by hand. */
export function builtInHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const out: Holiday[] = [
    { date: addDays(easter, -2), name: "Good Friday" },
    { date: addDays(easter, 1), name: "Easter Monday" },
    { date: addDays(easter, 60), name: "Corpus Christi" },
  ];
  for (const [m, d, name] of FIXED) {
    const date = iso(year, m, d);
    out.push({ date, name });
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) out.push({ date: addDays(date, 1), name: `${name} (observed)` });
  }
  return out;
}

export function holidaysFor(year: number, data?: Pick<AppData, "holidays">): Holiday[] {
  const removed = new Set(data?.holidays?.removed ?? []);
  const added = (data?.holidays?.added ?? []).filter((h) => h.date.startsWith(`${year}-`));
  const all = [...builtInHolidays(year), ...added].filter((h) => !removed.has(h.date));
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

/** Map of date -> holiday name for the given years. */
export function holidayMap(years: number[], data?: Pick<AppData, "holidays">): Map<string, string> {
  const m = new Map<string, string>();
  for (const y of new Set(years)) for (const h of holidaysFor(y, data)) m.set(h.date, h.name);
  return m;
}
