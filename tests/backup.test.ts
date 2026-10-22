import { describe, expect, it } from "vitest";
import { BadBackup, PasswordRequired, isEncrypted, parse, serialize } from "../src/backup";
import { newData } from "../src/model";

const sample = () => {
  const data = newData();
  data.entries.push({ id: "a1", date: "2026-07-01", site: "Alpha", hours: 12, lead: true });
  return data;
};

describe("backup", () => {
  it("round-trips an unencrypted full backup", async () => {
    const text = await serialize("full", sample());
    expect(isEncrypted(text)).toBe(false);
    const parsed = await parse(text);
    expect(parsed.kind).toBe("full");
    expect(parsed.data?.entries).toEqual(sample().entries);
  });

  it("round-trips an encrypted backup and needs the right password", async () => {
    const text = await serialize("full", sample(), "s3cret!");
    expect(isEncrypted(text)).toBe(true);
    expect(text).not.toContain("Alpha");
    await expect(parse(text)).rejects.toBeInstanceOf(PasswordRequired);
    await expect(parse(text, "wrong")).rejects.toBeInstanceOf(BadBackup);
    const parsed = await parse(text, "s3cret!");
    expect(parsed.data?.entries[0]?.site).toBe("Alpha");
  });

  it("exports and imports a rates-only file", async () => {
    const history = sample().history;
    const parsed = await parse(await serialize("rates", history));
    expect(parsed.kind).toBe("rates");
    expect(parsed.history).toEqual(history);
  });

  it("rejects files that are not backups", async () => {
    await expect(parse("not json")).rejects.toBeInstanceOf(BadBackup);
    await expect(parse(JSON.stringify({ app: "other", format: 1 }))).rejects.toBeInstanceOf(BadBackup);
    const broken = JSON.stringify({ app: "hhsl-salary-tracker", format: 1, kind: "full", payload: { version: 1 } });
    await expect(parse(broken)).rejects.toBeInstanceOf(BadBackup);
  });
});

describe("starter kit (rates file)", () => {
  it("carries rates, groups and timesheet rules and applies them without touching days or name", async () => {
    const { ratesKitOf, applyKit, serialize, parse } = await import("../src/backup");
    const { newData } = await import("../src/model");
    const source = newData();
    source.payerNames = { main: "Point Lisas / other", atlantic: "Atlantic LNG" };
    source.timesheet = { name: "Someone", siteLabel: "ERT Offsite", rules: [{ site: "A", label: "A" }] };
    const parsed = await parse(await serialize("rates", ratesKitOf(source)));
    expect(parsed.kind).toBe("rates");
    const target = { ...newData(), userName: "Me", entries: [{ id: "1", date: "2026-10-01", site: "A", hours: 1 }] };
    const out = applyKit(target, parsed.kit!);
    expect(out.payerNames.atlantic).toBe("Atlantic LNG");
    expect(out.timesheet?.rules).toHaveLength(1);
    expect(out.timesheet?.name).toBe("");
    expect(out.userName).toBe("Me");
    expect(out.entries).toHaveLength(1);
  });
});
