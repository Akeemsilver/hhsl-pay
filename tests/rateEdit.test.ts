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
