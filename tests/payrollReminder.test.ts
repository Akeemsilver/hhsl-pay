import { describe, expect, it } from "vitest";
import { closesText, payrollReminderFor } from "../src/payrollReminder";

const days = [{}];

describe("payroll reminder", () => {
  it("starts on the last day of the month for that month", () => {
    expect(payrollReminderFor({ entries: days }, "2026-10-30")).toBeNull();
    expect(payrollReminderFor({ entries: days }, "2026-10-31")).toEqual({ month: "2026-10", stage: "due", closes: "2 November" });
  });
  it("carries on through the 1st and 2nd for the month before", () => {
    expect(payrollReminderFor({ entries: days }, "2026-11-01")).toMatchObject({ month: "2026-10", stage: "due" });
    expect(payrollReminderFor({ entries: days }, "2026-11-02")).toMatchObject({ month: "2026-10", stage: "due" });
  });
  it("after payroll closed it is only a note, then nothing", () => {
    expect(payrollReminderFor({ entries: days }, "2026-11-03")).toMatchObject({ month: "2026-10", stage: "missed" });
    expect(payrollReminderFor({ entries: days }, "2026-11-11")).toBeNull();
    expect(payrollReminderFor({ entries: days }, "2026-11-15")).toBeNull();
  });
  it("stops once the email is confirmed, nothing to send, or the note was read", () => {
    for (const s of ["sent", "none", "seen"] as const) {
      expect(payrollReminderFor({ entries: days, payrollStatus: { "2026-10": s } }, "2026-10-31")).toBeNull();
      expect(payrollReminderFor({ entries: days, payrollStatus: { "2026-10": s } }, "2026-11-02")).toBeNull();
    }
  });
  it("one month's answer does not stop the next month", () => {
    expect(payrollReminderFor({ entries: days, payrollStatus: { "2026-10": "sent" } }, "2026-11-30")).toMatchObject({ month: "2026-11" });
  });
  it("crosses the year, and a short February", () => {
    expect(payrollReminderFor({ entries: days }, "2027-01-01")).toMatchObject({ month: "2026-12", closes: "2 January" });
    expect(payrollReminderFor({ entries: days }, "2027-02-28")).toMatchObject({ month: "2027-02", closes: "2 March" });
  });
  it("does not show before anything is logged", () => {
    expect(payrollReminderFor({ entries: [] }, "2026-10-31")).toBeNull();
  });
  it("names the closing day", () => { expect(closesText("2026-12")).toBe("2 January"); });
});
