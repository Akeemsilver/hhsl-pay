/** "HH:MM" (24-hour) to minutes after midnight, or null if it is not a time. */
export function toMinutes(t: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Minutes from start to end; an end earlier than the start means the shift ran past midnight. */
export function minutesBetween(start: string | undefined, end: string | undefined): number | null {
  const a = toMinutes(start), b = toMinutes(end);
  if (a === null || b === null) return null;
  const diff = (b - a + 1440) % 1440;
  return diff === 0 ? null : diff;
}

export interface LunchInput {
  startTime?: string;
  endTime?: string;
  /** Lunch was paid, so nothing is taken off. */
  lunchPaid?: boolean;
  /** Minutes of unpaid lunch to take off; 60 when not set. */
  lunchMinutes?: number;
}

/** Hours to be paid from start/end times, or undefined while either time is missing. */
export function paidHoursFrom(e: LunchInput): number | undefined {
  const mins = minutesBetween(e.startTime, e.endTime);
  if (mins === null) return undefined;
  const lunch = e.lunchPaid ? 0 : (e.lunchMinutes ?? 60);
  return Math.max(0, mins - lunch) / 60;
}

/** Reads "1930", "19:30", "7:30pm", "7 pm", "730" and similar. Returns "HH:MM" or null. */
export function parseTimeInput(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\./g, "");
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59) return null;
  const suffix = m[3]?.[0];
  if (suffix) {
    if (h < 1 || h > 12) return null;
    if (suffix === "p" && h < 12) h += 12;
    if (suffix === "a" && h === 12) h = 0;
  }
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "19:30" to "7:30 PM". */
export function to12h(t: string): string {
  const mins = toMinutes(t);
  if (mins === null) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
