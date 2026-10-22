import { newId, type AppData, type Entry } from "./model";

/** One filled-in row of the HHSL time sheet. */
export interface ImportedRow {
  date: string;
  onDuty?: string;
  offDuty?: string;
  hours: { t: number; t15: number; t2: number; t3: number };
  client: string;
}

export interface ImportedTimesheet {
  name: string;
  siteLabel: string;
  /** YYYY-MM */
  month: string;
  rows: ImportedRow[];
}

export class ImportError extends Error {}

const FIRST_DAY_ROW = 14;
const MONTH_NAMES = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function readCells(sheetXml: string, shared: string[]): Map<string, string> {
  const cells = new Map<string, string>();
  for (const m of sheetXml.matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1] ?? "";
    const body = m[2];
    if (!body) continue;
    const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const type = /\bt="([^"]*)"/.exec(attrs)?.[1];
    let value: string | undefined;
    if (type === "inlineStr") value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1]!)).join("");
    else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      if (v !== undefined) value = type === "s" ? shared[Number(v)] : decode(v);
    }
    if (value !== undefined && value.trim() !== "") cells.set(ref, value.trim());
  }
  return cells;
}

const toHHMM = (v: string | undefined): string | undefined => {
  if (!v) return undefined;
  const text = /^(\d{1,2}):(\d{2})/.exec(v);
  if (text) return `${text[1]!.padStart(2, "0")}:${text[2]}`;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n >= 1.0001) return undefined;
  const mins = Math.round(n * 24 * 60) % (24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};
const toNum = (v: string | undefined) => {
  const n = Number((v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Reads a filled-in HHSL time sheet (the same form the app fills in). */
export async function parseTimesheet(bytes: ArrayBuffer | Uint8Array): Promise<ImportedTimesheet> {
  const { default: JSZip } = await import("jszip");
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ImportError("That file is not an Excel workbook.");
  }
  const sheet = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  if (!sheet) throw new ImportError("Could not find the time sheet in this workbook.");
  const sharedXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode([...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
  const cells = readCells(sheet, shared);

  const all = [...cells.values()].join("\n");
  if (!all.includes("CLIENT ASSIGNED") || !all.includes("TIME SHEET")) throw new ImportError("This does not look like the HHSL time sheet.");

  const monthName = /MONTH\s*:?\s*([A-Za-z]+)/i.exec(cells.get("F11") ?? all)?.[1]?.toUpperCase();
  const monthIndex = MONTH_NAMES.findIndex((m) => m === monthName || (monthName && m.startsWith(monthName.slice(0, 3))));
  const year = Number(/YEAR\s*[-:]?\s*(\d{4})/i.exec(cells.get("J11") ?? all)?.[1]);
  if (monthIndex < 0 || !year) throw new ImportError("Could not find the month and year on the time sheet.");
  const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const name = (/:\s*(.+)$/.exec(cells.get("F6") ?? "")?.[1] ?? "").trim();
  const siteLabel = (/SITE\s*:\s*(.+)$/i.exec(cells.get("F10") ?? "")?.[1] ?? "").trim();

  const rows: ImportedRow[] = [];
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const r = FIRST_DAY_ROW + day - 1;
    const hours = { t: toNum(cells.get(`F${r}`)), t15: toNum(cells.get(`G${r}`)), t2: toNum(cells.get(`H${r}`)), t3: toNum(cells.get(`I${r}`)) };
    const client = cells.get(`J${r}`) ?? "";
    const on = toHHMM(cells.get(`D${r}`));
    const off = toHHMM(cells.get(`E${r}`));
    const worked = hours.t + hours.t15 + hours.t2 + hours.t3 > 0 || !!on || !!off;
    if (!worked && !client) continue;
    rows.push({ date: `${month}-${String(day).padStart(2, "0")}`, onDuty: on, offDuty: off, hours, client });
  }
  return { name, siteLabel, month, rows };
}

export interface Assignment {
  site: string;
  role?: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Works out which site a client-column text means, using your timesheet rules and site names. */
export function guessAssignment(client: string, data: AppData): Assignment | undefined {
  const c = norm(client);
  if (!c) return undefined;
  for (const r of data.timesheet?.rules ?? []) if (norm(r.label) === c) return { site: r.site, role: r.role };
  const siteNames = [...new Set(data.history.sites.flatMap((v) => Object.keys(v.value)))];
  const bySite = siteNames.find((n) => norm(n) === c);
  if (bySite) return { site: bySite };
  const medic = /^(.*)\s+medic$/.exec(c)?.[1];
  const medicSite = medic ? siteNames.find((n) => norm(n) === medic) : undefined;
  if (medicSite) return { site: medicSite, role: "Client medic" };
  return undefined;
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** One app job for a timesheet row: times and unpaid lunch are worked back from the hours. */
export function rowToEntry(row: ImportedRow, a: Assignment): Entry {
  const hours = Math.round((row.hours.t + row.hours.t15 + row.hours.t2 + row.hours.t3) * 100) / 100;
  const entry: Entry = { id: newId(), date: row.date, site: a.site, hours };
  if (a.role) entry.role = a.role;
  if (row.onDuty && row.offDuty) {
    let span = minutes(row.offDuty) - minutes(row.onDuty);
    if (span <= 0) span += 24 * 60;
    const gap = Math.round(span - hours * 60);
    if (gap === 0) Object.assign(entry, { detailed: true, startTime: row.onDuty, endTime: row.offDuty, lunchPaid: true });
    else if (gap === 30 || gap === 60) Object.assign(entry, { detailed: true, startTime: row.onDuty, endTime: row.offDuty, lunchPaid: false, lunchMinutes: gap });
  }
  return entry;
}

export interface ImportResult {
  data: AppData;
  added: number;
  skipped: number;
  removed: number;
}

/** Adds the timesheet's days to the app. "replace" first clears this month's jobs; "add" leaves existing days alone. */
export function applyTimesheet(
  data: AppData,
  sheet: ImportedTimesheet,
  assign: Record<string, Assignment | undefined>,
  mode: "add" | "replace",
): ImportResult {
  let entries = data.entries;
  let removed = 0;
  if (mode === "replace") {
    const kept = entries.filter((e) => e.kind === "other" || !e.date.startsWith(sheet.month));
    removed = entries.length - kept.length;
    entries = kept;
  }
  const fresh: Entry[] = [];
  let skipped = 0;
  for (const row of sheet.rows) {
    const a = assign[row.client];
    if (!a || !a.site) { skipped++; continue; }
    if (mode === "add" && entries.some((e) => e.kind !== "other" && e.date === row.date && e.site === a.site)) { skipped++; continue; }
    fresh.push(rowToEntry(row, a));
  }
  const next: AppData = { ...data, entries: [...entries, ...fresh].sort((x, y) => x.date.localeCompare(y.date)) };
  if (!next.userName && !next.timesheet?.name && sheet.name) next.userName = sheet.name.trim();
  return { data: next, added: fresh.length, skipped, removed };
}

