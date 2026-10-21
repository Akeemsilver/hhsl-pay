import type { TimesheetRow } from "../timesheet";
import { PAGE_W, rgb } from "./common";

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const LETTER = ["S", "M", "T", "W", "T", "F", "S"];

function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "TH" : ({ 1: "ST", 2: "ND", 3: "RD" } as Record<number, string>)[n % 10] ?? "TH";
  return `${n}${suffix}`;
}

const clock = (t: string | undefined) => (t && /^\d{1,2}:\d{2}$/.test(t) ? `${Number(t.split(":")[0])}:${t.split(":")[1]}` : "");
const hrs = (n: number | undefined) => (n && n > 0 ? n.toFixed(1) : "");

export interface TimesheetPdfInput {
  name: string;
  siteLabel: string;
  /** "YYYY-MM" */
  month: string;
  rows: TimesheetRow[];
  /** The company logo (PNG or JPEG bytes), taken from the saved template when there is one. */
  logo?: Uint8Array | null;
}

/** The HHSL time sheet drawn as a one-page PDF, laid out like the Excel form. */
export async function timesheetPdf(input: TimesheetPdfInput): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setProperties({ title: `Time sheet ${input.month}`, creator: "HHSL Salary Tracker" });

  const left = 42;
  const widths = [30, 22, 52, 52, 40, 40, 40, 40, 111, 84];
  const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? left) + w], [left]);
  const right = xs[widths.length]!;
  const [year, month] = input.month.split("-").map(Number) as [number, number];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  const box = (x: number, y: number, w: number, h: number, fill?: string) => {
    if (fill) { doc.setFillColor(...rgb(fill)); doc.rect(x, y, w, h, "FD"); } else doc.rect(x, y, w, h);
  };
  const label = (s: string, x: number, y: number, w: number, h: number, o: { size?: number; bold?: boolean; align?: "left" | "center" | "right" } = {}) => {
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size ?? 8);
    doc.setTextColor(0, 0, 0);
    const tx = o.align === "center" ? x + w / 2 : o.align === "right" ? x + w - 3 : x + 3;
    doc.text(s, tx, y + h / 2 + (o.size ?? 8) / 3, { align: o.align ?? "left" });
  };

  // Title block
  let y = 34;
  const blockH = 140;
  const leftW = xs[4]! - left;
  box(left, y, leftW, blockH);
  if (input.logo && input.logo.length > 0) {
    try {
      doc.addImage(input.logo, "PNG", left + 38, y + 18, 80, 100);
    } catch {
      /* the logo is optional */
    }
  }
  const notes = [
    "This document is to be completed in its entirety to ensure proper processing on a monthly basis",
    "Timesheets must be approved by the respective Client Representatives",
    "Timesheets must be forwarded to HHSL's Operations Coordinator for review and processing accordingly.",
  ];
  let ry = y;
  const rx = xs[4]!, rw = right - rx;
  notes.forEach((n) => { box(rx, ry, rw, 16); label(n, rx, ry, rw, 16, { size: 5.6 }); ry += 16; });
  box(rx, ry, rw, 22); label(`E.R.T.'S NAME (BLOCK LETTERS):  ${input.name.trim().toUpperCase()}`, rx, ry, rw, 22, { size: 9, bold: true }); ry += 22;
  box(rx, ry, rw, 14, "#e5e7eb"); ry += 14;
  box(rx, ry, rw, 22); label("E.R.T.'S SIGNATURE:", rx, ry, rw, 22, { size: 9, bold: true }); ry += 22;
  box(rx, ry, rw, 14, "#e5e7eb"); ry += 14;
  box(rx, ry, rw, 20); label(`SITE: ${input.siteLabel.trim()}`, rx, ry, rw, 20, { size: 9, bold: true });
  y += blockH;

  // Month row
  const rowH = 20;
  box(left, y, leftW, rowH); label("TIME SHEET", left, y, leftW, rowH, { size: 9, bold: true, align: "center" });
  box(xs[4]!, y, xs[8]! - xs[4]!, rowH); label(`MONTH: ${MONTHS[month - 1]}`, xs[4]!, y, xs[8]! - xs[4]!, rowH, { size: 9, bold: true });
  box(xs[8]!, y, xs[9]! - xs[8]!, rowH); label(`YEAR-${year}`, xs[8]!, y, xs[9]! - xs[8]!, rowH, { size: 9, bold: true, align: "center" });
  box(xs[9]!, y, right - xs[9]!, rowH);
  y += rowH;

  // Column headings
  const h1 = 14, h2 = 14;
  box(left, y, xs[2]! - left, h1 + h2); label("DATE", left, y, xs[2]! - left, h1 + h2, { size: 8, bold: true, align: "center" });
  box(xs[2]!, y, xs[4]! - xs[2]!, h1); label("TIME", xs[2]!, y, xs[4]! - xs[2]!, h1, { size: 8, bold: true, align: "center" });
  ["ON DUTY", "OFF DUTY"].forEach((t, i) => { box(xs[2]! + i * 52, y + h1, 52, h2); label(t, xs[2]! + i * 52, y + h1, 52, h2, { size: 7.5, bold: true, align: "center" }); });
  ["T", "Tx1.5", "Tx2", "Tx3"].forEach((t, i) => {
    const x = xs[4]! + i * 40;
    box(x, y, 40, h1); label("HRS", x, y, 40, h1, { size: 8, bold: true, align: "center" });
    box(x, y + h1, 40, h2); label(t, x, y + h1, 40, h2, { size: 8, bold: true, align: "center" });
  });
  box(xs[8]!, y, xs[9]! - xs[8]!, h1 + h2); label("CLIENT ASSIGNED", xs[8]!, y, xs[9]! - xs[8]!, h1 + h2, { size: 7.5, bold: true, align: "center" });
  box(xs[9]!, y, right - xs[9]!, h1 + h2); label("JOB TICKET NUMBER", xs[9]!, y, right - xs[9]!, h1 + h2, { size: 7, bold: true, align: "center" });
  y += h1 + h2;

  // Days
  const byDay = new Map(input.rows.map((r) => [Number(r.date.slice(8)), r]));
  const dayH = 15;
  const totals = { t: 0, t15: 0, t2: 0, t3: 0 };
  for (let d = 1; d <= 31; d++) {
    const real = d <= days;
    const row = byDay.get(d);
    widths.forEach((w, i) => box(xs[i]!, y, w, dayH));
    if (real) {
      label(ordinal(d), xs[0]!, y, widths[0]!, dayH, { size: 7, bold: true, align: "center" });
      label(LETTER[new Date(Date.UTC(year, month - 1, d)).getUTCDay()]!, xs[1]!, y, widths[1]!, dayH, { size: 7, bold: true, align: "center" });
    }
    if (row) {
      label(clock(row.onDuty), xs[2]!, y, widths[2]!, dayH, { size: 8, align: "center" });
      label(clock(row.offDuty), xs[3]!, y, widths[3]!, dayH, { size: 8, align: "center" });
      [row.hours.t, row.hours.t15, row.hours.t2, row.hours.t3].forEach((v, i) => label(hrs(v), xs[4 + i]!, y, widths[4 + i]!, dayH, { size: 8, align: "center" }));
      label(row.client.length > 26 ? `${row.client.slice(0, 25)}...` : row.client, xs[8]!, y, widths[8]!, dayH, { size: 7.5, align: "center" });
      totals.t += row.hours.t; totals.t15 += row.hours.t15; totals.t2 += row.hours.t2; totals.t3 += row.hours.t3;
    }
    y += dayH;
  }

  // Totals
  const sums = [totals.t, totals.t15, totals.t2, totals.t3];
  const mult = [1, 1.5, 2, 3];
  const th = 14;
  const blank = xs[3]! - left;
  box(left, y, blank + 52, th * 3 + 22);
  const ex = xs[3]!;
  box(ex, y, 52, th); label("M", ex, y, 52, th, { size: 8, align: "center" });
  ["T", "Tx1.5", "Tx2", "Tx3"].forEach((t, i) => { box(xs[4]! + i * 40, y, 40, th); label(t, xs[4]! + i * 40, y, 40, th, { size: 8, align: "center" }); });
  box(xs[8]!, y, right - xs[8]!, th);
  y += th;
  box(ex, y, 52, th); label("TTL HOURS", ex, y, 52, th, { size: 7, bold: true, align: "center" });
  sums.forEach((v, i) => { box(xs[4]! + i * 40, y, 40, th); label(hrs(v), xs[4]! + i * 40, y, 40, th, { size: 8, align: "center" }); });
  box(xs[8]!, y, 111, th); label("Reviewed by:", xs[8]!, y, 111, th, { size: 7.5, bold: true });
  box(xs[9]!, y, right - xs[9]!, th);
  y += th;
  box(ex, y, 52, th); label("SUB TOTAL", ex, y, 52, th, { size: 7, bold: true, align: "center" });
  sums.forEach((v, i) => { box(xs[4]! + i * 40, y, 40, th); label((v * mult[i]!).toFixed(1), xs[4]! + i * 40, y, 40, th, { size: 8, align: "center" }); });
  box(xs[8]!, y, 111, th); label("Approved by:", xs[8]!, y, 111, th, { size: 7.5, bold: true });
  box(xs[9]!, y, right - xs[9]!, th);
  y += th;
  box(ex, y, 52, 22); label("TOTAL", ex, y, 52, 22, { size: 8, bold: true, align: "center" });
  box(xs[4]!, y, 160, 22); label(sums.reduce((s, v, i) => s + v * mult[i]!, 0).toFixed(1), xs[4]!, y, 160, 22, { size: 10, bold: true, align: "center" });
  box(xs[8]!, y, right - xs[8]!, 22);

  void PAGE_W;
  return new Uint8Array(doc.output("arraybuffer"));
}
