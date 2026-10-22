import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildTimesheet, matchRule, type TimesheetRule } from "../src/timesheet";
import { TemplateError, fillTimesheet, timesheetFileName } from "../src/timesheetFile";
import type { Entry } from "../src/model";
import type { RuleHistory } from "../src/engine";
import { demoHistory } from "./support";

const history: RuleHistory = {
  ...demoHistory,
  sites: [{
    effectiveFrom: "2000-01-01",
    value: {
      "HHSL Compound": { payer: "main", weekday: {}, weekend: {}, holiday: {}, dailyStd: 500, dailyLead: 700 },
      PLNL: {
        payer: "main", baseRate: 60, leadRate: 65, weekday: { x1: 8, x15: 4, x2: 1000 }, weekend: { x15: 12, x2: 1000 }, holiday: { x2: 1000 },
        roles: { "Client medic": { rate: 75 } },
      },
      Atlantic: { payer: "atlantic", baseRate: 69, weekday: { x1: 1000 }, weekend: { x1: 1000 }, holiday: { x2: 8, x3: 1000 } },
    },
  }],
};
const rules: TimesheetRule[] = [
  { site: "HHSL Compound", label: "HHSL Compound" },
  { site: "PLNL", role: "Client medic", label: "PLNL Medic" },
];
const e = (id: string, date: string, site: string, extra: Partial<Entry> = {}): Entry => ({ id, date, site, hours: 8, ...extra });

describe("which jobs go on the timesheet", () => {
  it("includes HHSL Compound (any role) and PLNL only as client medic", () => {
    const entries = [
      e("1", "2026-10-21", "HHSL Compound", { startTime: "08:00", endTime: "16:30" }),
      e("2", "2026-10-22", "PLNL", { role: "Client medic", startTime: "07:00", endTime: "19:00", hours: 11 }),
      e("3", "2026-10-23", "PLNL"),
      e("4", "2026-10-24", "Atlantic"),
      e("5", "2026-10-25", "HHSL Compound", { lead: true, startTime: "08:00", endTime: "16:00" }),
    ];
    const { rows } = buildTimesheet("2026-10", entries, history, rules);
    expect(rows.map((r) => r.date)).toEqual(["2026-10-21", "2026-10-22", "2026-10-25"]);
    expect(rows.map((r) => r.client)).toEqual(["HHSL Compound", "PLNL Medic", "HHSL Compound"]);
  });

  it("ignores other months and unmatched sites", () => {
    const entries: Entry[] = [
      e("2", "2026-09-30", "HHSL Compound"),
      e("3", "2026-11-01", "HHSL Compound"),
    ];
    expect(buildTimesheet("2026-10", entries, history, rules).rows).toEqual([]);
  });

  it("puts other jobs on the timesheet with the description in the client column and hours from their times", () => {
    const entries: Entry[] = [{ id: "1", date: "2026-10-05", kind: "other", site: "", hours: 0, description: "Airport pickup", startTime: "08:00", endTime: "10:30" }];
    const rows = buildTimesheet("2026-10", entries, history, rules).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ client: "Airport pickup", onDuty: "08:00", offDuty: "10:30", hours: { t: 2.5, t15: 0, t2: 0, t3: 0 } });
  });

  it("matches site and role names without caring about case", () => {
    expect(matchRule(e("1", "2026-10-22", "plnl", { role: "client MEDIC" }), rules)?.label).toBe("PLNL Medic");
    expect(matchRule(e("1", "2026-10-22", "plnl"), rules)).toBeUndefined();
  });

  it("a specific role rule beats an any-role rule for the same site", () => {
    const both: TimesheetRule[] = [{ site: "PLNL", label: "PLNL" }, { site: "PLNL", role: "Client medic", label: "PLNL Medic" }];
    expect(matchRule(e("1", "2026-10-22", "PLNL", { role: "Client medic" }), both)?.label).toBe("PLNL Medic");
    expect(matchRule(e("1", "2026-10-22", "PLNL"), both)?.label).toBe("PLNL");
  });
});

describe("hours columns", () => {
  it("puts all paid hours in T for a flat-pay site with no overtime caps", () => {
    const { rows } = buildTimesheet("2026-10", [e("1", "2026-10-21", "HHSL Compound", { hours: 8 })], history, rules);
    expect(rows[0]?.hours).toEqual({ t: 8, t15: 0, t2: 0, t3: 0 });
  });

  it("splits into T, Tx1.5, Tx2 using the site's caps", () => {
    // PLNL weekday caps: 8 at x1, 4 at x1.5, rest x2. Wed 21 Oct 2026 is a weekday.
    const entries = [e("1", "2026-10-21", "PLNL", { role: "Client medic", hours: 14 })];
    const { rows } = buildTimesheet("2026-10", entries, history, rules);
    expect(rows[0]?.hours).toEqual({ t: 8, t15: 4, t2: 2, t3: 0 });
  });

  it("holiday hours land in Tx2 and Tx3 for a site with holiday caps", () => {
    const hol: TimesheetRule[] = [{ site: "Atlantic", label: "Atlantic" }];
    const { rows } = buildTimesheet("2026-10", [e("1", "2026-10-21", "Atlantic", { hours: 12, holiday: true })], history, hol);
    expect(rows[0]?.hours).toEqual({ t: 0, t15: 0, t2: 8, t3: 4 });
  });
});

