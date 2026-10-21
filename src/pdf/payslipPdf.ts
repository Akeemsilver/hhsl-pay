import type { Payslip } from "../payslip";
import { BAND, BRAND, GROSS, INK, LINE, MUTED, NET, NIS, PAGE_H, PAGE_W, PAYE, SURCHARGE, rgb, usd } from "./common";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const M = 44;
const RIGHT = PAGE_W - M;

type Doc = import("jspdf").jsPDF;

function periodText(month: string): { name: string; range: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { name: `${MONTHS[m - 1]} ${y}`, range: `1 - ${last} ${MONTHS[m - 1]} ${y}` };
}

function text(doc: Doc, s: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: string; align?: "left" | "right" | "center" } = {}) {
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(opts.size ?? 10);
  doc.setTextColor(...rgb(opts.color ?? INK));
  doc.text(s, x, y, { align: opts.align ?? "left" });
}

function hr(doc: Doc, y: number, color = LINE, width = 0.7) {
  doc.setDrawColor(...rgb(color));
  doc.setLineWidth(width);
  doc.line(M, y, RIGHT, y);
}

function sectionTitle(doc: Doc, s: string, y: number) {
  text(doc, s, M, y, { size: 8.5, bold: true, color: BRAND });
  doc.setDrawColor(...rgb(BRAND));
  doc.setLineWidth(1.2);
  doc.line(M, y + 4, M + 28, y + 4);
}

