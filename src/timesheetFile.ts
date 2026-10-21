import type { TimesheetRow } from "./timesheet";

export class TemplateError extends Error {}

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const FIRST_DAY_ROW = 14;

function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "TH" : ({ 1: "ST", 2: "ND", 3: "RD" } as Record<number, string>)[n % 10] ?? "TH";
  return `${n}${suffix}`;
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type CellValue = string | number | null;

/** Replaces one cell's content and keeps its style. */
function setCell(xml: string, ref: string, value: CellValue): string {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = re.exec(xml);
  if (!m) throw new TemplateError(`The template has no cell ${ref}. Is this the HHSL time sheet?`);
  const style = /\ss="(\d+)"/.exec(m[1] ?? "");
  const s = style ? ` s="${style[1]}"` : "";
  let cell: string;
  if (value === null || value === "") cell = `<c r="${ref}"${s}/>`;
  else if (typeof value === "number") cell = `<c r="${ref}"${s}><v>${value}</v></c>`;
  else cell = `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  return xml.replace(re, cell);
}

/** Updates the saved result of a formula cell so viewers that do not recalculate still show the right total. */
function setCached(xml: string, ref: string, value: number): string {
  const re = new RegExp(`(<c r="${ref}"[^>]*>[\\s\\S]*?<v>)[^<]*(</v></c>)`);
  return re.test(xml) ? xml.replace(re, `$1${value}$2`) : xml;
}

const toSerial = (t: string | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  return m ? (Number(m[1]) * 60 + Number(m[2])) / 1440 : null;
};
const num = (n: number): number | null => (n > 0 ? Math.round(n * 100) / 100 : null);

export interface TimesheetFileInput {
  /** ERT name as printed, any case. */
  name: string;
  siteLabel: string;
  /** "YYYY-MM" */
  month: string;
  rows: TimesheetRow[];
}

export function timesheetFileName(name: string, month: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
  return `HHSL-Time-Sheet-${words.length ? words.join("-") + "-" : ""}${month}.xlsx`;
}

/** Fills the HHSL time sheet template and returns the new .xlsx bytes. The logo and layout are kept as they are. */
export async function fillTimesheet(template: ArrayBuffer | Uint8Array, input: TimesheetFileInput): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  let zip;
  try {
    zip = await JSZip.loadAsync(template);
  } catch {
    throw new TemplateError("That file is not an Excel workbook.");
  }
  const sheetFile = zip.file("xl/worksheets/sheet1.xml");
  if (!sheetFile) throw new TemplateError("Could not find the time sheet in this workbook.");
  let xml = await sheetFile.async("string");

  const shared = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const labels = shared + xml;
  for (const needed of ["TIME SHEET", "CLIENT ASSIGNED", "JOB TICKET NUMBER"]) {
    if (!labels.includes(needed)) throw new TemplateError("This does not look like the HHSL time sheet template.");
  }

  const [yearText, monthText] = input.month.split("-");
  const year = Number(yearText), month = Number(monthText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  xml = setCell(xml, "F6", `E.R.T.'S NAME (BLOCK LETTERS):  ${input.name.trim().toUpperCase()}`);
  xml = setCell(xml, "F10", `SITE: ${input.siteLabel.trim()}`);
  xml = setCell(xml, "F11", `MONTH: ${MONTHS[month - 1]}`);
  xml = setCell(xml, "J11", `YEAR-${year}`);

  const byDay = new Map(input.rows.map((r) => [Number(r.date.slice(8)), r]));
  const totals = { t: 0, t15: 0, t2: 0, t3: 0 };
  for (let day = 1; day <= 31; day++) {
    const r = FIRST_DAY_ROW + day - 1;
    const real = day <= daysInMonth;
    const row = byDay.get(day);
    xml = setCell(xml, `B${r}`, real ? ordinal(day) : null);
    xml = setCell(xml, `C${r}`, real ? WEEKDAY_LETTER[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]! : null);
    xml = setCell(xml, `D${r}`, toSerial(row?.onDuty));
    xml = setCell(xml, `E${r}`, toSerial(row?.offDuty));
    xml = setCell(xml, `F${r}`, row ? num(row.hours.t) : null);
    xml = setCell(xml, `G${r}`, row ? num(row.hours.t15) : null);
    xml = setCell(xml, `H${r}`, row ? num(row.hours.t2) : null);
    xml = setCell(xml, `I${r}`, row ? num(row.hours.t3) : null);
    xml = setCell(xml, `J${r}`, row?.client ?? null);
    xml = setCell(xml, `K${r}`, row?.ticket ?? null);
    if (row) {
      totals.t += row.hours.t; totals.t15 += row.hours.t15; totals.t2 += row.hours.t2; totals.t3 += row.hours.t3;
    }
  }

  // Totals rows hold formulas; refresh their saved values too.
  const cols = ["F", "G", "H", "I"] as const;
  const sums = [totals.t, totals.t15, totals.t2, totals.t3];
  const mult = [1, 1.5, 2, 3];
  cols.forEach((c, i) => {
    xml = setCached(xml, `${c}46`, sums[i]!);
    xml = setCached(xml, `${c}47`, sums[i]! * mult[i]!);
  });
  xml = setCached(xml, "F48", sums.reduce((s, v, i) => s + v * mult[i]!, 0));

  zip.file("xl/worksheets/sheet1.xml", xml);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
