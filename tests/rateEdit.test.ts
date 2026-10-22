import { describe, expect, it } from "vitest";
import { applyFrom, changeGroup, commonValue, diffSite, groupSites, patchSite } from "../src/rateEdit";
import { computeDay, valueOn, type Dated, type SiteTable } from "../src/engine";

const site = (payer: string, baseRate?: number, extra = {}) => ({ payer, baseRate, leadRate: baseRate ? baseRate + 5 : undefined, weekday: { x1: 12 }, weekend: {}, holiday: {}, ...extra });
const table = (): SiteTable => ({
  A: site("pl", 60), B: site("pl", 60), Flat: site("pl", undefined, { dailyStd: 500 }), Off: site("pl", 80, { showRateAboveHrs: 12, rateAboveHrs: 90 }), Atl: site("atl", 69),
});
const v0 = (): Array<Dated<SiteTable>> => [{ effectiveFrom: "2000-01-01", value: table() }];

describe("rate changes take effect from a date", () => {
  it("starts a new version and leaves earlier days alone", () => {
    const list = applyFrom(v0(), "2026-09-01", (t) => changeGroup(t, "pl", { baseRate: 65 }));
    expect(list).toHaveLength(2);
    expect(valueOn(list, "2026-08-31").A!.baseRate).toBe(60);
    expect(valueOn(list, "2026-09-01").A!.baseRate).toBe(65);
  });
  it("only changes hourly sites in the group, never Atlantic", () => {
    const g = groupSites(table(), "pl");
    expect(g.change).toEqual(["A", "B"]);
    expect(g.skip).toEqual(["Flat", "Off"]);
    const t = changeGroup(table(), "pl", { baseRate: 70, leadRate: 75 });
    expect(t.A).toMatchObject({ baseRate: 70, leadRate: 75 });
    expect(t.Flat!.baseRate).toBeUndefined();
    expect(t.Off!.baseRate).toBe(80);
    expect(t.Atl!.baseRate).toBe(69);
  });
  it("a change also reaches later versions, and a backdated one reprices those days", () => {
    let list = applyFrom(v0(), "2026-10-01", (t) => changeGroup(t, "pl", { baseRate: 62 }));
    list = applyFrom(list, "2026-08-01", (t) => changeGroup(t, "pl", { leadRate: 99 }));
    expect(valueOn(list, "2026-07-31").A!.leadRate).toBe(65);
    expect(valueOn(list, "2026-08-15").A!.leadRate).toBe(99);
    expect(valueOn(list, "2026-10-05").A).toMatchObject({ baseRate: 62, leadRate: 99 });
    const pay = computeDay({ date: "2026-08-10", site: "A", hours: 12 }, valueOn(list, "2026-08-10"));
    expect(pay.rate).toBe(60);
  });
  it("a date at the start changes everything", () => {
    const list = applyFrom(v0(), "2000-01-01", (t) => changeGroup(t, "pl", { baseRate: 61 }));
    expect(list).toHaveLength(1);
    expect(list[0]!.value.A!.baseRate).toBe(61);
  });
  it("saves just the changed settings of one site", () => {
    const saved = table().A!;
    const draft = { ...saved, weekday: { x1: 8, x15: 4 } };
    const patch = diffSite(saved, draft);
    expect(Object.keys(patch)).toEqual(["weekday"]);
    const list = applyFrom(v0(), "2026-11-01", (t) => patchSite(t, "A", patch, draft));
    expect(valueOn(list, "2026-10-31").A!.weekday).toEqual({ x1: 12 });
    expect(valueOn(list, "2026-11-01").A!.weekday).toEqual({ x1: 8, x15: 4 });
    expect(valueOn(list, "2026-11-01").B!.weekday).toEqual({ x1: 12 });
  });
  it("finds the value most sites share", () => {
    expect(commonValue([60, 60, 65])).toBe(60);
    expect(commonValue([])).toBeUndefined();
  });
});

describe("tax rules take effect from a date too", () => {
  it("changes a band from a chosen date and leaves earlier months alone", async () => {
    const { demoTax } = await import("./support");
    const { diffObject } = await import("../src/rateEdit");
    const base = [{ effectiveFrom: "2000-01-01", value: demoTax }];
    const draft = { ...demoTax, nisBands: demoTax.nisBands.map((b, i) => (i === 1 ? [b[0], b[1] + 10] : b)) as typeof demoTax.nisBands };
    const patch = diffObject(demoTax, draft);
    expect(Object.keys(patch)).toEqual(["nisBands"]);
    const list = applyFrom(base, "2027-01-01", (t) => ({ ...t, ...patch }));
    expect(valueOn(list, "2026-12-31").nisBands[1]![1]).toBe(demoTax.nisBands[1]![1]);
    expect(valueOn(list, "2027-01-01").nisBands[1]![1]).toBe(demoTax.nisBands[1]![1] + 10);
  });
});

describe("what a change does to logged days", () => {
  it("counts the days that reprice and the money", async () => {
    const { rateImpact, isFarBack } = await import("../src/rateEdit");
    const entries = [
      { date: "2026-09-10", site: "A", hours: 12 },
      { date: "2026-10-05", site: "A", hours: 12 },
      { date: "2026-10-06", site: "Atl", hours: 12 },
    ];
    const next = applyFrom(v0(), "2026-10-01", (t) => changeGroup(t, "pl", { baseRate: 70 }));
    const imp = rateImpact(entries, v0(), next, "2026-10-01");
    expect(imp.days).toBe(1);
    expect(imp.first).toBe("2026-10-05");
    expect(imp.delta).toBeGreaterThan(0);
    expect(isFarBack("2026-01-01", "2026-10-22", "2026-03-01")).toBe(true);
    expect(isFarBack("2026-10-01", "2026-10-22", "2026-03-01")).toBe(false);
    expect(isFarBack("2026-10-01", "2026-10-22", "2026-10-10")).toBe(true);
    expect(isFarBack("2026-11-01", "2026-10-22", undefined)).toBe(false);
  });
});
describe("templates", () => {
  it("match the sites they came from", async () => {
    const { detectTemplate, applyTemplate, HOURS_TEMPLATES } = await import("../src/templates");
    const s = applyTemplate(site("pl", 60), "overtime");
    expect(s.weekday).toEqual({ x1: 8, x15: 4, x2: 1000 });
    expect(detectTemplate(s)).toBe("overtime");
    expect(detectTemplate(applyTemplate(s, "atlantic"))).toBe("atlantic");
    expect(HOURS_TEMPLATES.map((t) => t.name)).toEqual(["Standard straight time", "Standard overtime", "Atlantic standard"]);
  });
});

describe("leaving sites out of a group change", () => {
  it("skips the excepted sites", () => {
    const t = changeGroup(table(), "pl", { baseRate: 70, except: ["B"] });
    expect(t.A!.baseRate).toBe(70);
    expect(t.B!.baseRate).toBe(60);
    expect(t.Atl!.baseRate).toBe(69);
  });
});
