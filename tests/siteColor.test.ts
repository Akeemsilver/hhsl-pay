import { describe, expect, it } from "vitest";
import { freeColor, usedColors } from "../src/siteColor";
import type { AppData } from "../src/model";

const site = { payer: "main" };
const data = (names: string[], colors: Record<string, number> = {}) => ({
  history: { sites: [{ effectiveFrom: "2000-01-01", value: Object.fromEntries(names.map((n) => [n, site])) }] },
  siteColors: colors,
}) as unknown as AppData;

describe("site colours in use", () => {
  it("lists each colour with the sites that use it", () => {
    const used = usedColors(data(["Atlantic", "PLNL", "Oil Mop"], { plnl: 0 }));
    expect(used.get(0)).toEqual(["Atlantic", "PLNL"]);
    expect(used.get(2)).toEqual(["Oil Mop"]);
  });
  it("leaves out the site being edited", () => {
    expect(usedColors(data(["Atlantic", "PLNL"]), "plnl").has(1)).toBe(false);
  });
  it("offers the first colour nobody uses", () => {
    expect(freeColor(data(["A", "B", "C"]))).toBe(3);
    expect(freeColor(data([], {}))).toBe(0);
  });
});
