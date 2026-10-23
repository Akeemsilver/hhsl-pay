import { describe, expect, it } from "vitest";
import { computeMonth } from "../src/engine";
import { newData } from "../src/model";
import { sheetSplit } from "../src/sheetSplit";

const cap = { x1: 12, x15: 1000 };
const free = { weekday: { x1: 1000 }, weekend: { x1: 1000 }, holiday: { x1: 1000 } };

describe("sites on the time sheet get their own line", () => {
  const data = newData();
  data.history.sites[0]!.value = {
    Atlantic: { payer: "atl", baseRate: 60, ...free },
    Offshore: { payer: "main", dailyStd: 1000, showRateAboveHrs: 12, rateAboveHrs: 60, weekday: cap, weekend: cap, holiday: cap },
    Other: { payer: "main", baseRate: 50, ...free },
  };
  data.timesheet = { name: "T", siteLabel: "ERT Offsite", rules: [{ site: "Offshore", label: "Offshore" }], medicEverywhere: false };
  const entries = [
    { id: "1", date: "2026-10-13", site: "Offshore", hours: 14 },
    { id: "2", date: "2026-10-14", site: "Offshore", hours: 12 },
    { id: "3", date: "2026-10-14", site: "Other", hours: 4 },
    { id: "4", date: "2026-10-15", site: "Atlantic", hours: 12 },
  ] as never;
  const month = () => computeMonth("2026-10", entries, data.history, {}, false, []);

  it("counts each day once and takes the time sheet hours out of the group", () => {
    const split = sheetSplit(month() as never, data);
    const main = split.payers.find((p) => p.payer === "main")!;
    // The 14th has an Offshore job (time sheet) and an Other job: it is one day, on the time sheet.
    expect(split.sheet).toEqual({ days: 2, sites: ["Offshore"] });
    expect(main.days).toBe(0);
    expect(main.weighted).toBe(4); // only the Other site's own hours stay
    expect(split.payers.find((p) => p.payer === "atl")!.days).toBe(1);
    expect(split.totalDays).toBe(3);
    expect(split.totalHours).toBe(16);
    expect(split.totalDays).toBe(split.payers.reduce((t, p) => t + p.days, 0) + split.sheet!.days);
  });
  it("shows no time sheet line when no site is on it", () => {
    const split = sheetSplit(month() as never, { ...data, timesheet: { ...data.timesheet!, rules: [] } });
    expect(split.sheet).toBeUndefined();
    expect(split.totalDays).toBe(split.payers.reduce((t, p) => t + p.days, 0));
  });
  it("puts a day with jobs in two groups on the group with the most hours", () => {
    const two = [
      { id: "1", date: "2026-10-15", site: "Atlantic", hours: 12 },
      { id: "2", date: "2026-10-15", site: "Other", hours: 4 },
    ] as never;
    const m = computeMonth("2026-10", two, data.history, {}, false, []);
    const split = sheetSplit(m as never, { ...data, timesheet: { ...data.timesheet!, rules: [] } });
    expect(split.totalDays).toBe(1);
    expect(split.payers.find((p) => p.payer === "atl")!.days).toBe(1);
    expect(split.payers.find((p) => p.payer === "main")!.days).toBe(0);
  });
});

describe("other jobs on the time sheet", () => {
  const data = newData();
  data.history.sites[0]!.value = { Atlantic: { payer: "atl", baseRate: 60, ...free } };
  data.payerNames = { main: "Main", atl: "Atlantic" };
  data.timesheet = { name: "T", siteLabel: "ERT Offsite", rules: [], medicEverywhere: false };
  const all = [
    { id: "1", date: "2026-10-15", site: "Atlantic", hours: 12 },
    { id: "2", date: "2026-10-16", kind: "other", site: "", hours: 3, description: "Delivery", amount: 100 },
    { id: "3", date: "2026-10-17", kind: "other", site: "", hours: 2, description: "Pickup" },
  ];
  const sites = all.filter((e) => e.kind !== "other");
  const month = () => computeMonth("2026-10", sites as never, data.history, {}, false, [{ date: "2026-10-16", payer: "main", amount: 100, hours: 3 }]);
  it("go on the Time sheet line, days only, and leave their group", () => {
    const split = sheetSplit(month() as never, { ...data, entries: all as never });
    expect(split.sheet).toEqual({ days: 2, sites: ["Other jobs"] });
    expect(split.payers.find((p) => p.payer === "main")!.days).toBe(0);
    expect(split.payers.find((p) => p.payer === "main")!.weighted).toBe(0);
    expect(split.totalDays).toBe(3);
    expect(split.totalHours).toBe(12);
  });
  it("stay in their group when other jobs are off the time sheet", () => {
    const split = sheetSplit(month() as never, { ...data, entries: all as never, timesheet: { ...data.timesheet!, includeOther: false } });
    expect(split.sheet).toBeUndefined();
    expect(split.payers.find((p) => p.payer === "main")!.days).toBe(1);
    expect(split.totalDays).toBe(2);
  });
});

describe("a role on the time sheet (PLNL Client medic)", () => {
  const data = newData();
  data.history.sites[0]!.value = { PLNL: { payer: "main", baseRate: 60, ...free }, Atlantic: { payer: "atl", baseRate: 60, ...free } };
  data.timesheet = { name: "T", siteLabel: "ERT Offsite", rules: [{ site: "PLNL", role: "Client medic", label: "PLNL Medic" }], medicEverywhere: false };
  const entries = [
    { id: "1", date: "2026-10-12", site: "PLNL", role: "Client medic", hours: 12 },
    { id: "2", date: "2026-10-13", site: "PLNL", hours: 10 },
    { id: "3", date: "2026-10-14", site: "Atlantic", hours: 12 },
  ] as never;
  it("takes only the medic day and its hours out of the group", () => {
    const month = computeMonth("2026-10", entries, data.history, {}, false, []);
    expect(month.payers.find((p) => p.payer === "main")!.days).toBe(2);
    const split = sheetSplit(month as never, data);
    const main = split.payers.find((p) => p.payer === "main")!;
    expect(main.days).toBe(1); // the plain PLNL day stays
    expect(main.weighted).toBe(10); // the medic day's 12 hours are gone
    expect(split.sheet).toEqual({ days: 1, sites: ["PLNL"] });
    expect(split.totalDays).toBe(3);
    expect(split.totalHours).toBe(22);
  });
});
