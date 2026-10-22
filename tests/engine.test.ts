import { describe, expect, it } from "vitest";
import { annualTaxEstimate, computeDay, computeMonth, monthTax, mondaysInMonth, valueOn } from "../src/engine";
import { demoHistory, demoSites, demoTax } from "./support";

describe("computeDay", () => {
  it("pays plain hours at the base rate on a weekday", () => {
    // 2026-07-01 is a Wednesday
    const pay = computeDay({ date: "2026-07-01", site: "Alpha", hours: 12 }, demoSites);
    expect(pay.total).toBeCloseTo(600);
  });

  it("uses the lead rate when flagged", () => {
    const pay = computeDay({ date: "2026-07-01", site: "Alpha", hours: 10, lead: true }, demoSites);
    expect(pay.total).toBeCloseTo(600);
  });

  it("splits hours into overtime tiers on a weekday", () => {
    // 8 at x1, 4 at x1.5
    const pay = computeDay({ date: "2026-07-01", site: "Beta", hours: 12 }, demoSites);
    expect(pay.tierHours).toEqual({ x1: 8, x15: 4, x2: 0, x3: 0 });
    expect(pay.total).toBeCloseTo(8 * 40 + 4 * 40 * 1.5);
  });

  it("uses weekend caps on Saturday and Sunday", () => {
    // Beta weekends: no x1, first 12 hours at x1.5
    const sat = computeDay({ date: "2026-07-04", site: "Beta", hours: 12 }, demoSites);
    expect(sat.total).toBeCloseTo(12 * 40 * 1.5);
  });

  it("uses holiday caps, with triple time after the double-time cap", () => {
    // Alpha holiday: first 8 at x2, rest at x3
    const pay = computeDay({ date: "2026-07-01", site: "Alpha", hours: 12, holiday: true }, demoSites);
    expect(pay.total).toBeCloseTo(50 * (8 * 2 + 4 * 3));
  });

  it("holiday takes priority over weekend", () => {
    const pay = computeDay({ date: "2026-07-04", site: "Alpha", hours: 12, holiday: true }, demoSites);
    expect(pay.total).toBeCloseTo(50 * (8 * 2 + 4 * 3));
  });

  it("pays a flat daily amount, and only shows a rate above the hour threshold", () => {
    expect(computeDay({ date: "2026-07-01", site: "Rig", hours: 10 }, demoSites).total).toBe(1000);
    // 14h: 12 covered by the daily pay, 2 over at 40 x 1.5
    expect(computeDay({ date: "2026-07-01", site: "Rig", hours: 14 }, demoSites).total).toBeCloseTo(1000 + 2 * 40 * 1.5);
    expect(computeDay({ date: "2026-07-01", site: "Rig", hours: 10, holiday: true }, demoSites).total).toBe(2000);
  });

  it("matches site names case-insensitively and ignores unknown sites or empty hours", () => {
    expect(computeDay({ date: "2026-07-01", site: "alpha", hours: 1 }, demoSites).total).toBeCloseTo(50);
    expect(computeDay({ date: "2026-07-01", site: "Nowhere", hours: 8 }, demoSites).total).toBe(0);
    expect(computeDay({ date: "2026-07-01", site: "Alpha", hours: 0 }, demoSites).total).toBe(0);
  });

  it("pays a flat daily site even with no hours logged", () => {
    expect(computeDay({ date: "2026-07-01", site: "Rig", hours: 0 }, demoSites).total).toBe(1000);
  });
});

describe("tax", () => {
  it("counts Mondays", () => {
    expect(mondaysInMonth(2026, 7)).toBe(4);
    expect(mondaysInMonth(2026, 6)).toBe(5);
  });

  it("applies NIS, PAYE and surcharge", () => {
    const t = monthTax(18000, 4, demoTax);
    expect(t.nis).toBeCloseTo(169.5 * 4);
    // (18000 - 7500 - 169.5 * 52/12 * 0.7) * 25%
    expect(t.paye).toBeCloseTo((18000 - 7500 - 169.5 * (52 / 12) * 0.7) * 0.25);
    expect(t.surcharge).toBe(33);
    expect(t.net).toBeCloseTo(18000 - t.paye - t.nis - 33);
  });

  it("charges no PAYE below the allowance and scales the surcharge in 5-Monday months", () => {
    expect(monthTax(5000, 4, demoTax).paye).toBe(0);
    expect(monthTax(5000, 5, demoTax).surcharge).toBeCloseTo(33 * 1.25);
    expect(monthTax(0, 4, demoTax).net).toBe(0);
  });

  it("never reports negative tax due just above the threshold", () => {
    expect(annualTaxEstimate(91000, 4000, 700, demoTax)).toEqual({ taxDue: 0, refund: 700 });
  });

  it("estimates year-end tax and refund", () => {
    expect(annualTaxEstimate(80000, 3000, 500, demoTax)).toEqual({ taxDue: 0, refund: 500 });
    const est = annualTaxEstimate(100000, 3000, 1500, demoTax);
    expect(est.taxDue).toBeCloseTo((100000 - 90000 - 3000 * 0.7) * 0.25);
  });
});

