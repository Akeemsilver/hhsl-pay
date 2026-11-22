import { monthTax, type MonthTax } from "./tax";
import type { TaxRules } from "./types";

/** What the person knows about the pay: the gross, the net (what the bank pays) or the PAYE. */
export type Known = "gross" | "net" | "paye";

export interface Solved {
  /** The full set of figures for the gross that was found. */
  tax: MonthTax;
  /** Other gross figures that give the same net or PAYE (the NIS and surcharge bands step up, so a net can be reached twice). */
  others: number[];
  /** For a PAYE of zero: the highest gross that still pays no PAYE. */
  zeroPaye?: boolean;
}

const cents = (n: number) => Math.round(n * 100) / 100;

function bandAt(bands: Array<[number, number]>, amount: number): number {
  let v = 0;
  for (const [from, value] of bands) if (amount >= from) v = value;
  return v;
}

/**
 * Works backwards with the same formulas as monthTax: from a net or a PAYE, which gross gives it. NIS and the health surcharge change
 * in steps with the gross, so the gross is looked for inside each step, where the formula is a straight line. Returns null when no
 * gross gives that figure (for example a net that falls in the gap where a band steps up).
 */
export function solvePay(known: Known, value: number, mondays: number, rules: TaxRules): Solved | null {
  if (!Number.isFinite(value) || value < 0) return null;
  if (known === "gross") return value > 0 ? { tax: monthTax(value, mondays, rules), others: [] } : null;

  const marks = [...new Set([0, ...rules.nisBands.map((b) => b[0]), ...rules.surchargeBands.map((b) => b[0])])].sort((a, b) => a - b);
  const found: number[] = [];
  let zeroBest = -1;
  marks.forEach((from, i) => {
    const to = i + 1 < marks.length ? marks[i + 1]! : Infinity;
    const weeklyNis = bandAt(rules.nisBands, from);
    const nis = weeklyNis * mondays;
    const relief = weeklyNis * (52 / 12) * rules.nisRelief;
    const surcharge = bandAt(rules.surchargeBands, from) * (mondays === 5 ? rules.fiveMondayFactor : 1);
    const free = rules.monthlyAllowance + relief; // gross at which PAYE starts in this step
    const inStep = (g: number) => g >= from && g < to && g > 0;
    if (known === "net") {
      const withPaye = (value + nis + surcharge - free * rules.rate) / (1 - rules.rate);
      if (withPaye > free && inStep(withPaye)) found.push(withPaye);
      const noPaye = value + nis + surcharge;
      if (noPaye <= free && inStep(noPaye)) found.push(noPaye);
    } else if (value > 0) {
      const g = value / rules.rate + free;
      if (inStep(g)) found.push(g);
    } else {
      const g = Math.min(free, Number.isFinite(to) ? to - 0.01 : free);
      if (g >= from && g > 0) zeroBest = Math.max(zeroBest, g);
    }
  });
  if (known === "paye" && value === 0) {
    if (zeroBest <= 0) return null;
    return { tax: monthTax(cents(zeroBest), mondays, rules), others: [], zeroPaye: true };
  }
  // Check each candidate against the real formula, so rounding never gives a wrong answer.
  const target = value;
  const good = [...new Set(found.map(cents))]
    .filter((g) => Math.abs((known === "net" ? monthTax(g, mondays, rules).net : monthTax(g, mondays, rules).paye) - target) < 0.02)
    .sort((a, b) => a - b);
  if (good.length === 0) return null;
  return { tax: monthTax(good[0]!, mondays, rules), others: good.slice(1) };
}
