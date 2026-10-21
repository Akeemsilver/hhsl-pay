import { describe, expect, it } from "vitest";
import { builtInHolidays, easterSunday, holidaysFor } from "../src/holidays";
import { matchRule } from "../src/timesheet";

describe("holidays", () => {
  it("finds Easter", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });
  it("lists T&T holidays for 2026", () => {
    const d = builtInHolidays(2026).map((h) => h.date);
    for (const x of ["2026-04-03", "2026-04-06", "2026-06-04", "2026-06-19", "2026-08-31", "2026-12-25"]) expect(d).toContain(x);
    // 30 Mar 2026 is a Monday, 1 Jan a Thursday; 24 Sep a Thursday. Nothing falls on Sunday except none
  });
  it("adds Monday when a fixed holiday is on Sunday", () => {
    expect(builtInHolidays(2027).map((h) => h.date)).toContain("2027-08-02");
  });
  it("applies edits", () => {
    const data = { holidays: { added: [{ date: "2026-11-08", name: "Divali" }], removed: ["2026-12-26"] } };
    const l = holidaysFor(2026, data).map((h) => h.date);
    expect(l).toContain("2026-11-08");
    expect(l).not.toContain("2026-12-26");
  });
});

describe("client medic on the timesheet", () => {
  it("is always included, labelled by site", () => {
    const e = { id: "1", date: "2026-10-02", site: "Somewhere", hours: 12, role: "Client medic" } as any;
    expect(matchRule(e, [])?.label).toBe("Somewhere Medic");
    expect(matchRule({ ...e, role: "Paramedic" }, [])).toBeUndefined();
    expect(matchRule(e, [{ site: "Somewhere", role: "Client medic", label: "SW Medic" }])?.label).toBe("SW Medic");
  });
});