describe("warnings and shared days", () => {
  it("warns about missing times and combines two jobs on one day", () => {
    const entries = [
      e("1", "2026-10-21", "HHSL Compound", { hours: 8 }),
      e("2", "2026-10-21", "PLNL", { role: "Client medic", hours: 4, startTime: "18:00", endTime: "22:00" }),
    ];
    const { rows, warnings } = buildTimesheet("2026-10", entries, history, rules);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.client).toBe("HHSL Compound / PLNL Medic");
    expect(rows[0]?.hours.t).toBe(12);
    expect(warnings.some((w) => w.includes("21 Oct") && w.includes("missing"))).toBe(true);
    expect(warnings.some((w) => w.includes("share one row"))).toBe(true);
  });
});

/** A tiny stand-in with the same cell layout as the HHSL template (rows 6, 10-11, 14-44, 46-48). */
async function miniTemplate(): Promise<Uint8Array> {
  const cell = (ref: string, s: number, extra = "") => `<c r="${ref}" s="${s}"${extra}/>`;
  const rows: string[] = [];
  rows.push(`<row r="6"><c r="F6" s="11" t="inlineStr"><is><t>E.R.T.'S NAME (BLOCK LETTERS):  OLD</t></is></c></row>`);
  rows.push(`<row r="10"><c r="F10" s="24" t="inlineStr"><is><t>SITE: x</t></is></c></row>`);
  rows.push(`<row r="11"><c r="F11" s="28" t="inlineStr"><is><t>MONTH: JULY</t></is></c><c r="J11" s="29" t="inlineStr"><is><t>YEAR-2020</t></is></c></row>`);
  rows.push(`<row r="12"><c r="B12" s="30" t="inlineStr"><is><t>TIME SHEET</t></is></c><c r="J12" s="34" t="inlineStr"><is><t>CLIENT ASSIGNED</t></is></c><c r="K12" s="35" t="inlineStr"><is><t>JOB TICKET NUMBER</t></is></c></row>`);
  for (let r = 14; r <= 44; r++) {
    rows.push(`<row r="${r}">${["B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].map((c) => cell(`${c}${r}`, 40 + (c.charCodeAt(0) % 5))).join("")}</row>`);
  }
  rows.push(`<row r="46"><c r="F46" s="70"><f>SUM(F14:F44)</f><v>0</v></c><c r="G46" s="70"><f>SUM(G14:G44)</f><v>0</v></c><c r="H46" s="70"><f>SUM(H14:H44)</f><v>0</v></c><c r="I46" s="70"><f>SUM(I14:I44)</f><v>0</v></c></row>`);
  rows.push(`<row r="47"><c r="F47" s="72"><f>+F46*1</f><v>0</v></c><c r="G47" s="73"><f>+G46*1.5</f><v>0</v></c><c r="H47" s="72"><f>+H46*2</f><v>0</v></c><c r="I47" s="72"><f>+I46*3</f><v>0</v></c></row>`);
  rows.push(`<row r="48"><c r="F48" s="76"><f>SUM(F47:I47)</f><v>0</v></c></row>`);
  const zip = new JSZip();
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`);
  zip.file("xl/sharedStrings.xml", `<sst><si><t>TIME SHEET</t></si></sst>`);
  zip.file("xl/media/image1.png", new Uint8Array([1, 2, 3]));
  return zip.generateAsync({ type: "uint8array" });
}

const sheetOf = async (bytes: Uint8Array) => (await (await JSZip.loadAsync(bytes)).file("xl/worksheets/sheet1.xml")!.async("string"));

describe("filling the template", () => {
  const input = {
    name: "akeem silverton", siteLabel: "ERT Offsite", month: "2026-10",
    rows: buildTimesheet("2026-10", [
      e("1", "2026-10-21", "HHSL Compound", { hours: 8, startTime: "08:00", endTime: "16:30" }),
      e("2", "2026-10-22", "PLNL", { role: "Client medic", hours: 14, startTime: "06:00", endTime: "21:00" }),
    ], history, [rules[0]!, { ...rules[1]!, label: "PLNL & Co <Medic>" }]).rows,
  };

  it("writes the header, the day labels, times, hours and client", async () => {
    const xml = await sheetOf(await fillTimesheet(await miniTemplate(), input));
    expect(xml).toContain("E.R.T.&apos;S NAME".replace("&apos;", "'") + " (BLOCK LETTERS):  AKEEM SILVERTON");
    expect(xml).toContain("SITE: ERT Offsite");
    expect(xml).toContain("MONTH: OCTOBER");
    expect(xml).toContain("YEAR-2026");
    // 1 Oct 2026 is a Thursday; 21 Oct a Wednesday
    expect(xml).toMatch(/<c r="B14"[^>]*><is><t[^>]*>1ST<\/t>/);
    expect(xml).toMatch(/<c r="C14"[^>]*><is><t[^>]*>T<\/t>/);
    expect(xml).toMatch(/<c r="B34"[^>]*><is><t[^>]*>21ST<\/t>/);
    expect(xml).toMatch(/<c r="C34"[^>]*><is><t[^>]*>W<\/t>/);
    expect(xml).toMatch(/<c r="D34"[^>]*><v>0\.3333333333333333<\/v>/);
    expect(xml).toMatch(/<c r="E34"[^>]*><v>0\.6875<\/v>/);
    expect(xml).toMatch(/<c r="F34"[^>]*><v>8<\/v>/);
    expect(xml).toMatch(/<c r="J34"[^>]*><is><t[^>]*>HHSL Compound<\/t>/);
    expect(xml).toMatch(/<c r="J35"[^>]*><is><t[^>]*>PLNL &amp; Co &lt;Medic&gt;<\/t>/);
    expect(xml).toMatch(/<c r="K35" s="\d+"\/>/); // job ticket column stays empty
  });

  it("keeps each cell's own style and the logo", async () => {
    const zip = await JSZip.loadAsync(await fillTimesheet(await miniTemplate(), input));
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toMatch(/<c r="D34" s="\d+"><v>/);
    expect(await zip.file("xl/media/image1.png")!.async("uint8array")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("splits overtime into the right columns and refreshes the totals", async () => {
    const xml = await sheetOf(await fillTimesheet(await miniTemplate(), input));
    // 22 Oct: 14 h on PLNL weekday caps -> 8 T, 4 Tx1.5, 2 Tx2
    expect(xml).toMatch(/<c r="F35"[^>]*><v>8<\/v>/);
    expect(xml).toMatch(/<c r="G35"[^>]*><v>4<\/v>/);
    expect(xml).toMatch(/<c r="H35"[^>]*><v>2<\/v>/);
    expect(xml).toMatch(/<c r="F46"[^>]*><f>SUM\(F14:F44\)<\/f><v>16<\/v>/);
    expect(xml).toMatch(/<c r="G47"[^>]*><f>\+G46\*1\.5<\/f><v>6<\/v>/);
    expect(xml).toMatch(/<c r="F48"[^>]*><f>SUM\(F47:I47\)<\/f><v>26<\/v>/); // 16 + 6 + 4
  });

  it("clears days that do not exist in the month", async () => {
    const xml = await sheetOf(await fillTimesheet(await miniTemplate(), { ...input, month: "2026-02", rows: [] }));
    expect(xml).toMatch(/<c r="B41"[^>]*><is><t[^>]*>28TH<\/t>/);
    expect(xml).toMatch(/<c r="B42" s="\d+"\/>/); // 29th
    expect(xml).toMatch(/<c r="C44" s="\d+"\/>/); // 31st
    expect(xml).toContain("MONTH: FEBRUARY");
  });

  it("refuses a file that is not the time sheet", async () => {
    const zip = new JSZip();
    zip.file("xl/worksheets/sheet1.xml", "<worksheet><sheetData/></worksheet>");
    await expect(fillTimesheet(await zip.generateAsync({ type: "uint8array" }), input)).rejects.toBeInstanceOf(TemplateError);
    await expect(fillTimesheet(new Uint8Array([1, 2, 3]), input)).rejects.toBeInstanceOf(TemplateError);
  });

  it("names the file after the person and month", () => {
    expect(timesheetFileName("akeem SILVERTON", "2026-10")).toBe("HHSL-Time-Sheet-Akeem-Silverton-2026-10.xlsx");
    expect(timesheetFileName("", "2026-10")).toBe("HHSL-Time-Sheet-2026-10.xlsx");
  });
});

describe("other jobs on the timesheet can be turned off", () => {
  it("leaves them out when asked", () => {
    const entries: Entry[] = [{ id: "1", date: "2026-10-05", kind: "other", site: "", hours: 0, description: "Pickup", startTime: "08:00", endTime: "09:00" }];
    expect(buildTimesheet("2026-10", entries, history, rules, true).rows).toHaveLength(1);
    expect(buildTimesheet("2026-10", entries, history, rules, false).rows).toHaveLength(0);
  });
});

describe("other job hours", () => {
  it("uses typed hours when there are no times, and shows 'Other job' with no description", () => {
    const entries: Entry[] = [{ id: "1", date: "2026-10-05", kind: "other", site: "", hours: 3.5 }];
    const rows = buildTimesheet("2026-10", entries, history, rules).rows;
    expect(rows[0]).toMatchObject({ client: "Other job", hours: { t: 3.5, t15: 0, t2: 0, t3: 0 } });
  });
});

import { timesheetSummary as _sum } from "../src/timesheet";
describe("timesheetSummary", () => {
  it("reads out whole sites, single roles and what stays off", () => {
    const t = _sum([{ site: "HHSL Compound", label: "HHSL" }, { site: "PLNL", role: "Client medic", label: "PLNL Medic" }], ["HHSL Compound", "PLNL", "Atlantic"], true, false);
    expect(t).toBe("On your timesheet: every day at HHSL Compound; client medic days at PLNL; other jobs. Other work at Atlantic stays off.");
  });
});
