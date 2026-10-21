import { describe, expect, it } from "vitest";
import { durationText, timeRange } from "../src/format";
import { isOther, othersByDate, type Entry } from "../src/model";

describe("other-job times", () => {
  it("works out the duration between optional times", () => {
    expect(durationText("08:00", "10:30")).toBe("2h 30m");
    expect(durationText("09:15", "09:45")).toBe("30m");
    expect(durationText("22:00", "01:00")).toBe("3h");
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
