import { describe, expect, it } from "vitest";
import { durationText, timeRange } from "../src/format";
import { isOther, othersByDate, type Entry } from "../src/model";

describe("other-job times", () => {
  it("works out the duration between optional times", () => {
    expect(durationText("08:00", "10:30")).toBe("2 h 30 min");
    expect(durationText("09:15", "09:45")).toBe("30 min");
    expect(durationText("22:00", "01:00")).toBe("3 h");
    expect(durationText("08:00", "09:00")).toBe("1 h");
    expect(durationText("08:00", undefined)).toBe("");
    expect(durationText(undefined, undefined)).toBe("");
    expect(durationText("08:00", "08:00")).toBe("");
  });

  it("describes a partial or full time range", () => {
    expect(timeRange("08:00", "10:30")).toBe("08:00–10:30");
    expect(timeRange("08:00")).toBe("from 08:00");
    expect(timeRange(undefined, "10:30")).toBe("until 10:30");
    expect(timeRange()).toBe("");
  });
});

describe("other jobs", () => {
  const entries: Entry[] = [
    { id: "1", date: "2026-07-01", site: "Alpha", hours: 12 },
    { id: "2", date: "2026-07-01", kind: "other", site: "", hours: 0, description: "Airport pickup" },
    { id: "3", date: "2026-07-03", kind: "other", site: "", hours: 0, description: "Delivery", startTime: "08:00" },
    { id: "4", date: "2026-08-01", kind: "other", site: "", hours: 0, description: "Other month" },
  ];

  it("tells other jobs from shifts", () => {
    expect(entries.map(isOther)).toEqual([false, true, true, true]);
  });

  it("groups a month's other jobs by date", () => {
    const m = othersByDate(entries, "2026-07");
    expect([...m.keys()]).toEqual(["2026-07-01", "2026-07-03"]);
    expect(m.get("2026-07-01")?.[0]?.description).toBe("Airport pickup");
  });
});

import { DEFAULT_ROLES, rolesFor } from "../src/model";

describe("roles", () => {
  it("offers the default roles everywhere, plus any custom ones on the site", () => {
    expect(rolesFor(undefined)).toEqual([...DEFAULT_ROLES]);
    expect(rolesFor({ payer: "main", weekday: {}, weekend: {}, holiday: {}, roles: { Instructor: {}, "client MEDIC": { rate: 70 } } }))
      .toEqual(["Client medic", "Offshore", "Paramedic", "Instructor"]);
  });
});

import { parseHoursInput } from "../src/format";

describe("typing hours", () => {
  it.each([
    ["11.5", 11.5], ["10.5", 10.5], ["9.5", 9.5], ["9,5", 9.5], [".5", 0.5], ["11.", 11], ["11.25", 11.25],
    ["8", 8], ["24", 24], ["0", 0], ["", 0], [".", 0], [" 8 ", 8],
  ])("reads %j as %s", (text, hours) => expect(parseHoursInput(text)).toBe(hours));

  it.each(["25", "30", "abc", "1.234", "-1", "1..5", "11.5h"])("rejects %j", (text) => expect(parseHoursInput(text)).toBeNull());
});
