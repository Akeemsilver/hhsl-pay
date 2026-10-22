import { describe, expect, it } from "vitest";
import { siteBreakdown, buildPayslips, earningsLines } from "../src/payslip";
import { newData, type AppData, type Entry } from "../src/model";
import { demoSites, demoTax } from "./support";

function data(entries: Entry[], extra: Partial<AppData> = {}): AppData {
  const d = newData();
  d.history = {
    sites: [{ effectiveFrom: "2000-01-01", value: { ...demoSites, Alpha: { ...demoSites.Alpha!, roles: { "Client medic": { rate: 70 } } } } }],
    tax: [{ effectiveFrom: "2000-01-01", value: demoTax }],
  };
  d.payerNames = { main: "Main payslip", alpha: "Alpha Ltd" };
  d.entries = entries;
  return { ...d, ...extra };
}
const e = (id: string, date: string, site: string, extra: Partial<Entry> = {}): Entry => ({ id, date, site, hours: 12, ...extra });

describe("earnings lines", () => {
  it("add up to the month's gross for every kind of day", () => {
    const entries = [
      e("1", "2026-07-01", "Alpha"),                              // weekday standard
      e("2", "2026-07-02", "Alpha", { role: "Client medic" }),    // role rate
      e("3", "2026-07-03", "Alpha", { holiday: true }),           // holiday x2 / x3
      e("4", "2026-07-06", "Beta"),                               // 8 x1 + 4 x1.5
      e("5", "2026-07-07", "Rig", { hours: 14 }),                 // flat + overtime
      e("6", "2026-07-08", "Rig", { hours: 0 }),                  // flat, no hours
    ];
    const lines = earningsLines(entries, data(entries).history);
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const expected = 12 * 50 + 12 * 70 + 50 * (8 * 2 + 4 * 3) + (8 * 40 + 4 * 40 * 1.5) + (1000 + 2 * 40 * 1.5) + 1000;
    expect(total).toBeCloseTo(expected, 2);
  });

  it("groups by site, role and rate, with quantities in hours or days", () => {
    const entries = [e("1", "2026-07-01", "Alpha"), e("2", "2026-07-02", "Alpha"), e("3", "2026-07-08", "Rig", { hours: 0 }), e("4", "2026-07-09", "Rig", { hours: 0 })];
    const lines = earningsLines(entries, data(entries).history);
    const std = lines.find((l) => l.description === "Alpha: standard hours")!;
    expect(std).toMatchObject({ qty: 24, unit: "h", rate: 50, amount: 1200 });
    const flat = lines.find((l) => l.description === "Rig: flat day rate")!;
    expect(flat).toMatchObject({ qty: 2, unit: "days", rate: 1000, amount: 2000 });
  });

  it("names the role, team lead and public holiday", () => {
    const entries = [e("1", "2026-07-02", "Alpha", { role: "Client medic" }), e("2", "2026-07-03", "Alpha", { lead: true }), e("3", "2026-07-06", "Beta", { holiday: true })];
    const names = earningsLines(entries, data(entries).history).map((l) => l.description).join("|");
    expect(names).toContain("Alpha (Client medic)");
    expect(names).toContain("Alpha (team lead)");
    expect(names).toContain("Beta, public holiday");
  });
});