function drawSlip(doc: Doc, s: Payslip, preparedOn: string) {
  const { name, range } = periodText(s.month);

  // Header
  doc.setFillColor(...rgb(BRAND));
  doc.rect(0, 0, PAGE_W, 10, "F");
  text(doc, "PAYSLIP", M, 66, { size: 26, bold: true });
  text(doc, `Pay period: ${name}`, M, 86, { size: 11, color: MUTED });
  text(doc, "PAYSLIP FOR", RIGHT, 48, { size: 8, bold: true, color: MUTED, align: "right" });
  text(doc, s.payerName, RIGHT, 68, { size: 16, bold: true, align: "right" });
  hr(doc, 104, LINE, 1);

  // Details
  const cols = [M, M + 190, M + 380];
  const details: Array<[string, string]> = [
    ["EMPLOYEE", s.employee || "Not set"],
    ["PAY PERIOD", range],
    ["PAYSLIP", s.payerName],
    ["DAYS WORKED", String(s.days)],
    ["HOURS PAID", `${Math.round(s.hours * 100) / 100} h`],
    ["PREPARED ON", preparedOn],
  ];
  details.forEach(([label, value], i) => {
    const x = cols[i % 3]!;
    const y = 126 + Math.floor(i / 3) * 40;
    text(doc, label, x, y, { size: 7.5, bold: true, color: MUTED });
    text(doc, value, x, y + 15, { size: 11, bold: true });
  });

  // Earnings
  let y = 232;
  sectionTitle(doc, "EARNINGS", y);
  y += 14;
  doc.setFillColor(...rgb(BAND));
  doc.rect(M, y, RIGHT - M, 22, "F");
  text(doc, "Description", M + 8, y + 15, { size: 9, bold: true, color: MUTED });
  text(doc, "Quantity", 360, y + 15, { size: 9, bold: true, color: MUTED, align: "right" });
  text(doc, "Rate", 450, y + 15, { size: 9, bold: true, color: MUTED, align: "right" });
  text(doc, "Amount", RIGHT - 8, y + 15, { size: 9, bold: true, color: MUTED, align: "right" });
  y += 22;
  const rowH = s.lines.length > 12 ? 16 : 21;
  const font = s.lines.length > 12 ? 9 : 10;
  s.lines.forEach((l, i) => {
    if (i % 2 === 1) { doc.setFillColor(250, 251, 252); doc.rect(M, y, RIGHT - M, rowH, "F"); }
    const baseline = y + rowH / 2 + font / 3;
    const label = l.description.length > 50 ? `${l.description.slice(0, 49)}...` : l.description;
    text(doc, label, M + 8, baseline, { size: font });
    if (l.unit) text(doc, `${l.qty} ${l.unit}`, 360, baseline, { size: font, align: "right" });
    text(doc, usd(l.rate), 450, baseline, { size: font, align: "right" });
    text(doc, usd(l.amount), RIGHT - 8, baseline, { size: font, align: "right" });
    y += rowH;
  });
  hr(doc, y, INK, 0.9);
  y += 18;
  text(doc, "Gross pay", M + 8, y, { size: 11, bold: true });
  text(doc, usd(s.gross), RIGHT - 8, y, { size: 12, bold: true, color: GROSS, align: "right" });
  y += 26;

  // Deductions
  sectionTitle(doc, "DEDUCTIONS", y);
  y += 14;
  const deductions: Array<[string, number, string]> = [
    [s.corrected ? "PAYE (income tax) *" : "PAYE (income tax)", s.paye, PAYE],
    ["NIS (National Insurance)", s.nis, NIS],
    ["Health surcharge", s.surcharge, SURCHARGE],
  ];
  deductions.forEach(([label, amount, color], i) => {
    if (i % 2 === 0) { doc.setFillColor(250, 251, 252); doc.rect(M, y, RIGHT - M, 21, "F"); }
    doc.setFillColor(...rgb(color));
    doc.circle(M + 12, y + 10.5, 3, "F");
    text(doc, label, M + 22, y + 14.5, { size: 10 });
    text(doc, amount > 0 ? `-${usd(amount)}` : usd(0), RIGHT - 8, y + 14.5, { size: 10, bold: true, color, align: "right" });
    y += 21;
  });
  hr(doc, y, INK, 0.9);
  y += 18;
  text(doc, "Total deductions", M + 8, y, { size: 11, bold: true });
  text(doc, `-${usd(s.paye + s.nis + s.surcharge)}`, RIGHT - 8, y, { size: 11, bold: true, align: "right" });
  y += 22;

  // Net pay
  doc.setFillColor(232, 245, 236);
  doc.setDrawColor(...rgb(NET));
  doc.setLineWidth(1);
  doc.roundedRect(M, y, RIGHT - M, 52, 6, 6, "FD");
  text(doc, "NET PAY", M + 18, y + 22, { size: 9, bold: true, color: NET });
  text(doc, "Gross pay less deductions", M + 18, y + 38, { size: 9, color: MUTED });
  text(doc, usd(s.net), RIGHT - 18, y + 34, { size: 24, bold: true, color: NET, align: "right" });
  y += 76;

  // Year to date
  sectionTitle(doc, `YEAR TO DATE (JANUARY TO ${MONTHS[Number(s.month.slice(5)) - 1]!.toUpperCase()})`, y);
  y += 14;
  const ytd: Array<[string, number, string]> = [
    ["Gross", s.ytd.gross, GROSS], ["PAYE", s.ytd.paye, PAYE], ["NIS", s.ytd.nis, NIS], ["Surcharge", s.ytd.surcharge, SURCHARGE], ["Net", s.ytd.net, NET],
  ];
  const w = (RIGHT - M) / ytd.length;
  doc.setFillColor(...rgb(BAND));
  doc.rect(M, y, RIGHT - M, 44, "F");
  ytd.forEach(([label, value, color], i) => {
    const cx = M + w * i + w / 2;
    text(doc, label.toUpperCase(), cx, y + 15, { size: 7.5, bold: true, color: MUTED, align: "center" });
    text(doc, usd(value), cx, y + 33, { size: 10.5, bold: true, color, align: "center" });
  });
  y += 56;
  if (s.corrected) {
    text(doc, "* Gross or PAYE was entered from your own payslip instead of being calculated.", M, y, { size: 8.5, color: MUTED });
  }
}

