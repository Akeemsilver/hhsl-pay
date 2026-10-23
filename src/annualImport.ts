import type { SiteRates } from "./engine";
import { newId, type AppData, type Entry } from "./model";
import { guessAssignment, ImportError, type Assignment } from "./timesheetImport";

/** One day from the yearly salary spreadsheet's month calendar. */
export interface AnnualDay {
  date: string;
  /** The text in the Client Name cell, e.g. "TGU". */
  client: string;
  hours: number;
  lead: boolean;
  holiday: boolean;
  /** Pay shown for the day, so flat-pay days with no hours still count. */
  total: number;
}

/** One row of the spreadsheet's Settings tab: a site and its rates. */
export interface AnnualSite {
  name: string;
  rates: SiteRates;
}

export interface AnnualSheet {
  /** The sites and rates on the Settings tab (empty when the tab is missing). */
  sites: AnnualSite[];
  year: number;
  /** Name from "Created by …", when present. */
  name: string;
  days: AnnualDay[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FIRST_WEEK_ROW = 7;
const WEEK_ROWS = 12;
const WEEKS = 6;
const FIRST_COL = 2;
const DAY_COLS = 5;

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function colNumber(letters: string): number {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

/** Cell values by "row,col", with shared strings looked up. */
function readGrid(sheetXml: string, shared: string[]): Map<string, string> {
  const grid = new Map<string, string>();
  for (const m of sheetXml.matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const body = m[2];
    if (!body) continue;
    const ref = /\br="([A-Z]+)(\d+)"/.exec(m[1] ?? "");
    if (!ref) continue;
    const type = /\bt="([^"]*)"/.exec(m[1] ?? "")?.[1];
    let value: string | undefined;
    if (type === "inlineStr") value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1]!)).join("");
    else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      if (v !== undefined) value = type === "s" ? shared[Number(v)] : decode(v);
    }
    if (value !== undefined && value.trim() !== "") grid.set(`${Number(ref[2])},${colNumber(ref[1]!)}`, value.trim());
  }
  return grid;
}

const serialToISO = (serial: number): string => new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000).toISOString().slice(0, 10);
/** A number from a cell; money shown as text (" $ 1,035.00 ") is understood too. */
const num = (v: string | undefined) => { const n = Number(v?.replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : 0; };


/** The monthly spreadsheet has one calendar tab instead of twelve: its month name and year sit in the header, and its dates are written as text ("September, 3"). */
function monthlyHeader(grid: Map<string, string>): { month: number; year: number } | null {
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 40; c++) {
      const idx = MONTHS.findIndex((m) => m.toLowerCase() === (grid.get(`${r},${c}`) ?? "").trim().toLowerCase());
      if (idx < 0) continue;
      for (let dr = 1; dr <= 2; dr++) {
        const y = Math.round(num(grid.get(`${r + dr},${c}`)));
        if (y > 2000 && y < 2200) return { month: idx + 1, year: y };
      }
    }
  }
  return null;
}

