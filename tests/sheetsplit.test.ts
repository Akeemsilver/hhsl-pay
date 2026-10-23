import { describe, expect, it } from "vitest";
import { computeMonth } from "../src/engine";
import { newData } from "../src/model";
import { sheetSplit } from "../src/sheetSplit";

describe("sites on the time sheet get their own line", () => {
  const data = newData();
  const cap = { x1: 12, x15: 1000 };
  data.history.sites[0]!.value = {
    Atlantic: { payer: "atl", baseRate: 60, weekday: { x1: 1000 }, weekend: { x1: 1000 }, holiday: { x1: 1000 } },
    Offshore: { payer: "main", dailyStd: 1000, showRateAboveHrs: 12, rateAboveHrs: 60, weekday: cap, weekend: cap, holiday: cap },
    Other: { payer: "main", baseRate: 50, weekday: { x1: 1000 }, weekend: { x1: 1000 }, holiday: { x1: 1000 } },
  };
  data.timesheet = { name: "T", siteLabel: "ERT Offsite", rules: [{ site: "Offshore", label: "Offshore" }], medicEverywhere: false };
  const entries = [
    { id: "1", date: "2026-10-13", site: "Offshore", hours: 14 },
    { id: "2", date: "2026-10-14", site: "Offshore", hours: 12 },
    { id: "3", date: "2026-10-14", site: "Other", hours: 4 },
    { id: "4", date: "2026-10-15", site: "Atlantic", hours: 12 },
  ] as never;
  it("takes their days and hours out of the group and shows them separately", () => {
    const month = computeMonth("2026-10", entries, data.history, {}, false, []);
    const before = month.payers.find((p) => p.payer === "main")!;
    expect(before.days).toBe(2);
    const split = sheetSplit(month as never, data);
    const main = split.payers.find((p) => p.payer === "main")!;
    expect(main.days).toBe(1); // only the day with the Other site is left in the group
    expect(main.weighted).toBe(4);
    expect(split.payers.find((p) => p.payer === "atl")!.days).toBe(1);
    expect(split.sheet).toEqual({ days: 2, weighted: 12 + 1.5 * 2 + 12, sites: ["Offshore"] });
  });
  it("shows no time sheet line when no site is on it", () => {
    const month = computeMonth("2026-10", entries, data.history, {}, false, []);
    expect(sheetSplit(month as never, { ...data, timesheet: { ...data.timesheet!, rules: [] } }).sheet).toBeUndefined();
  });
});

describe("other jobs on the time sheet", () => {
  const data = newData();
  data.history.sites[0]!.value = { Atlantic: { payer: "atl", baseRate: 60, weekday: { x1: 1000 }, weekend: { x1: 1000 }, holiday: { x1: 1000 } } };
  data.payerNames = { main: "Main", atl: "Atlantic" };
  data.timesheet = { name: "T", siteLabel: "ERT Offsite", rules: [], medicEverywhere: false };
  const entries = [
    { id: "1", date: "2026-10-15", site: "Atlantic", hours: 12 },
    { id: "2", date: "2026-10-16", kind: "other", site: "", hours: 3, description: "Delivery", amount: 100 },
    { id: "3", date: "2026-10-17", kind: "other", site: "", hours: 2, description: "Pickup" },
  ] as never;
  it("go on the Time sheet line and leave their group's line", () => {
    const month = computeMonth("2026-10", (entries as { kind?: string }[]).filter((e) => e.kind !== "other") as never, data.history, {}, false, [{ date: "2026-10-16", payer: "main", amount: 100, hours: 3 }]);
    expect(month.payers.find((p) => p.payer === "main")!.days).toBe(1);
    const split = sheetSplit(month as never, { ...data, entries });
    expect(split.payers.find((p) => p.payer === "main")!.days).toBe(0);
    expect(split.payers.find((p) => p.payer === "main")!.weighted).toBe(0);
    expect(split.sheet).toEqual({ days: 2, weighted: 5, sites: ["Other jobs"] });
  });
  it("stay in their group when other jobs are off the time sheet", () => {
    const month = computeMonth("2026-10", (entries as { kind?: string }[]).filter((e) => e.kind !== "other") as never, data.history, {}, false, [{ date: "2026-10-16", payer: "main", amount: 100, hours: 3 }]);
    const split = sheetSplit(month as never, { ...data, entries, timesheet: { ...data.timesheet!, includeOther: false } });
    expect(split.sheet).toBeUndefined();
    expect(split.payers.find((p) => p.payer === "main")!.days).toBe(1);
  });
});
