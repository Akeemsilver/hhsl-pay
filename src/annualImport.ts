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

export interface AnnualSheet {
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
const num = (v: string | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Reads the month tabs of the yearly spreadsheet (January … December) and returns every day with a client. */
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
  if (monthSheets.length === 0) throw new ImportError("Could not find the January to December tabs. This importer reads the yearly salary spreadsheet.");

  const sharedXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode([...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));

  const days: AnnualDay[] = [];
  let year = 0, name = "";
  for (const { month, sheet } of monthSheets) {
    const path = (target.get(sheet!.rid) ?? "").replace(/^\/?(xl\/)?/, "xl/");
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const grid = readGrid(xml, shared);
    const sheetYear = Math.round(num(grid.get("4,9")));
    if (sheetYear > 2000 && !year) year = sheetYear;
    if (!name) name = /Created by\s+(.+)$/i.exec(grid.get("1,2") ?? "")?.[1]?.trim() ?? "";
    for (let w = 0; w < WEEKS; w++) {
      const dateRow = FIRST_WEEK_ROW + w * WEEK_ROWS;
      for (let d = 0; d < 7; d++) {
        const col = FIRST_COL + d * DAY_COLS;
        const serial = Number(grid.get(`${dateRow},${col}`));
        if (!Number.isFinite(serial) || serial < 30000) continue;
        const date = serialToISO(serial);
        // The calendar also shows a few days of the neighbouring months; only this tab's month counts.
        if (Number(date.slice(5, 7)) !== month || (sheetYear > 2000 && Number(date.slice(0, 4)) !== sheetYear)) continue;
        const client = (grid.get(`${dateRow + 2},${col}`) ?? "").trim();
        if (!client || client.toLowerCase() === "all sites") continue;
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
  if (days.length === 0 && !year) throw new ImportError("No days were found. This importer reads the yearly salary spreadsheet's month tabs.");
  if (!year) year = Number(days[0]?.date.slice(0, 4)) || new Date().getFullYear();
  return { year, name, days };
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

export interface AnnualResult { data: AppData; added: number; skipped: number; removed: number; months: string[] }

/** "replace" clears the jobs of every month the file has days for, then adds them; "add" keeps what is there and skips same-site days already logged. */
export function applyAnnual(data: AppData, sheet: AnnualSheet, assign: Record<string, Assignment | undefined>, mode: "add" | "replace"): AnnualResult {
  const usable = sheet.days.filter((d) => assign[d.client]?.site);
  const months = [...new Set(usable.map((d) => d.date.slice(0, 7)))].sort();
  let entries = data.entries;
  let removed = 0;
  if (mode === "replace") {
    const kept = entries.filter((e) => e.kind === "other" || !months.includes(e.date.slice(0, 7)));
    removed = entries.length - kept.length;
    entries = kept;
  }
  const fresh: Entry[] = [];
  let skipped = sheet.days.length - usable.length;
  for (const d of usable) {
    const a = assign[d.client]!;
    if (mode === "add" && entries.some((e) => e.kind !== "other" && e.date === d.date && e.site === a.site)) { skipped++; continue; }
    fresh.push(annualToEntry(d, a));
  }
  const next: AppData = { ...data, entries: [...entries, ...fresh].sort((x, y) => x.date.localeCompare(y.date)) };
  if (!next.userName && !next.timesheet?.name && sheet.name) next.userName = sheet.name;
  return { data: next, added: fresh.length, skipped, removed, months };
}