/** A calendar date cell as an ISO date: a spreadsheet date number, or text like "September, 3" (the year is the sheet's). */
function dateOfCell(raw: string | undefined, year: number): string | null {
  if (!raw) return null;
  const serial = Number(raw);
  if (Number.isFinite(serial)) return serial >= 30000 ? serialToISO(serial) : null;
  const m = /^([A-Za-z]+)\.?,?\s+(\d{1,2})$/.exec(raw.trim());
  const idx = m ? MONTHS.findIndex((x) => x.toLowerCase() === m[1]!.toLowerCase()) : -1;
  if (!m || idx < 0 || !year) return null;
  return `${year}-${String(idx + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

/** The row of the first week's dates: 7 in the yearly spreadsheet, 6 in the monthly one. */
function firstWeekRow(grid: Map<string, string>, year: number): number {
  for (let r = 4; r <= 9; r++) if (dateOfCell(grid.get(`${r},${FIRST_COL}`), year)) return r;
  return FIRST_WEEK_ROW;
}

/** Reads the month tabs of the yearly spreadsheet (or the one calendar tab of a monthly spreadsheet) (January … December) and returns every day with a client. */
export async function parseAnnual(bytes: ArrayBuffer | Uint8Array): Promise<AnnualSheet> {
  const { default: JSZip } = await import("jszip");
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ImportError("That file is not an Excel workbook.");
  }
  const workbook = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbook || !rels) throw new ImportError("This does not look like the yearly salary spreadsheet.");
  const target = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/\bId="([^"]*)"/.exec(m[0])?.[1] ?? "", /\bTarget="([^"]*)"/.exec(m[0])?.[1] ?? ""]));
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: decode(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? ""),
    rid: /\br:id="([^"]*)"/.exec(m[0])?.[1] ?? "",
  }));
  const monthSheets = MONTHS.map((m, i) => ({ month: i + 1, sheet: sheets.find((s) => s.name.trim().toLowerCase() === m.toLowerCase()) })).filter((x) => x.sheet);

  const sharedXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode([...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
  const gridOf = async (sheet: { rid: string }) => {
    const path = (target.get(sheet.rid) ?? "").replace(/^\/?(xl\/)?/, "xl/");
    const xml = await zip.file(path)?.async("string");
    return xml ? readGrid(xml, shared) : null;
  };

  // Each calendar to read: a tab per month (yearly spreadsheet), or the single calendar tab of a monthly spreadsheet.
  const calendars: Array<{ month: number; grid: Map<string, string>; year?: number }> = [];
  for (const { month, sheet } of monthSheets) {
    const grid = await gridOf(sheet!);
    // A monthly spreadsheet whose one tab happens to be named after the month still has its year in the header.
    if (grid) calendars.push({ month, grid, year: monthlyHeader(grid)?.year });
  }
  if (calendars.length === 0) {
    for (const sheet of sheets) {
      if (["settings", "data"].includes(sheet.name.trim().toLowerCase())) continue;
      const grid = await gridOf(sheet);
      const head = grid && monthlyHeader(grid);
      if (grid && head) { calendars.push({ month: head.month, grid, year: head.year }); break; }
    }
  }
  if (calendars.length === 0) throw new ImportError("Could not find the January to December tabs, or a monthly calendar. This importer reads the yearly or the monthly salary spreadsheet.");

  const days: AnnualDay[] = [];
  let year = 0, name = "";
  for (const { month, grid, year: tabYear } of calendars) {
    const sheetYear = Math.round(num(grid.get("4,9"))) > 2000 ? Math.round(num(grid.get("4,9"))) : tabYear ?? 0;
    if (sheetYear > 2000 && !year) year = sheetYear;
    if (!name) name = /Created by\s+(.+)$/i.exec(grid.get("1,2") ?? "")?.[1]?.trim() ?? "";
    const firstRow = firstWeekRow(grid, sheetYear);
    for (let w = 0; w < WEEKS; w++) {
      const dateRow = firstRow + w * WEEK_ROWS;
      for (let d = 0; d < 7; d++) {
        const col = FIRST_COL + d * DAY_COLS;
        const date = dateOfCell(grid.get(`${dateRow},${col}`), sheetYear);
        if (!date) continue;
        // The calendar also shows a few days of the neighbouring months; only this tab's month counts.
        if (Number(date.slice(5, 7)) !== month || (sheetYear > 2000 && Number(date.slice(0, 4)) !== sheetYear)) continue;
        const client = (grid.get(`${dateRow + 2},${col}`) ?? "").trim();
        if (!client || client.toLowerCase() === "all sites" || client === "----") continue;
        const hours = num(grid.get(`${dateRow + 2},${col + 2}`));
        const total = num(grid.get(`${dateRow + 2},${col + 3}`));
        if (!(hours > 0) && !(total > 0)) continue;
        days.push({
          date, client, hours,
          lead: ["1", "true"].includes((grid.get(`${dateRow + 3},${col + 1}`) ?? "").toLowerCase()),
          holiday: ["1", "true"].includes((grid.get(`${dateRow + 4},${col + 1}`) ?? "").toLowerCase()),
          total,
        });
      }
    }
  }
  const sites = await readSites(zip, sheets, target, shared);
  if (days.length === 0 && !year) throw new ImportError("No days were found. This importer reads the yearly salary spreadsheet's month tabs, or the monthly salary spreadsheet.");
  if (!year) year = Number(days[0]?.date.slice(0, 4)) || new Date().getFullYear();
  return { year, name, days, sites };
}

const SETTINGS_FIRST_ROW = 5;
const canonicalName = (n: string) => (n.trim().toLowerCase() === "hhsl yard" ? "HHSL Compound" : n.trim());
const opt = (v: string | undefined) => { if (v === undefined) return undefined; const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };

async function readSites(zip: import("jszip"), sheets: Array<{ name: string; rid: string }>, target: Map<string, string>, shared: string[]): Promise<AnnualSite[]> {
  const sheet = sheets.find((x) => x.name.trim().toLowerCase() === "settings");
  if (!sheet) return [];
  const path = (target.get(sheet.rid) ?? "").replace(/^\/?(xl\/)?/, "xl/");
  const xml = await zip.file(path)?.async("string");
  if (!xml) return [];
  const grid = readGrid(xml, shared);
  const out: AnnualSite[] = [];
  for (let r = SETTINGS_FIRST_ROW; r < SETTINGS_FIRST_ROW + 60; r++) {
    const raw = grid.get(`${r},1`);
    if (!raw) { if (out.length) break; continue; }
    const name = canonicalName(raw);
    if (name.toLowerCase() === "all sites") continue;
    const c = (col: number) => opt(grid.get(`${r},${col}`));
    const site: SiteRates = {
      payer: name.toLowerCase() === "atlantic" ? "atlantic" : "main",
      baseRate: c(2), leadRate: c(3), showRateAboveHrs: c(4), rateAboveHrs: c(5),
      weekday: { x1: c(6), x15: c(7), x2: c(8) },
      holiday: { x1: c(9), x15: c(10), x2: c(11), x3: c(12) },
      weekend: { x1: c(13), x15: c(14), x2: c(15) },
      dailyStd: c(16), dailyLead: c(17), dailyHoliday: c(18),
    };
    out.push({ name, rates: JSON.parse(JSON.stringify(site)) as SiteRates });
  }
  return out;
}

/** The app's data with any sites from the spreadsheet's Settings tab that it does not have yet. Existing sites and rates are untouched. */
export function withSheetSites(data: AppData, sheet: AnnualSheet): { data: AppData; added: string[] } {
  const have = new Set(data.history.sites.flatMap((v) => Object.keys(v.value)).map((n) => n.toLowerCase()));
  const missing = sheet.sites.filter((s) => !have.has(s.name.toLowerCase()));
  if (missing.length === 0) return { data, added: [] };
  const payerNames = { ...data.payerNames };
  // A brand-new app still has the placeholder payslip name; the sheet's main group is Point Lisas / other.
  if (payerNames.main === "Main payslip") payerNames.main = "Point Lisas / other";
  for (const s of missing) {
    if (payerNames[s.rates.payer] === undefined) payerNames[s.rates.payer] = s.rates.payer === "atlantic" ? "Atlantic LNG" : s.rates.payer === "main" ? "Point Lisas / other" : s.rates.payer;
  }
  return {
    data: {
      ...data,
      payerNames,
      history: { ...data.history, sites: data.history.sites.map((v) => ({ ...v, value: { ...v.value, ...Object.fromEntries(missing.map((s) => [s.name, structuredClone(s.rates)])) } })) },
    },
    added: missing.map((s) => s.name),
  };
}

/** Guess the site for each client text, using site names, with the sheet's old "HHSL Yard" name understood. */
export function guessAnnualAssignment(client: string, data: AppData): Assignment | undefined {
  const direct = guessAssignment(client, data);
  if (direct) return direct;
  if (client.trim().toLowerCase() === "hhsl yard") return guessAssignment("HHSL Compound", data);
  return undefined;
}

export const annualToEntry = (d: AnnualDay, a: Assignment): Entry => {
  const e: Entry = { id: newId(), date: d.date, site: a.site, hours: d.hours };
  if (a.role) e.role = a.role;
  if (d.lead) e.lead = true;
  if (d.holiday) e.holiday = true;
  return e;
};

export type ImportMode = "update" | "add" | "replace";

export interface DayChange {
  date: string;
  site: string;
  kind: "new" | "same" | "changed";
  /** What differs for a changed day, e.g. "10 h to 11.5 h, holiday on". */
  detail: string;
}

export interface ImportPlan {
  rows: DayChange[];
  counts: { new: number; same: number; changed: number; onlyInApp: number };
  /** Days in the app, in the file's months, that the file does not have (they stay, except when replacing). */
  onlyInApp: Entry[];
  /** How many logged jobs "Replace these months" would remove first. */
  removeCount: number;
  months: string[];
}

const hoursText = (h: number) => `${Math.round(h * 100) / 100} h`;

function differences(e: Entry, d: AnnualDay): { patch: Partial<Entry>; detail: string[] } {
  const patch: Partial<Entry> = {};
  const detail: string[] = [];
  // A day with start and end times gets its hours from them, so the file's hours do not override it. A flat-pay day has no hours in the file.
  if (!(e.startTime && e.endTime) && d.hours > 0 && Math.abs((e.hours ?? 0) - d.hours) > 0.001) { patch.hours = d.hours; detail.push(`${hoursText(e.hours ?? 0)} to ${hoursText(d.hours)}`); }
  if (!!e.lead !== d.lead) { patch.lead = d.lead || undefined; detail.push(d.lead ? "lead on" : "lead off"); }
  if (!!e.holiday !== d.holiday) { patch.holiday = d.holiday || undefined; detail.push(d.holiday ? "holiday on" : "holiday off"); }
  return { patch, detail };
}

/** What importing the file would do to each day, without changing anything: new, the same, or changed (and which of your days it does not mention). */
export function planAnnual(data: AppData, sheet: AnnualSheet, assign: Record<string, Assignment | undefined>): ImportPlan {
  const usable = sheet.days.filter((d) => assign[d.client]?.site);
  const months = [...new Set(usable.map((d) => d.date.slice(0, 7)))].sort();
  const mine = data.entries.filter((e) => e.kind !== "other");
  const rows: DayChange[] = usable.map((d) => {
    const site = assign[d.client]!.site;
    const have = mine.find((e) => e.date === d.date && e.site === site);
    if (!have) return { date: d.date, site, kind: "new", detail: "" };
    const diff = differences(have, d).detail;
    return diff.length ? { date: d.date, site, kind: "changed", detail: diff.join(", ") } : { date: d.date, site, kind: "same", detail: "" };
  });
  const inFile = new Set(usable.map((d) => `${d.date}|${assign[d.client]!.site}`));
  const inMonths = mine.filter((e) => months.includes(e.date.slice(0, 7)));
  const onlyInApp = inMonths.filter((e) => !inFile.has(`${e.date}|${e.site}`));
  const count = (k: DayChange["kind"]) => rows.filter((r) => r.kind === k).length;
  return { rows, counts: { new: count("new"), same: count("same"), changed: count("changed"), onlyInApp: onlyInApp.length }, onlyInApp, removeCount: inMonths.length, months };
}

export interface AnnualResult { data: AppData; added: number; updated: number; skipped: number; removed: number; months: string[] }

/**
 * "update" adds new days and brings changed days (same site and date) in line with the file; days only in the app stay.
 * "add" adds new days and leaves every logged day as it is.
 * "replace" clears the jobs of every month the file has days for, then adds them.
 */
export function applyAnnual(data: AppData, sheet: AnnualSheet, assign: Record<string, Assignment | undefined>, mode: ImportMode): AnnualResult {
  const usable = sheet.days.filter((d) => assign[d.client]?.site);
  const months = [...new Set(usable.map((d) => d.date.slice(0, 7)))].sort();
  let entries = data.entries;
  let removed = 0;
  let updated = 0;
  if (mode === "replace") {
    const kept = entries.filter((e) => e.kind === "other" || !months.includes(e.date.slice(0, 7)));
    removed = entries.length - kept.length;
    entries = kept;
  }
  const fresh: Entry[] = [];
  let skipped = sheet.days.length - usable.length;
  for (const d of usable) {
    const a = assign[d.client]!;
    const at = mode === "replace" ? -1 : entries.findIndex((e) => e.kind !== "other" && e.date === d.date && e.site === a.site);
    if (at >= 0) {
      if (mode === "update") {
        const { patch } = differences(entries[at]!, d);
        if (Object.keys(patch).length) { entries = entries.map((e, i) => (i === at ? { ...e, ...patch } : e)); updated++; continue; }
      }
      skipped++;
      continue;
    }
    fresh.push(annualToEntry(d, a));
  }
  const next: AppData = { ...data, entries: [...entries, ...fresh].sort((x, y) => x.date.localeCompare(y.date)) };
  if (!next.userName && !next.timesheet?.name && sheet.name) next.userName = sheet.name;
  return { data: next, added: fresh.length, updated, skipped, removed, months };
}