describe("dated rules", () => {
  it("picks the rules in force on a date", () => {
    const hist = [
      { effectiveFrom: "2026-01-01", value: "old" },
      { effectiveFrom: "2026-10-01", value: "new" },
    ];
    expect(valueOn(hist, "2026-09-30")).toBe("old");
    expect(valueOn(hist, "2026-10-01")).toBe("new");
    expect(() => valueOn(hist, "2025-12-31")).toThrow();
  });

  it("a raise leaves earlier months unchanged and applies from its start day", () => {
    const raised = { ...demoSites, Alpha: { ...demoSites.Alpha!, baseRate: 55 } };
    const history = {
      ...demoHistory,
      sites: [...demoHistory.sites, { effectiveFrom: "2026-10-15", value: raised }],
    };
    const entries = [
      { date: "2026-09-10", site: "Alpha", hours: 10 },
      { date: "2026-10-14", site: "Alpha", hours: 10 },
      { date: "2026-10-15", site: "Alpha", hours: 10 },
    ];
    expect(computeMonth("2026-09", entries, history).gross).toBeCloseTo(500);
    const oct = computeMonth("2026-10", entries, history);
    expect(oct.entries.map((e) => e.pay.total)).toEqual([500, 550]);
  });

  it("a backdated raise reprices the days it covers", () => {
    const entries = [{ date: "2026-10-03", site: "Alpha", hours: 10 }];
    const before = computeMonth("2026-10", entries, demoHistory).gross;
    const raised = { ...demoSites, Alpha: { ...demoSites.Alpha!, baseRate: 55 } };
    const after = computeMonth("2026-10", entries, {
      ...demoHistory,
      sites: [...demoHistory.sites, { effectiveFrom: "2026-10-01", value: raised }],
    }).gross;
    expect(after - before).toBeCloseTo(50);
  });
});

