import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { applyAnnual, guessAnnualAssignment, parseAnnual, withSheetSites } from "../src/annualImport";
import { newData } from "../src/model";
import { demoSites, demoTax } from "./support";

const serial = (iso: string) => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8)) - Date.UTC(1899, 11, 30)) / 86_400_000);
const cell = (row: number, col: number, v: string | number | boolean) => {
  let c = col, letters = "";
  while (c > 0) { letters = String.fromCharCode(65 + ((c - 1) % 26)) + letters; c = Math.floor((c - 1) / 26); }
  const ref = `${letters}${row}`;
  return typeof v === "string" ? `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>` : typeof v === "boolean" ? `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>` : `<c r="${ref}"><v>${v}</v></c>`;
};

/** A month tab with the weekly calendar layout: each day block is 5 columns wide, each week 12 rows tall. */
async function workbook(month: number, days: Array<{ date: string; site: string; hours: number; lead?: boolean; holiday?: boolean }>, year = 2026, settings: Array<Array<string | number>> = []) {
  const zip = new JSZip();
  const cells: string[] = [cell(4, 9, year), cell(1, 2, "Created by Test Person ")];
  const first = new Date(Date.UTC(year, month - 1, 1)); first.setUTCDate(1 - first.getUTCDay());
  for (let w = 0; w < 6; w++) for (let d = 0; d < 7; d++) {
    const dt = new Date(first); dt.setUTCDate(first.getUTCDate() + w * 7 + d);
    const iso = dt.toISOString().slice(0, 10);
    const row = 7 + w * 12, col = 2 + d * 5;
    cells.push(cell(row, col, serial(iso)));
    const job = days.find((x) => x.date === iso);
    cells.push(cell(row + 2, col, job?.site ?? "All sites"));
    if (job) { cells.push(cell(row + 2, col + 2, job.hours), cell(row + 3, col + 1, !!job.lead), cell(row + 4, col + 1, !!job.holiday)); }
  }
  const rowsXml = `<row r="1">${cells.join("")}</row>`;
  zip.file("xl/workbook.xml", `<workbook><sheets><sheet name="DATA" sheetId="1" r:id="rId1"/><sheet name="${["January","February","March","April","May","June","July","August","September","October","November","December"][month - 1]}" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", "<worksheet/>");
  if (settings.length) {
    zip.file("xl/workbook.xml", `<workbook><sheets><sheet name="Settings" sheetId="1" r:id="rId1"/><sheet name="${["January","February","March","April","May","June","July","August","September","October","November","December"][month - 1]}" sheetId="2" r:id="rId2"/></sheets></workbook>`);
    const rows = settings.map((r, i) => `<row r="${5 + i}">${r.map((v, c) => (v === "" ? "" : cell(5 + i, c + 1, v))).join("")}</row>`).join("");
    zip.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData>${rows}</sheetData></worksheet>`);
  }
  zip.file("xl/worksheets/sheet2.xml", `<worksheet><sheetData>${rowsXml}</sheetData></worksheet>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("yearly spreadsheet import", () => {
  it("reads days, hours, lead and holiday flags, ignoring neighbouring months", async () => {
    const sheet = await parseAnnual(await workbook(10, [
      { date: "2026-10-01", site: "TGU", hours: 12 },
      { date: "2026-10-09", site: "Atlantic", hours: 12, lead: true, holiday: true },
      { date: "2026-09-30", site: "TGU", hours: 5 },
    ]));
    expect(sheet.year).toBe(2026);
    expect(sheet.name).toBe("Test Person");
    expect(sheet.days).toEqual([
      { date: "2026-10-01", client: "TGU", hours: 12, lead: false, holiday: false, total: 0 },
      { date: "2026-10-09", client: "Atlantic", hours: 12, lead: true, holiday: true, total: 0 },
    ]);
  });
  it("rejects other workbooks", async () => {
    const zip = new JSZip(); zip.file("xl/workbook.xml", `<workbook><sheets><sheet name="Sheet1" r:id="rId1"/></sheets></workbook>`); zip.file("xl/_rels/workbook.xml.rels", "<Relationships/>");
    await expect(parseAnnual(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(/January to December/);
  });
  it("adds or replaces by month, and understands the old HHSL Yard name", async () => {
    const sheet = await parseAnnual(await workbook(10, [{ date: "2026-10-01", site: "Alpha", hours: 12 }, { date: "2026-10-02", site: "HHSL Yard", hours: 0 }].map((d) => ({ ...d, hours: d.site === "Alpha" ? 12 : 8 }))));
    const d = newData();
    d.history = { sites: [{ effectiveFrom: "2000-01-01", value: { ...demoSites, "HHSL Compound": demoSites.Alpha! } }], tax: [{ effectiveFrom: "2000-01-01", value: demoTax }] };
    d.entries = [{ id: "1", date: "2026-10-01", site: "Alpha", hours: 10 }, { id: "2", date: "2026-09-02", site: "Alpha", hours: 12 }];
    const assign = Object.fromEntries([...new Set(sheet.days.map((x) => x.client))].map((c) => [c, guessAnnualAssignment(c, d)]));
    expect(assign["HHSL Yard"]).toEqual({ site: "HHSL Compound", role: undefined });
    const add = applyAnnual(d, sheet, assign, "add");
    expect(add.added).toBe(1); expect(add.skipped).toBe(1);
    const rep = applyAnnual(d, sheet, assign, "replace");
    expect(rep.removed).toBe(1); expect(rep.added).toBe(2);
    expect(rep.data.entries.map((e) => e.date)).toEqual(["2026-09-02", "2026-10-01", "2026-10-02"]);
  });
});

describe("sites and rates from the Settings tab", () => {
  const settings = [["All sites"], ["Atlantic", 69.09, 79.09, "", "", 1000, "", "", "", "", 8, 1000, 1000], ["TGU", 60, 65, "", "", 8, 4, 1000, "", "", 1000, "", "", 12, 1000], ["Hhsl Yard", "", "", "", "", "", "", "", "", "", "", "", "", "", "", 500, 700]];
  it("reads each site's rates and hours, naming the yard HHSL Compound", async () => {
    const sheet = await parseAnnual(await workbook(10, [{ date: "2026-10-01", site: "TGU", hours: 12 }], 2026, settings));
    expect(sheet.sites.map((s) => s.name)).toEqual(["Atlantic", "TGU", "HHSL Compound"]);
    const tgu = sheet.sites.find((s) => s.name === "TGU")!.rates;
    expect(tgu).toMatchObject({ payer: "main", baseRate: 60, leadRate: 65, weekday: { x1: 8, x15: 4, x2: 1000 }, weekend: { x15: 12, x2: 1000 } });
    expect(sheet.sites[0]!.rates.payer).toBe("atlantic");
    expect(sheet.sites[2]!.rates).toMatchObject({ dailyStd: 500, dailyLead: 700 });
  });
  it("adds only the sites a new app lacks, keeping existing ones", async () => {
    const sheet = await parseAnnual(await workbook(10, [{ date: "2026-10-01", site: "TGU", hours: 12 }], 2026, settings));
    const fresh = newData();
    const plan = withSheetSites(fresh, sheet);
    expect(plan.added).toEqual(["Atlantic", "TGU", "HHSL Compound"]);
    expect(plan.data.payerNames).toMatchObject({ main: "Point Lisas / other", atlantic: "Atlantic LNG" });
    const again = withSheetSites({ ...plan.data, history: { ...plan.data.history, sites: plan.data.history.sites.map((v) => ({ ...v, value: { ...v.value, TGU: { ...v.value.TGU!, baseRate: 99 } } })) } }, sheet);
    expect(again.added).toEqual([]);
    expect(again.data.history.sites[0]!.value.TGU!.baseRate).toBe(99);
  });
});

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The monthly spreadsheet: one "List1" tab, month and year in the header, dates written as text, money as text, first week on row 6. */
async function monthlyWorkbook(month: number, year: number, days: Array<{ date: string; site: string; hours?: number; total: string }>, tab = "List1") {
  const zip = new JSZip();
  const cells: string[] = [cell(1, 2, "Created by Test Person "), cell(2, 18, MONTH_NAMES[month - 1]!.toUpperCase()), cell(3, 18, year)];
  const first = new Date(Date.UTC(year, month - 1, 1)); first.setUTCDate(1 - first.getUTCDay());
  for (let w = 0; w < 6; w++) for (let d = 0; d < 7; d++) {
    const dt = new Date(first); dt.setUTCDate(first.getUTCDate() + w * 7 + d);
    const iso = dt.toISOString().slice(0, 10);
    const row = 6 + w * 12, col = 2 + d * 5;
    cells.push(cell(row, col, `${MONTH_NAMES[dt.getUTCMonth()]}, ${dt.getUTCDate()}`));
    const job = days.find((x) => x.date === iso);
    cells.push(cell(row + 2, col, job?.site ?? "All Sites"));
    if (job) { if (job.hours) cells.push(cell(row + 2, col + 2, job.hours)); cells.push(cell(row + 2, col + 3, job.total), cell(row + 3, col + 1, false), cell(row + 4, col + 1, false)); }
  }
  zip.file("xl/workbook.xml", `<workbook><sheets><sheet name="${tab}" sheetId="1" r:id="rId1"/><sheet name="DATA" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData><row r="1">${cells.join("")}</row></sheetData></worksheet>`);
  zip.file("xl/worksheets/sheet2.xml", `<worksheet><sheetData><row r="1">${cell(1, 1, "JANUARY")}${cell(1, 2, 1)}</row></sheetData></worksheet>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("monthly spreadsheet import", () => {
  it("reads the single calendar tab: text dates, money as text, flat-pay days, neighbouring months ignored", async () => {
    const sheet = await parseAnnual(await monthlyWorkbook(9, 2026, [
      { date: "2026-09-03", site: "Alpha", hours: 10, total: " $ 600.00 " },
      { date: "2026-09-15", site: "Offshore", total: " $ 1,000.00 " },
      { date: "2026-08-31", site: "Alpha", hours: 4, total: " $ 240.00 " },
      { date: "2026-10-01", site: "Alpha", hours: 4, total: " $ 240.00 " },
    ]));
    expect(sheet.year).toBe(2026);
    expect(sheet.name).toBe("Test Person");
    expect(sheet.days).toEqual([
      { date: "2026-09-03", client: "Alpha", hours: 10, lead: false, holiday: false, total: 600 },
      { date: "2026-09-15", client: "Offshore", hours: 0, lead: false, holiday: false, total: 1000 },
    ]);
  });
  it("reads it the same when its tab is named after the month", async () => {
    const sheet = await parseAnnual(await monthlyWorkbook(9, 2026, [{ date: "2026-09-03", site: "Alpha", hours: 10, total: " $ 600.00 " }], "September"));
    expect(sheet.days).toEqual([{ date: "2026-09-03", client: "Alpha", hours: 10, lead: false, holiday: false, total: 600 }]);
    expect(sheet.year).toBe(2026);
  });
  it("adding several months one after another keeps the earlier months", async () => {
    let d = newData();
    d.history = { sites: [{ effectiveFrom: "2000-01-01", value: demoSites }], tax: [{ effectiveFrom: "2000-01-01", value: demoTax }] };
    const site = "Alpha";
    for (const [month, date] of [[8, "2026-08-04"], [9, "2026-09-03"], [10, "2026-10-06"]] as const) {
      const sheet = await parseAnnual(await monthlyWorkbook(month, 2026, [{ date, site, hours: 8, total: " $ 100.00 " }]));
      d = applyAnnual(d, sheet, { [site]: { site } }, "replace").data;
    }
    expect(d.entries.map((e) => e.date)).toEqual(["2026-08-04", "2026-09-03", "2026-10-06"]);
  });
});
