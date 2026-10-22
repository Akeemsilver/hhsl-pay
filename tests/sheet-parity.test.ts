// Replays the real spreadsheet's days through the engine and compares with the sheet's own results.
// Needs private-fixtures/ (gitignored); skipped when absent.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeDay, computeMonth, monthTax, mondaysInMonth, type RuleHistory, type SiteRates, type TaxRules } from "../src/engine";

const dir = new URL("../private-fixtures/", import.meta.url);
const have = existsSync(new URL("fixtures.json", dir)) && existsSync(new URL("settings.json", dir));

// Without the private files the suite is registered as a single skipped test. (describe.skipIf still runs its body, which would read missing files.)
const parity = (body: () => void) => (have ? describe("parity with the spreadsheet", body) : describe.skip("parity with the spreadsheet", () => { it("needs private-fixtures/", () => {}); }));

parity(() => {
  const read = (f: string) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  const settings = read("settings.json");
  const fixtures = read("fixtures.json") as Record<string, any>;
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);

  const sites: Record<string, SiteRates> = {};
  for (const s of settings.sites) {
    sites[s.name.trim()] = {
      payer: s.name.trim().toLowerCase() === "atlantic" ? "atlantic" : "main",
      baseRate: num(s.baseRate),
      leadRate: num(s.leadRate),
      showRateAboveHrs: num(s.showRateAboveHrs),
      rateAboveHrs: num(s.rateAboveHrs),
      weekday: { x1: num(s.wd1), x15: num(s.wd15), x2: num(s.wd2) },
      weekend: { x1: num(s.we1), x15: num(s.we15), x2: num(s.we2) },
      holiday: { x1: num(s.hol1), x15: num(s.hol15), x2: num(s.hol2), x3: num(s.hol3) },
      dailyStd: num(s.dailyStd),
      dailyLead: num(s.dailyLead),
      dailyHoliday: num(s.dailyHoliday),
    };
  }
  const tax: TaxRules = {
    monthlyAllowance: 7500,
    rate: 0.25,
    annualThreshold: 90000,
    nisRelief: 0.7,
    nisBands: settings.nis,
    surchargeBands: [[0, 0], [0.01, 19.2], [470, 33]],
    fiveMondayFactor: 1.25,
  };
  const history: RuleHistory = {
    sites: [{ effectiveFrom: "2000-01-01", value: sites }],
    tax: [{ effectiveFrom: "2000-01-01", value: tax }],
  };

  const overridesOf = (name: string) => {
    const c = fixtures[name].corr ?? {};
    const out: Record<string, { gross?: number; paye?: number }> = {};
    for (const payer of ["main", "atlantic"]) {
      const o = c[payer];
      if (o && (o.gross != null || o.paye != null)) out[payer] = { gross: o.gross ?? undefined, paye: o.paye ?? undefined };
    }
    return out;
  };

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const allEntries = (name: string, i: number) => {
    const key = `2026-${String(i + 1).padStart(2, "0")}`;
    return fixtures[name].days
      .filter((d: any) => d.date.startsWith(key) && d.site != null)
      .map((d: any) => ({ date: d.date, site: d.site, hours: d.hours ?? 0, lead: d.lead, holiday: d.holiday }));
  };

  monthNames.forEach((name, i) => {
    const key = `2026-${String(i + 1).padStart(2, "0")}`;
    const fx = fixtures[name];

    it(`${name}: every day matches the sheet`, () => {
      const diffs: string[] = [];
      for (const d of fx.days) {
        if (!d.date.startsWith(key) || d.site == null) continue;
        const got = computeDay({ date: d.date, site: d.site, hours: d.hours ?? 0, lead: d.lead, holiday: d.holiday }, sites).total;
        if (Math.abs(got - d.total) > 0.005) diffs.push(`${d.date} ${d.site} ${d.hours}h: sheet ${d.total}, engine ${got}`);
      }
      expect(diffs).toEqual([]);
    });

    it(`${name}: monthly gross per payer matches the sheet`, () => {
      const entries = fx.days
        .filter((d: any) => d.date.startsWith(key) && d.site != null)
        .map((d: any) => ({ date: d.date, site: d.site, hours: d.hours ?? 0, lead: d.lead, holiday: d.holiday }));
      for (const e of fx.extra) {
        // [site, date, hours, total, lead, weekend, holiday]
        entries.push({ site: e[0], date: String(e[1]).slice(0, 10), hours: Number(e[2]), lead: e[4] === "True", weekend: e[5] === "True", holiday: e[6] === "True" });
      }
      const result = computeMonth(key, entries, history);
      const grossOf = (p: string) => result.payers.find((x) => x.payer === p)?.gross ?? 0;
      expect(grossOf("main")).toBeCloseTo(fx.gross51 ?? 0, 2);
      expect(grossOf("atlantic")).toBeCloseTo(fx.gross64 ?? 0, 2);
    });
  });

  it("PAYE and NIS match the sheet for a month with income on both payslips", () => {
    const fx = fixtures["July"];
    const t = monthTax(fx.gross64, mondaysInMonth(2026, 7), tax);
    expect(t.paye).toBeCloseTo(fx.paye64, 2);
    expect(t.nis).toBeCloseTo(fx.nis64, 2);
  });

  it("year totals, including payslip corrections, match the Summary sheet", () => {
    const entries = monthNames.flatMap((n, i) => allEntries(n, i));
    let gross = 0, net = 0, paye = 0, nis = 0;
    monthNames.forEach((name, i) => {
      const key = `2026-${String(i + 1).padStart(2, "0")}`;
      const r = computeMonth(key, entries, history, overridesOf(name));
      gross += r.gross; net += r.net; paye += r.paye; nis += r.nis;
    });
    const a = fixtures["_annual"];
    expect(gross).toBeCloseTo(a.gross, 2);
    expect(paye).toBeCloseTo(a.paye, 2);
    expect(net).toBeCloseTo(a.net, 2);
    expect(nis).toBeCloseTo(a.nis, 2);
  });
});
