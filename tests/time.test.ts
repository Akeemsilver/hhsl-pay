import { describe, expect, it } from "vitest";
import { minutesBetween, paidHoursFrom, parseTimeInput, to12h, toMinutes } from "../src/engine";
import { quickTimes } from "../src/components/TimeField";
import { withComputedHours } from "../src/model";

describe("paid hours from times and lunch", () => {
  it("takes an unpaid lunch off", () => {
    expect(paidHoursFrom({ startTime: "07:00", endTime: "19:00" })).toBe(11); // 1 hour by default
    expect(paidHoursFrom({ startTime: "07:00", endTime: "19:00", lunchMinutes: 60 })).toBe(11);
    expect(paidHoursFrom({ startTime: "08:00", endTime: "16:30", lunchMinutes: 30 })).toBe(8);
    expect(paidHoursFrom({ startTime: "07:00", endTime: "19:00", lunchMinutes: 30 })).toBe(11.5);
  });

  it("takes nothing off when lunch was paid", () => {
    expect(paidHoursFrom({ startTime: "07:00", endTime: "19:00", lunchPaid: true })).toBe(12);
    expect(paidHoursFrom({ startTime: "07:00", endTime: "19:00", lunchPaid: true, lunchMinutes: 30 })).toBe(12);
  });

  it("handles shifts that run past midnight", () => {
    expect(minutesBetween("19:00", "07:00")).toBe(720);
    expect(paidHoursFrom({ startTime: "19:00", endTime: "07:00" })).toBe(11);
    expect(paidHoursFrom({ startTime: "22:30", endTime: "06:00", lunchPaid: true })).toBe(7.5);
  });

  it("gives nothing until both times are valid, and never goes negative", () => {
    expect(paidHoursFrom({ startTime: "07:00" })).toBeUndefined();
    expect(paidHoursFrom({ endTime: "19:00" })).toBeUndefined();
    expect(paidHoursFrom({ startTime: "07:00", endTime: "07:00" })).toBeUndefined();
    expect(paidHoursFrom({ startTime: "07:00", endTime: "07:30" })).toBe(0);
    expect(paidHoursFrom({ startTime: "25:00", endTime: "07:00" })).toBeUndefined();
  });

  it("overwrites hours only when times are set", () => {
    const timed = withComputedHours({ id: "1", date: "2026-07-01", site: "A", hours: 12, startTime: "07:00", endTime: "19:00" });
    expect(timed.hours).toBe(11);
    const untimed = withComputedHours({ id: "2", date: "2026-07-01", site: "A", hours: 12 });
    expect(untimed.hours).toBe(12);
  });
});

describe("typing a time", () => {
  it.each([
    ["1930", "19:30"], ["19:30", "19:30"], ["7:30pm", "19:30"], ["7:30 PM", "19:30"], ["730pm", "19:30"],
    ["7pm", "19:00"], ["12am", "00:00"], ["12pm", "12:00"], ["730", "07:30"], ["7", "07:00"], ["0700", "07:00"],
  ])("reads %s as %s", (input, expected) => expect(parseTimeInput(input)).toBe(expected));

  it.each(["", "abc", "25:00", "13pm", "7:75", "0pm"])("rejects %j", (input) => expect(parseTimeInput(input)).toBeNull());

  it("converts for display", () => {
    expect(to12h("19:30")).toBe("7:30 PM");
    expect(to12h("00:05")).toBe("12:05 AM");
    expect(to12h("12:00")).toBe("12:00 PM");
    expect(toMinutes("7:00")).toBe(420);
  });
});

describe("quick times", () => {
  it("offers your most used times, and the usual two when there are none", () => {
    expect(quickTimes([])).toEqual(["07:00", "19:00"]);
    expect(quickTimes(["06:00", "18:00", "06:00", undefined, "06:00", "18:00", "08:00"])).toEqual(["06:00", "18:00", "08:00"]);
  });
});

import { isDetailed, toDetailed, toSimple, type Entry } from "../src/model";

describe("Simple and Detailed jobs", () => {
  const base: Entry = { id: "1", date: "2026-07-01", site: "A", hours: 12 };

  it("a Simple job keeps its typed hours, even if it still has times", () => {
    const simple = withComputedHours({ ...base, detailed: false, startTime: "07:00", endTime: "19:00" });
    expect(simple.hours).toBe(12);
    expect(isDetailed(simple)).toBe(false);
  });

  it("a Detailed job works hours out from its times, and is 0 until both are set", () => {
    expect(withComputedHours({ ...base, detailed: true, startTime: "07:00", endTime: "19:00" }).hours).toBe(11);
    expect(withComputedHours({ ...base, detailed: true, startTime: "07:00" }).hours).toBe(0);
    expect(withComputedHours({ ...base, detailed: true }).hours).toBe(0);
  });

  it("older jobs count as Detailed only when they have times", () => {
    expect(isDetailed(base)).toBe(false);
    expect(isDetailed({ ...base, startTime: "07:00" })).toBe(true);
  });

  it("pressing Detailed clears the hours; going back to Simple keeps them and drops the times", () => {
    const d = toDetailed(base);
    expect(d.detailed).toBe(true);
    expect(d.hours).toBe(0);
    const timed = withComputedHours({ ...d, startTime: "07:00", endTime: "19:00" });
    expect(timed.hours).toBe(11);
    const back = toSimple(timed);
    expect(back.detailed).toBe(false);
    expect(back.hours).toBe(11);
    expect(back.startTime).toBeUndefined();
    expect(back.endTime).toBeUndefined();
  });

  it("fills an other job's hours from its times, and leaves typed hours alone without times", () => {
    const other: Entry = { id: "2", date: "2026-07-01", kind: "other", site: "", hours: 0, startTime: "08:00", endTime: "10:00" };
    expect(withComputedHours(other).hours).toBe(2);
    const typed: Entry = { id: "3", date: "2026-07-01", kind: "other", site: "", hours: 3.5 };
    expect(withComputedHours(typed)).toBe(typed);
  });
});