function drawSummary(doc: Doc, slips: Payslip[]) {
  const { name } = periodText(slips[0]!.month);
  doc.setFillColor(...rgb(BRAND));
  doc.rect(0, 0, PAGE_W, 10, "F");
  text(doc, "PAY SUMMARY", M, 66, { size: 26, bold: true });
  text(doc, `All payslips, ${name}`, M, 86, { size: 11, color: MUTED });
  text(doc, slips[0]!.employee || "", RIGHT, 68, { size: 14, bold: true, align: "right" });
  hr(doc, 104, LINE, 1);

  let y = 132;
  doc.setFillColor(...rgb(BAND));
  doc.rect(M, y, RIGHT - M, 24, "F");
  const xs = [M + 8, 270, 340, 400, 470, RIGHT - 8];
  text(doc, "Payslip", xs[0]!, y + 16, { size: 9, bold: true, color: MUTED });
  text(doc, "Gross", xs[1]!, y + 16, { size: 9, bold: true, color: GROSS, align: "right" });
  text(doc, "PAYE", xs[2]!, y + 16, { size: 9, bold: true, color: PAYE, align: "right" });
  text(doc, "NIS", xs[3]!, y + 16, { size: 9, bold: true, color: NIS, align: "right" });
  text(doc, "Surcharge", xs[4]!, y + 16, { size: 9, bold: true, color: SURCHARGE, align: "right" });
  text(doc, "Net", xs[5]!, y + 16, { size: 9, bold: true, color: NET, align: "right" });
  y += 24;
  const total = { gross: 0, paye: 0, nis: 0, surcharge: 0, net: 0 };
  slips.forEach((s) => {
    text(doc, s.payerName, xs[0]!, y + 17, { size: 10 });
    text(doc, usd(s.gross), xs[1]!, y + 17, { size: 10, color: GROSS, align: "right" });
    text(doc, usd(s.paye), xs[2]!, y + 17, { size: 10, color: PAYE, align: "right" });
    text(doc, usd(s.nis), xs[3]!, y + 17, { size: 10, color: NIS, align: "right" });
    text(doc, usd(s.surcharge), xs[4]!, y + 17, { size: 10, color: SURCHARGE, align: "right" });
    text(doc, usd(s.net), xs[5]!, y + 17, { size: 10, bold: true, color: NET, align: "right" });
    total.gross += s.gross; total.paye += s.paye; total.nis += s.nis; total.surcharge += s.surcharge; total.net += s.net;
    y += 26;
    hr(doc, y, LINE, 0.6);
  });
  y += 4;
  hr(doc, y, INK, 0.9);
  text(doc, "Total", xs[0]!, y + 19, { size: 11, bold: true });
  text(doc, usd(total.gross), xs[1]!, y + 19, { size: 10.5, bold: true, color: GROSS, align: "right" });
  text(doc, usd(total.paye), xs[2]!, y + 19, { size: 10.5, bold: true, color: PAYE, align: "right" });
  text(doc, usd(total.nis), xs[3]!, y + 19, { size: 10.5, bold: true, color: NIS, align: "right" });
  text(doc, usd(total.surcharge), xs[4]!, y + 19, { size: 10.5, bold: true, color: SURCHARGE, align: "right" });
  text(doc, usd(total.net), xs[5]!, y + 19, { size: 10.5, bold: true, color: NET, align: "right" });
}

/** One page per payslip, plus a summary page when there is more than one. Returns the PDF bytes. */
export async function payslipPdf(slips: Payslip[], preparedOn = new Date()): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setProperties({ title: `Payslip ${slips[0]?.month ?? ""}`, creator: "HHSL Salary Tracker" });
  const on = `${preparedOn.getDate()} ${MONTHS[preparedOn.getMonth()]} ${preparedOn.getFullYear()}`;

  slips.forEach((s, i) => {
    if (i > 0) doc.addPage();
    drawSlip(doc, s, on);
  });
  if (slips.length > 1) {
    doc.addPage();
    drawSummary(doc, slips);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    hr(doc, PAGE_H - 70, LINE, 0.7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(MUTED));
    const note = doc.splitTextToSize(
      "Prepared by HHSL Salary Tracker from the days logged on this phone. It is an estimate for your own records and is not an official payslip issued by your employer. Final pay is decided by your employer.",
      RIGHT - M - 70,
    );
    doc.text(note, M, PAGE_H - 55);
    doc.text(`Page ${p} of ${pages}`, RIGHT, PAGE_H - 55, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

export function payslipFileName(employee: string, month: string): string {
  const words = employee.trim().split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
  return `Payslip-${words.length ? words.join("-") + "-" : ""}${month}.pdf`;
}
