/** The once-a-month backup reminder: it shows on the last day of the month, only when there are days in the app. */
export interface ReminderData { entries: unknown[]; lastBackupAt?: string; backupSnoozedMonth?: string }

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10" -> "2026-10-31" */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${month}-${pad(new Date(y, m, 0).getDate())}`;
}

/** The local month ("YYYY-MM") of a timestamp. */
function localMonthOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/**
 * True on the last day of a month when the person has days logged, has not backed up this month and has not chosen "Remind me later"
 * for it. A new user is reminded on the last day of the month they started in; if the app is not opened on that day, the next
 * reminder is the last day of the next month.
 */
export function backupReminderDue(d: ReminderData, todayIso: string): boolean {
  if (d.entries.length === 0) return false;
  const month = todayIso.slice(0, 7);
  if (todayIso !== lastDayOfMonth(month)) return false;
  if (d.backupSnoozedMonth === month) return false;
  if (d.lastBackupAt && localMonthOf(d.lastBackupAt) === month) return false;
  return true;
}
