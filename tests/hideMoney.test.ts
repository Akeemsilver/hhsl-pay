import { describe, expect, it } from "vitest";
import { findMoney } from "../src/hideMoney";

const found = (t: string) => findMoney(t).map(([a, b]) => t.slice(a, b));

describe("finding money in text", () => {
  it("finds amounts with commas, cents, a minus sign and K", () => {
    expect(found("Gross $10,815.54 and -$12.00, tick $12K, $1.5K, $820")).toEqual(["$10,815.54", "-$12.00", "$12K", "$1.5K", "$820"]);
  });
  it("finds rates and leaves the unit alone", () => {
    expect(found("$60/h · lead $65 · $500/day")).toEqual(["$60", "$65", "$500"]);
  });
  it("ignores hours, days and percentages", () => {
    expect(found("155 h · 14 d · 20.5% of gross · 8-Sep")).toEqual([]);
  });
});
