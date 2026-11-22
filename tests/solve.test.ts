import { describe, expect, it } from "vitest";
import { monthTax, solvePay } from "../src/engine";
import { demoTax } from "./support";

const rules = demoTax;
const close = (a: number, b: number, d = 0.02) => Math.abs(a - b) <= d;

describe("working backwards from a net or a PAYE", () => {
  it("a gross gives the whole payslip, as the app already works it out", () => {
    const s = solvePay("gross", 5000, 4, rules)!;
    expect(s.tax).toEqual(monthTax(5000, 4, rules));
  });

  it("finds the gross for a net, for 4 and 5 Monday months, and the figures add up", () => {
    for (const mondays of [4, 5]) {
      for (const gross of [900, 1500, 2600, 5000, 7500, 10000, 13000, 20000]) {
        const net = monthTax(gross, mondays, rules).net;
        const s = solvePay("net", Math.round(net * 100) / 100, mondays, rules)!;
        expect(s, `net of ${gross}`).not.toBeNull();
        const t = s.tax;
        expect(close(t.net, net)).toBe(true);
        expect(close(t.gross - t.paye - t.nis - t.surcharge, t.net, 0.001)).toBe(true);
        // the gross that was started from is the answer (or the other one, if two grosses give this net)
        expect([s.tax.gross, ...s.others].some((g) => close(g, gross, 0.011))).toBe(true);
      }
    }
  });

  it("a 5 Monday month needs a higher gross for the same net (NIS and surcharge are bigger)", () => {
    const four = solvePay("net", 10000, 4, rules)!.tax.gross;
    const five = solvePay("net", 10000, 5, rules)!.tax.gross;
    expect(five).toBeGreaterThan(four);
  });

  it("finds the gross for a PAYE", () => {
    for (const gross of [4000, 7500, 12000, 20000]) {
      const paye = monthTax(gross, 4, rules).paye;
      const s = solvePay("paye", Math.round(paye * 100) / 100, 4, rules)!;
      expect(s).not.toBeNull();
      expect(close(s.tax.paye, paye)).toBe(true);
    }
  });

  it("a PAYE of zero means the highest gross that pays none", () => {
    const s = solvePay("paye", 0, 4, rules)!;
    expect(s.zeroPaye).toBe(true);
    expect(s.tax.paye).toBe(0);
    expect(monthTax(s.tax.gross + 1, 4, rules).paye).toBeGreaterThan(0);
  });

  it("returns nothing when no gross gives that figure", () => {
    expect(solvePay("net", -5, 4, rules)).toBeNull();
    expect(solvePay("net", Number.NaN, 4, rules)).toBeNull();
    expect(solvePay("gross", 0, 4, rules)).toBeNull();
  });
});
