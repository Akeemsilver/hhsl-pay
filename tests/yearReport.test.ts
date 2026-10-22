import { describe, expect, it } from "vitest";
import { computeMonth } from "../src/engine";
import { isCombined, isOther, newData, otherIncome, overridesFor, type AppData, type Entry } from "../src/model";
import { runningTotal, yearReport } from "../src/yearReport";
import { demoSites, demoTax } from "./support";

const e = (id: string, date: string, site: string, extra: Partial<Entry> = {}): Entry => ({ id, date, site, hours: 12, ...extra });

function setup(entries: Entry[], extra: Partial<AppData> = {}) {
  const d = newData();
  d.history = { sites: [{ effectiveFrom: "2000-01-01", value: demoSites }], tax: [{ effectiveFrom: "2000-01-01", value: demoTax }] };
  d.payerNames = { main: "Main payslip", alpha: "Alpha Ltd" };
  d.entries = entries;
  const data = { ...d, ...extra };
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = `2026-${String(i + 1).padStart(2, "0")}`;
    return computeMonth(m, data.entries.filter((x) => !isOther(x)), data.history, overridesFor(data, m), isCombined(data, m), otherIncome(data, m));
  });
  return { data, months };
}

describe("year report", () => {
  const entries = [
    e("1", "2026-07-01", "Alpha"),
    e("2", "2026-07-02", "Alpha"),
    e("3", "2026-07-06", "Beta"),            // 8 x1 + 4 x1.5 = 14 paid hours
    e("4", "2026-08-03", "Beta", { hours: 8 }),
    e("5", "2026-08-04", "Alpha", { hours: 10 }),
  ];

  it("lists every site with days, hours worked, hours paid for and pay, biggest first", () => {
    const { data, months } = setup(entries);
    const r = yearReport(months, data);
    const alpha = r.sites.find((s) => s.site === "Alpha")!;
    const beta = r.sites.find((s) => s.site === "Beta")!;
    expect(alpha).toMatchObject({ days: 3, hours: 34, weighted: 34, amount: 50 * 34, group: "alpha" });
    expect(beta).toMatchObject({ days: 2, hours: 20, weighted: 14 + 8, group: "main" });
    expect(beta.amount).toBeCloseTo(40 * 14 + 40 * 8, 2);
    expect(r.sites[0]!.amount).toBeGreaterThanOrEqual(r.sites[1]!.amount);
    expect(alpha.byMonth[6]).toMatchObject({ days: 2, hours: 24, amount: 1200 });
    expect(alpha.byMonth[7]).toMatchObject({ days: 1, hours: 10 });
  });

  it("all-sites months match the month totals, and the groups add up to them", () => {
    const { data, months } = setup(entries);
    const r = yearReport(months, data);
    const jul = r.all.months[6]!;
    expect(jul.gross).toBeCloseTo(months[6]!.gross, 2);
    expect(jul).toMatchObject({ days: 3, hours: 36 });
    expect(jul.topSite).toBe("Alpha");
    const groupGross = r.groups.reduce((t, g) => t + g.months[6]!.gross, 0);
    expect(groupGross).toBeCloseTo(jul.gross, 2);
    expect(r.groups.map((g) => g.title).sort()).toEqual(["Alpha Ltd", "Main payslip"]);
  });

  it("when tax is worked out combined, a group's own tax is unknown but its income and hours are not", () => {
    const { data, months } = setup(entries, { combinedTax: true });
    const r = yearReport(months, data);
    const alpha = r.groups.find((g) => g.id === "alpha")!.months[6]!;
    expect(alpha.net).toBeNull();
    expect(alpha.paye).toBeNull();
    expect(alpha.gross).toBeCloseTo(1200, 2);
    expect(alpha.days).toBe(2);
    expect(r.all.months[6]!.net).not.toBeNull();
  });

  it("counts other jobs (with an amount) under their payslip group and as their own line", () => {
    const { data, months } = setup([...entries, e("9", "2026-07-10", "", { kind: "other", description: "Airport run", hours: 0, startTime: "08:00", endTime: "10:00", amount: 200 })], { otherPayer: "main" });
    const r = yearReport(months, data);
    const other = r.sites.find((s) => s.site === "Other jobs")!;
    expect(other).toMatchObject({ days: 1, hours: 2, amount: 200, group: "main" });
    const main = r.groups.find((g) => g.id === "main")!.months[6]!;
    expect(main.days).toBe(2);
    expect(r.all.months[6]!.days).toBe(4);
    const without = yearReport(months, data, false);
    expect(without.sites.some((s) => s.site === "Other jobs")).toBe(false);
  });

  it("running totals add up month after month", () => {
    expect(runningTotal([10, 0, 5.5, null, 4])).toEqual([10, 10, 15.5, 15.5, 19.5]);
  });
});