describe("payslips", () => {
  const entries = [e("1", "2026-06-01", "Alpha"), e("2", "2026-07-01", "Alpha"), e("3", "2026-07-02", "Beta", { hours: 8 })];

  it("makes one per payslip with deductions that match the month", () => {
    const slips = buildPayslips("2026-07", data(entries), "Pat Example");
    expect(slips.map((s) => s.payerName).sort()).toEqual(["Alpha Ltd", "Main payslip"]);
    const alpha = slips.find((s) => s.payer === "alpha")!;
    expect(alpha.employee).toBe("Pat Example");
    expect(alpha.gross).toBeCloseTo(600);
    expect(alpha.lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(alpha.gross);
    expect(alpha.net).toBeCloseTo(alpha.gross - alpha.paye - alpha.nis - alpha.surcharge);
    expect(alpha.hours).toBe(12);
    expect(alpha.days).toBe(1);
  });

  it("year to date adds the months up to this one for the same payslip", () => {
    const alpha = buildPayslips("2026-07", data(entries), "Pat").find((s) => s.payer === "alpha")!;
    expect(alpha.ytd.gross).toBeCloseTo(1200);
    const june = buildPayslips("2026-06", data(entries), "Pat").find((s) => s.payer === "alpha")!;
    expect(june.ytd.gross).toBeCloseTo(600);
  });

  it("shows an adjustment line when the payslip's own gross was entered, so lines still add up", () => {
    const d = data(entries, { corrections: { "2026-07|alpha": { gross: 700, paye: 12 } } });
    const alpha = buildPayslips("2026-07", d, "Pat").find((s) => s.payer === "alpha")!;
    expect(alpha.gross).toBe(700);
    expect(alpha.paye).toBe(12);
    expect(alpha.corrected).toBe(true);
    expect(alpha.lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(700);
    expect(alpha.lines.some((l) => l.description.startsWith("Adjustment"))).toBe(true);
  });

  it("is empty for a month with no pay, and ignores other jobs", () => {
    expect(buildPayslips("2026-03", data(entries), "Pat")).toEqual([]);
    const other: Entry = { id: "9", date: "2026-07-05", kind: "other", site: "", hours: 0, description: "Airport pickup" };
    expect(buildPayslips("2026-07", data([...entries, other]), "Pat").length).toBe(2);
  });
});

describe("site breakdown", () => {
  it("splits hours by multiple per site and adds up to the gross", () => {
    const entries = [e("1", "2026-07-01", "Alpha"), e("2", "2026-07-02", "Alpha", { role: "Client medic" }), e("4", "2026-07-06", "Beta")];
    const [slip] = buildPayslips("2026-07", data(entries), "Test").filter((p) => p.sites.length);
    const all = buildPayslips("2026-07", data(entries), "Test").flatMap((p) => p.sites);
    expect(all.map((b) => b.label).sort()).toEqual(["Alpha", "Beta"]);
    const beta = all.find((b) => b.label === "Beta")!;
    expect(beta.x1).toBe(8);
    expect(beta.x15).toBe(4);
    expect(beta.hours).toBe(12);
    expect(beta.rates).toEqual([40]);
    expect(all.find((b) => b.label === "Alpha")!.rates).toEqual([50, 70]);
    expect(beta.weighted).toBe(14);
    void slip;
  });
});

describe("combined payslip", () => {
  it("adds every payslip together with each site once", async () => {
    const { combinePayslips } = await import("../src/payslip");
    const entries = [e("1", "2026-07-01", "Alpha"), e("4", "2026-07-06", "Beta")];
    const slips = buildPayslips("2026-07", data(entries), "Test");
    const all = combinePayslips(slips)!;
    expect(all.gross).toBeCloseTo(slips.reduce((s, p) => s + p.gross, 0), 2);
    expect(all.net).toBeCloseTo(slips.reduce((s, p) => s + p.net, 0), 2);
    expect(all.sites.map((b) => b.label).sort()).toEqual(["Alpha", "Beta"]);
    expect(all.days).toBe(2);
  });
});

describe("split and combined tax", () => {
  it("is one choice for the whole app: split by default", async () => {
    const { isCombined, setCombinedTax } = await import("../src/model");
    let d = data([]);
    expect(isCombined(d)).toBe(false);
    d = setCombinedTax(d, true);
    for (const m of ["2026-01", "2026-07", "2027-01"]) expect(isCombined(d, m)).toBe(true);
    d = setCombinedTax(d, false);
    expect(isCombined(d, "2026-07")).toBe(false);
  });
  it("an older month-by-month choice still counts, as its latest value", async () => {
    const { isCombined } = await import("../src/model");
    const d = data([], { taxMode: [{ effectiveFrom: "2026-03-01", combined: true }, { effectiveFrom: "2026-10-01", combined: false }] });
    expect(isCombined(d, "2026-05")).toBe(false);
  });
  it("taxes everything once when combined, with one payslip", async () => {
    const { setCombinedTax } = await import("../src/model");
    const entries = [e("1", "2026-07-01", "Alpha"), e("4", "2026-07-06", "Beta"), e("5", "2026-07-07", "Rig", { hours: 14 })];
    const split = buildPayslips("2026-07", data(entries), "T");
    const comb = buildPayslips("2026-07", setCombinedTax(data(entries), true), "T");
    expect(split.length).toBeGreaterThan(1);
    expect(comb).toHaveLength(1);
    expect(comb[0]!.gross).toBeCloseTo(split.reduce((s, p) => s + p.gross, 0), 2);
    expect(comb[0]!.sites.map((b) => b.label).sort()).toEqual(["Alpha", "Beta", "Rig"]);
    expect(comb[0]!.nis + comb[0]!.surcharge).not.toBeCloseTo(split.reduce((s, p) => s + p.nis + p.surcharge, 0), 2);
  });
});

describe("other jobs with an amount", () => {
  it("add to the gross of their payslip, are taxed with it, and show as a line", () => {
    const base = data([e("1", "2026-07-01", "Beta")]);
    const withOther = data([e("1", "2026-07-01", "Beta"), { id: "o", date: "2026-07-02", kind: "other", site: "", hours: 0, description: "Pickup", startTime: "08:00", endTime: "10:00", amount: 300 }]);
    withOther.payerNames = { ...withOther.payerNames };
    const a = buildPayslips("2026-07", base, "T");
    const b = buildPayslips("2026-07", withOther, "T");
    const payer = b.find((p) => p.lines.some((l) => l.description === "Other jobs"))!;
    expect(payer).toBeDefined();
    const before = a.find((p) => p.payer === payer.payer)!;
    expect(payer.gross).toBeCloseTo(before.gross + 300, 2);
    expect(payer.nis + payer.surcharge + payer.paye).toBeGreaterThan(before.nis + before.surcharge + before.paye - 0.001);
    expect(payer.sites.find((s) => s.label === "Other jobs")).toMatchObject({ amount: 300, hours: 2 });
    expect(payer.lines.reduce((t, l) => t + l.amount, 0)).toBeCloseTo(payer.gross, 2);
  });
  it("count as nothing while the amount is blank", () => {
    const d = data([e("1", "2026-07-01", "Beta"), { id: "o", date: "2026-07-02", kind: "other", site: "", hours: 0, description: "Pickup" }]);
    const slips = buildPayslips("2026-07", d, "T");
    expect(slips.every((p) => !p.lines.some((l) => l.description === "Other jobs"))).toBe(true);
  });
});
