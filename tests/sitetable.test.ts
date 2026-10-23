import { describe, expect, it } from "vitest";
import { computeMonth } from "../src/engine";
import { newData } from "../src/model";
import { siteTable } from "../src/siteTable";

const cap = { x1: 12, x15: 1000 };
const data = newData();
data.history.sites[0]!.value = {
  Nuiron: { payer: "main", baseRate: 60, weekday: { x1: 8, x15: 4, x2: 1000 }, weekend: { x15: 12, x2: 1000 }, holiday: { x2: 1000 } },
  Yard: { payer: "main", dailyStd: 500, showRateAboveHrs: 12, rateAboveHrs: 60, weekday: cap, weekend: cap, holiday: cap },
};
// 2026-09-05 is a Saturday, the 8th and 9th are Tue and Wed.
data.entries = [
  { id: "1", date: "2026-09-05", site: "Nuiron", hours: 11 },
  { id: "2", date: "2026-09-08", site: "Nuiron", hours: 8 },
  { id: "3", date: "2026-09-08", site: "Yard", hours: 12 },
  { id: "4", date: "2026-09-09", site: "Yard", hours: 12 },
  { id: "5", date: "2026-09-10", kind: "other", site: "", hours: 3, description: "Delivery", amount: 100 },
] as never;
const result = () => computeMonth("2026-09", data.entries.filter((e) => (e as { kind?: string }).kind !== "other") as never, data.history, {}, false, []);

describe("month by site", () => {
  it("counts weekday and weekend days, worked hours and paid hours for each site", () => {
    const { rows } = siteTable(result() as never, data);
    const nuiron = rows.find((r) => r.site === "Nuiron")!;
    expect(nuiron).toMatchObject({ days: 2, weekdays: 1, offdays: 1, worked: 19, total: 16.5 + 8 });
    expect(nuiron.income).toBe(11 * 60 * 1.5 + 8 * 60);
  });
  it("leaves hours out for a fixed day rate site", () => {
    const yard = siteTable(result() as never, data).rows.find((r) => r.site === "Yard")!;
    expect(yard).toMatchObject({ days: 2, weekdays: 2, offdays: 0, income: 1000 });
    expect(yard.worked).toBeUndefined();
    expect(yard.total).toBeUndefined();
  });
  it("adds a line for paid other jobs and an All sites line that adds up", () => {
    const { rows, all } = siteTable(result() as never, data);
    expect(rows.at(-1)).toMatchObject({ site: "Other jobs", income: 100, days: 1, worked: 3, total: 3 });
    expect(all.income).toBe(rows.reduce((t, r) => t + r.income, 0));
    expect(all.days).toBe(4); // the 8th has two sites but is one day
    expect(all.worked).toBe(22); // Nuiron 19 + other jobs 3, the fixed rate site adds none
  });
  it("leaves the other jobs line out when a site filter is on", () => {
    expect(siteTable(result() as never, data, { others: false }).rows.some((r) => r.site === "Other jobs")).toBe(false);
  });
});
