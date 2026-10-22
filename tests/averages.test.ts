import { describe, expect, it } from "vitest";
import { averageThrough, throughLabel } from "../src/averages";

describe("average a month, counted from January", () => {
  it("fixes each month's average at what was known then", () => {
    const gross = [1000, 1000, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(averageThrough(gross, 0)).toBe(1000);
    expect(averageThrough(gross, 1)).toBe(1000);
    expect(averageThrough(gross, 2)).toBe(4000);
    // later months do not move the earlier ones
    const later = [...gross]; later[3] = 5000;
    expect(averageThrough(later, 1)).toBe(1000);
    expect(averageThrough(later, 2)).toBe(4000);
    expect(averageThrough(later, 3)).toBe(4250);
  });

  it("counts a month with no income, as the yearly spreadsheet does", () => {
    // Jan $5,385; Feb $3,480: average through Feb = $4,432.50 (the sheet's "Average Gross")
    expect(averageThrough([5385, 3480], 1)).toBe(4432.5);
    expect(averageThrough([6000, 0, 3000], 2)).toBe(3000);
  });

  it("labels the span", () => {
    expect(throughLabel(0)).toBe("Jan");
    expect(throughLabel(2)).toBe("Jan–Mar");
    expect(throughLabel(11)).toBe("Jan–Dec");
  });
});
