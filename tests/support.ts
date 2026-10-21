import type { RuleHistory, SiteRates, TaxRules } from "../src/engine";

/** Made-up demo rates, used by the committed unit tests. */
export const demoSites: Record<string, SiteRates> = {
  Alpha: {
    payer: "alpha",
    baseRate: 50,
    leadRate: 60,
    weekday: { x1: 1000 },
    weekend: { x1: 1000 },
    holiday: { x2: 8, x3: 1000 },
  },
  Beta: {
    payer: "main",
    baseRate: 40,
    leadRate: 45,
    weekday: { x1: 8, x15: 4, x2: 1000 },
    weekend: { x15: 12, x2: 1000 },
    holiday: { x2: 1000 },
  },
  Rig: {
    payer: "main",
    showRateAboveHrs: 12,
    rateAboveHrs: 40,
    weekday: { x1: 12, x15: 1000 },
    weekend: { x1: 12, x15: 1000 },
    holiday: { x1: 12, x15: 1000 },
    dailyStd: 1000,
    dailyLead: 1000,
    dailyHoliday: 2000,
  },
};

export const demoTax: TaxRules = {
  monthlyAllowance: 7500,
  rate: 0.25,
  annualThreshold: 90000,
  nisRelief: 0.7,
  nisBands: [
    [0, 0],
    [867, 14.6],
    [1473, 21.3],
    [13600, 169.5],
  ],
  surchargeBands: [
    [0, 0],
    [0.01, 19.2],
    [470, 33],
  ],
  fiveMondayFactor: 1.25,
};

export const demoHistory: RuleHistory = {
  sites: [{ effectiveFrom: "2000-01-01", value: demoSites }],
  tax: [{ effectiveFrom: "2000-01-01", value: demoTax }],
};
