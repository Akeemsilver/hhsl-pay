import { describe, expect, it } from "vitest";
import { kitSummary } from "../src/kitNote";

describe("the note after a starter kit", () => {
  it("says how many sites and groups came in, and whether the form did", () => {
    expect(kitSummary(12, 2, true)).toBe("12 sites in 2 payslip groups, and the timesheet form");
    expect(kitSummary(1, 1, false)).toBe("1 site in 1 payslip group");
  });
});
