import { describe, expect, it } from "vitest";
import { guessAssignment } from "../src/siteMatch";
import { newData } from "../src/model";
import { demoSites, demoTax } from "./support";

describe("matching spreadsheet clients to sites", () => {
  it("matches clients to sites, rules and medic labels", () => {
    const d = newData();
    d.history = { sites: [{ effectiveFrom: "2000-01-01", value: demoSites }], tax: [{ effectiveFrom: "2000-01-01", value: demoTax }] };
    d.timesheet = { name: "", siteLabel: "", rules: [{ site: "Beta", label: "Beta Special" }] };
    expect(guessAssignment("beta special", d)).toEqual({ site: "Beta", role: undefined });
    expect(guessAssignment("Alpha", d)).toEqual({ site: "Alpha" });
    expect(guessAssignment("Alpha Medic", d)).toEqual({ site: "Alpha", role: "Client medic" });
    expect(guessAssignment("Nowhere", d)).toBeUndefined();
  });
});
