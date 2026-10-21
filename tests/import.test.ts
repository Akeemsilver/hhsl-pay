import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { applyTimesheet, guessAssignment, parseTimesheet, rowToEntry } from "../src/timesheetImport";
import { newData } from "../src/model";
import { demoSites, demoTax } from "./support";

const cell = (r: string, v: string | number) => (typeof v === "number" ? `<c r="${r}"><v>${v}</v></c>` : `<c r="${r}" t="inlineStr"><is><t>${v}</t></is></c>`);

async function sheet(rows: Array<[number, Array<[string, string | number]>]>, month = "MONTH: OCTOBER") {
  const zip = new JSZip();
  const body = [
    cell("F6", "E.R.T.'S NAME (BLOCK LETTERS):  TEST PERSON"), cell("F10", "SITE: ERT Offsite"), cell("F11", month), cell("J11", "YEAR-2026"),
    cell("B11", "TIME SHEET "), cell("J12", "CLIENT ASSIGNED"),
    ...rows.flatMap(([r, cs]) => cs.map(([c, v]) => cell(`${c}${r}`, v))),
  ].join("");
  zip.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData><row r="1">${body}</row></sheetData></worksheet>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("time sheet import", () => {
  it("reads name, month, times and hours", async () => {
    const t = await parseTimesheet(await sheet([
      [34, [["D", 1 / 3], ["E", 0.6875], ["F", 8], ["J", "HHSL Compound"]]],
      [35, [["F", 8], ["G", 2], ["J", "PLNL Medic"]]],
    ]));
    expect(t.month).toBe("2026-10");
    expect(t.name).toBe("TEST PERSON");
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toMatchObject({ date: "2026-10-21", onDuty: "08:00", offDuty: "16:30", client: "HHSL Compound" });
    expect(t.rows[1]!.hours).toEqual({ t: 8, t15: 2, t2: 0, t3: 0 });
  });
  it("rejects other files", async () => {
    const zip = new JSZip(); zip.file("xl/worksheets/sheet1.xml", "<worksheet/>");
    await expect(parseTimesheet(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(/HHSL time sheet/);
  });
  it("works lunch out from the times and hours", () => {
    const e = rowToEntry({ date: "2026-10-21", onDuty: "08:00", offDuty: "16:30", hours: { t: 8, t15: 0, t2: 0, t3: 0 }, client: "x" }, { site: "Alpha" });
    expect(e).toMatchObject({ hours: 8, detailed: true, lunchPaid: false, lunchMinutes: 30 });
    const f = rowToEntry({ date: "2026-10-21", hours: { t: 8, t15: 2, t2: 0, t3: 0 }, client: "x" }, { site: "Alpha", role: "Client medic" });
    expect(f).toMatchObject({ hours: 10, role: "Client medic" });
    expect(f.detailed).toBeUndefined();
  });
  it("matches clients to sites, rules and medic labels", () => {
    const d = newData();
    d.history = { sites: [{ effectiveFrom: "2000-01-01", value: demoSites }], tax: [{ effectiveFrom: "2000-01-01", value: demoTax }] };
    d.timesheet = { name: "", siteLabel: "", rules: [{ site: "Beta", label: "Beta Special" }] };
    expect(guessAssignment("beta special", d)).toEqual({ site: "Beta", role: undefined });
    expect(guessAssignment("Alpha", d)).toEqual({ site: "Alpha" });
    expect(guessAssignment("Alpha Medic", d)).toEqual({ site: "Alpha", role: "Client medic" });
    expect(guessAssignment("Nowhere", d)).toBeUndefined();
  });
  it("adds without duplicating, or replaces the month", async () => {
    const t = await parseTimesheet(await sheet([[34, [["F", 8], ["J", "Alpha"]]], [35, [["F", 8], ["J", "Alpha"]]]]));
    const d = newData();
    d.entries = [{ id: "1", date: "2026-10-21", site: "Alpha", hours: 12 }, { id: "2", date: "2026-09-02", site: "Alpha", hours: 12 }];
    const add = applyTimesheet(d, t, { Alpha: { site: "Alpha" } }, "add");
    expect(add.added).toBe(1); expect(add.skipped).toBe(1); expect(add.data.entries).toHaveLength(3);
    const rep = applyTimesheet(d, t, { Alpha: { site: "Alpha" } }, "replace");
    expect(rep.removed).toBe(1); expect(rep.added).toBe(2);
    expect(rep.data.entries.map((e) => e.date)).toEqual(["2026-09-02", "2026-10-21", "2026-10-22"]);
    expect(rep.data.userName).toBe("TEST PERSON");
  });
});

describe("payroll email", () => {
  it("is addressed with the subject and message written", async () => {
    const { payrollEmail, mailtoLink } = await import("../src/payroll");
    const e = payrollEmail({ to: "payrollassistant@hhslsafety.com", name: "AKEEM SILVERTON", monthName: "October 2026", siteLabel: "ERT Offsite", days: 1, hours: 8, fileName: "HHSL-Time-Sheet.xlsx" });
    expect(e.subject).toBe("Time Sheet - AKEEM SILVERTON - October 2026");
    expect(e.body).toContain("October 2026");
    expect(e.body).toBe("Hello,\n\nAttached is my October 2026 time sheet.\n\nThanks,\nAKEEM SILVERTON");
    const link = mailtoLink(e);
    expect(link.startsWith("mailto:payrollassistant@hhslsafety.com?subject=Time%20Sheet")).toBe(true);
    expect(decodeURIComponent(link.split("body=")[1]!)).toBe(e.body);
  });
});
