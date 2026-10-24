import { describe, expect, it } from "vitest";
import { backupReminderDue, lastDayOfMonth } from "../src/backupReminder";

const days = [{}];

describe("monthly backup reminder", () => {
  it("finds the last day of each month, including a leap February", () => {
    expect(lastDayOfMonth("2026-10")).toBe("2026-10-31");
    expect(lastDayOfMonth("2026-11")).toBe("2026-11-30");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
  });
  it("only shows on the last day of the month", () => {
    expect(backupReminderDue({ entries: days }, "2026-10-30")).toBe(false);
    expect(backupReminderDue({ entries: days }, "2026-10-31")).toBe(true);
    expect(backupReminderDue({ entries: days }, "2026-11-01")).toBe(false);
  });
  it("a person who starts on 1 November is first reminded on 30 November", () => {
    for (const day of ["2026-11-01", "2026-11-15", "2026-11-29"]) expect(backupReminderDue({ entries: days }, day)).toBe(false);
    expect(backupReminderDue({ entries: days }, "2026-11-30")).toBe(true);
  });
  it("does not show when nothing is logged yet", () => {
    expect(backupReminderDue({ entries: [] }, "2026-10-31")).toBe(false);
  });
  it("Remind me later puts it off to the last day of the next month", () => {
    const later = { entries: days, backupSnoozedMonth: "2026-10" };
    expect(backupReminderDue(later, "2026-10-31")).toBe(false);
    expect(backupReminderDue(later, "2026-11-30")).toBe(true);
  });
  it("does not show when a backup was made this month", () => {
    expect(backupReminderDue({ entries: days, lastBackupAt: new Date(2026, 9, 12, 10).toISOString() }, "2026-10-31")).toBe(false);
    expect(backupReminderDue({ entries: days, lastBackupAt: new Date(2026, 8, 30, 10).toISOString() }, "2026-10-31")).toBe(true);
  });
});
