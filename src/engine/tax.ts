import type { TaxRules } from "./types";

function band(bands: Array<[number, number]>, amount: number): number {
  let result = 0;
  for (const [from, value] of bands) {
    if (amount >= from) result = value;
  }
  return result;
}

export interface MonthTax {
  gross: number;
  nis: number;
  paye: number;
  surcharge: number;
  net: number;
}

/** Tax for one payslip: NIS is the weekly band times the Mondays in the month. */
export function monthTax(gross: number, mondays: number, rules: TaxRules): MonthTax {
  if (!(gross > 0)) return { gross: 0, nis: 0, paye: 0, surcharge: 0, net: 0 };
  const nis = band(rules.nisBands, gross) * mondays;
  const nisRelief = (nis / mondays) * (52 / 12) * rules.nisRelief;
  const paye = Math.max(0, (gross - rules.monthlyAllowance - nisRelief) * rules.rate);
  const surcharge = band(rules.surchargeBands, gross) * (mondays === 5 ? rules.fiveMondayFactor : 1);
  return { gross, nis, paye, surcharge, net: gross - paye - nis - surcharge };
}

/** Year-end estimate: tax due on annual gross above the threshold, versus PAYE already paid. */
export function annualTaxEstimate(
  annualGross: number,
  annualNis: number,
  payeDeducted: number,
  rules: TaxRules,
): { taxDue: number; refund: number } {
  const taxDue =
    annualGross > rules.annualThreshold
      ? Math.max(0, (annualGross - rules.annualThreshold - annualNis * rules.nisRelief) * rules.rate)
      : 0;
  return { taxDue, refund: payeDeducted - taxDue };
}