describe("computeMonth", () => {
  it("taxes each payer separately", () => {
    const entries = [
      { date: "2026-07-01", site: "Alpha", hours: 12 },
      { date: "2026-07-02", site: "Beta", hours: 8 },
    ];
    const month = computeMonth("2026-07", entries, demoHistory);
    expect(month.payers.map((p) => p.payer).sort()).toEqual(["alpha", "main"]);
    expect(month.gross).toBeCloseTo(600 + 320);
    // below the allowance, so no PAYE on either payslip
    expect(month.paye).toBe(0);
  });

  it("uses the payslip's actual PAYE and gross when given, and recalculates net", () => {
    const entries = [{ date: "2026-07-01", site: "Alpha", hours: 12 }];
    const calc = computeMonth("2026-07", entries, demoHistory).payers[0]!;
    const fixed = computeMonth("2026-07", entries, demoHistory, { alpha: { paye: 25 } }).payers[0]!;
    expect(calc.corrected).toBe(false);
    expect(fixed.corrected).toBe(true);
    expect(fixed.paye).toBe(25);
    expect(fixed.net).toBeCloseTo(fixed.gross - 25 - fixed.nis - fixed.surcharge);

    const regross = computeMonth("2026-07", entries, demoHistory, { alpha: { gross: 1000 } }).payers[0]!;
    expect(regross.gross).toBe(1000);
    expect(regross.nis).toBeCloseTo(14.6 * 4);
  });

  it("shows a payer that only has a correction", () => {
    const month = computeMonth("2026-07", [], demoHistory, { alpha: { gross: 500, paye: 0 } });
    expect(month.payers.map((p) => p.payer)).toEqual(["alpha"]);
    expect(month.gross).toBe(500);
  });

  it("pays a custom role at its own rate and keeps the site's overtime caps", () => {
    const sites = {
      ...demoSites,
      Beta: { ...demoSites.Beta!, roles: { "Client medic": { rate: 70 } } },
    };
    // Beta weekday caps: 8 at x1, 4 at x1.5
    const medic = computeDay({ date: "2026-07-01", site: "Beta", hours: 12, role: "client medic" }, sites);
    expect(medic.rate).toBe(70);
    expect(medic.total).toBeCloseTo(8 * 70 + 4 * 70 * 1.5);
    const standard = computeDay({ date: "2026-07-01", site: "Beta", hours: 12 }, sites);
    expect(standard.rate).toBe(40);
  });

  it("a role can carry its own flat daily pay, and wins over the lead flag", () => {
    const flat = {
      Flat: {
        payer: "main", baseRate: 40, leadRate: 45, weekday: {}, weekend: {}, holiday: {},
        dailyStd: 500, dailyLead: 700,
        roles: { Medic: { rate: 70, dailyPay: 900, dailyHoliday: 1800 } },
      },
    };
    expect(computeDay({ date: "2026-07-01", site: "Flat", hours: 8 }, flat).total).toBe(500);
    expect(computeDay({ date: "2026-07-01", site: "Flat", hours: 8, lead: true }, flat).total).toBe(700);
    expect(computeDay({ date: "2026-07-01", site: "Flat", hours: 8, role: "Medic" }, flat).total).toBe(900);
    expect(computeDay({ date: "2026-07-01", site: "Flat", hours: 8, role: "Medic", holiday: true }, flat).total).toBe(1800);
    expect(computeDay({ date: "2026-07-01", site: "Flat", hours: 8, role: "Medic", lead: true }, flat).total).toBe(900);
  });

  it("ignores an unknown role", () => {
    expect(computeDay({ date: "2026-07-01", site: "Beta", hours: 8, role: "Nope" }, demoSites).rate).toBe(40);
  });
});

describe("filtering a month to one location", () => {
  it("keeps only that site's days and shares the payslip's tax by gross", async () => {
    const { filterMonth } = await import("../src/engine");
    const entries = [
      { id: "1", date: "2026-07-01", site: "Alpha", hours: 12 },
      { id: "2", date: "2026-07-02", site: "Beta", hours: 12 },
    ];
    const all = computeMonth("2026-07", entries, demoHistory);
    const a = filterMonth(all, "Alpha", demoHistory);
    expect(a.entries).toHaveLength(1);
    const alphaGross = a.entries[0]!.pay.total;
    expect(a.gross).toBeCloseTo(alphaGross);
    const alphaPayer = demoHistory.sites[0]!.value.Alpha!.payer;
    const betaPayer = demoHistory.sites[0]!.value.Beta!.payer;
    if (alphaPayer === betaPayer) {
      const b = filterMonth(all, "Beta", demoHistory);
      expect(a.paye + b.paye).toBeCloseTo(all.paye);
      expect(a.net + b.net).toBeCloseTo(all.net);
    }
    expect(a.net).toBeCloseTo(a.gross - a.paye - a.nis - a.surcharge);
  });
});

describe("role with its own overtime hours", () => {
  it("uses the role's hours, and the site's when the role has none", () => {
    const sites = { PLNL: { payer: "main", baseRate: 60, weekday: { x1: 12 }, weekend: {}, holiday: {}, roles: { "Client medic": { rate: 60, weekday: { x1: 8, x15: 4 } }, Offshore: { rate: 70 } } } };
    const std = computeDay({ date: "2026-07-01", site: "PLNL", hours: 12 }, sites);
    expect(std.tierHours).toMatchObject({ x1: 12, x15: 0 });
    expect(std.total).toBeCloseTo(720);
    const medic = computeDay({ date: "2026-07-01", site: "PLNL", hours: 12, role: "Client medic" }, sites);
    expect(medic.tierHours).toMatchObject({ x1: 8, x15: 4 });
    expect(medic.total).toBeCloseTo(8 * 60 + 4 * 60 * 1.5);
    const off = computeDay({ date: "2026-07-01", site: "PLNL", hours: 12, role: "Offshore" }, sites);
    expect(off.tierHours).toMatchObject({ x1: 12, x15: 0 });
  });
});
