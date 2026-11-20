import { describe, expect, it } from "vitest";
import { describeChanges } from "../src/rateEdit";
import { demoSites } from "./support";

describe("rate history lines", () => {
  it("says nothing for the first set of rates", () => {
    expect(describeChanges(undefined, demoSites)).toEqual([]);
  });
  it("names a changed rate with the old and the new amount", () => {
    const after = { ...demoSites, Alpha: { ...demoSites.Alpha!, baseRate: 55, leadRate: 65 } };
    expect(describeChanges(demoSites, after)).toEqual(["Alpha: standard rate $50 to $55; team lead rate $60 to $65"]);
  });
  it("shows cents, and 'none' when a rate was added or cleared", () => {
    const after = { ...demoSites, Beta: { ...demoSites.Beta!, baseRate: 41.5, dailyStd: 900 } };
    expect(describeChanges(demoSites, after)).toEqual(["Beta: standard rate $40 to $41.50; fixed day rate none to $900"]);
  });
  it("notes sites added or removed, and changes to hours or roles", () => {
    const kept = { Alpha: demoSites.Alpha!, Beta: demoSites.Beta! };
    const after = { ...kept, Gamma: { payer: "main", baseRate: 30, weekday: {}, weekend: {}, holiday: {} }, Alpha: { ...demoSites.Alpha!, weekday: { x1: 8 }, roles: { Medic: {} } } };
    const lines = describeChanges(demoSites, after);
    expect(lines).toContain("Gamma added");
    expect(lines).toContain("Rig removed");
    expect(lines.find((l) => l.startsWith("Alpha"))).toBe("Alpha: Medic role added; hours or overtime settings changed");
  });
  it("lists nothing when nothing changed", () => {
    expect(describeChanges(demoSites, structuredClone(demoSites))).toEqual([]);
  });
});
