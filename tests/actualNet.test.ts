import { describe, expect, it } from "vitest";
import { computeMonth } from "../src/engine";
import { demoHistory } from "./support";

const entries = [
  { date: "2026-10-05", site: "Alpha", hours: 12 },
  { date: "2026-10-06", site: "Alpha", hours: 12 },
  { date: "2026-10-07", site: "Alpha", hours: 12 },
];
const calc = computeMonth("2026-10", entries, demoHistory).payers[0]!;

describe("actual net pay", () => {
  it("works out the PAYE taken from the net the bank paid", () => {
    const net = calc.net - 100; // the bank paid $100 less than the estimate
    const p = computeMonth("2026-10", entries, demoHistory, { alpha: { net } }).payers[0]!;
    expect(p.net).toBeCloseTo(net, 2);
    expect(p.paye).toBeCloseTo(calc.paye + 100, 2);
    expect(p.nis).toBe(calc.nis);
    expect(p.surcharge).toBe(calc.surcharge);
    expect(p.corrected).toBe(true);
  });
  it("the net always settles the PAYE, even when a PAYE figure is also typed in", () => {
    const net = calc.net + 50;
    const p = computeMonth("2026-10", entries, demoHistory, { alpha: { net, paye: 1 } }).payers[0]!;
    expect(p.paye).toBeCloseTo(calc.paye - 50, 2);
  });
  it("an actual gross changes the NIS and surcharge first, then the PAYE is what is left", () => {
    const p = computeMonth("2026-10", entries, demoHistory, { alpha: { gross: calc.gross + 500, net: calc.gross + 500 - 400 } }).payers[0]!;
    expect(p.gross).toBe(calc.gross + 500);
    expect(p.paye + p.nis + p.surcharge).toBeCloseTo(400, 2);
  });
  it("keeps the app's own estimate for comparing", () => {
    const p = computeMonth("2026-10", entries, demoHistory, { alpha: { net: calc.net - 100 } }).payers[0]!;
    expect(p.estimate.net).toBeCloseTo(calc.net, 2);
    expect(p.estimate.paye).toBeCloseTo(calc.paye, 2);
  });
  it("leaves a month alone when nothing is typed in", () => {
    expect(calc.corrected).toBe(false);
    expect(calc.estimate.net).toBeCloseTo(calc.net, 2);
  });

  it("the gross never changes when a net or a PAYE is typed", () => {
    expect(computeMonth("2026-10", entries, demoHistory, { alpha: { net: calc.net - 100 } }).payers[0]!.gross).toBe(calc.gross);
    expect(computeMonth("2026-10", entries, demoHistory, { alpha: { paye: calc.paye + 70 } }).payers[0]!.gross).toBe(calc.gross);
  });
  it("an actual PAYE changes the net and nothing else", () => {
    const p = computeMonth("2026-10", entries, demoHistory, { alpha: { paye: calc.paye + 70 } }).payers[0]!;
    expect(p.net).toBeCloseTo(calc.net - 70, 2);
    expect(p.nis).toBe(calc.nis);
    expect(p.surcharge).toBe(calc.surcharge);
  });
  it("an actual gross alone changes the net and the PAYE (and the NIS and surcharge that follow from it)", () => {
    const p = computeMonth("2026-10", entries, demoHistory, { alpha: { gross: 20000 } }).payers[0]!;
    expect(p.gross).toBe(20000);
    expect(p.paye).not.toBe(calc.paye);
    expect(p.net).not.toBeCloseTo(calc.net, 0);
  });
});
