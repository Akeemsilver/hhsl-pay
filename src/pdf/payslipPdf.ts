import { combinePayslips, siteRateText, type Payslip } from "../payslip";
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
  text(doc, s.employee || "All sites", RIGHT, 68, { size: 16, bold: true, align: "right" });
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

  // Earnings: each site once
  let y = 232;
  sectionTitle(doc, "EARNINGS", y);
  y += 14;
  doc.setFillColor(...rgb(BAND));
  doc.rect(M, y, RIGHT - M, 22, "F");
  const cx = { days: 300, hours: 372, rate: 462 };
  text(doc, "Site", M + 8, y + 15, { size: 9, bold: true, color: MUTED });
  text(doc, "Days", cx.days, y + 15, { size: 9, bold: true, color: MUTED, align: "right" });
  text(doc, "Hours", cx.hours, y + 15, { size: 9, bold: true, color: MUTED, align: "right" });
  text(doc, "Rate", cx.rate, y + 15, { size: 9, bold: true, color: MUTED, align: "right" });
  text(doc, "Amount", RIGHT - 8, y + 15, { size: 9, bold: true, color: MUTED, align: "right" });
  y += 22;
  const rows = [...s.sites.map((b) => ({
    label: b.label, days: String(b.days), hours: b.weighted ? `${Math.round(b.weighted * 100) / 100} h` : "-",
    rate: siteRateText(b, usd), amount: b.amount,
  })), ...s.lines.map((l) => ({ label: l.description, days: "", hours: "", rate: "", amount: l.amount }))];
  const rowH = rows.length > 12 ? 16 : 21;
  const font = rows.length > 12 ? 9 : 10;
  rows.forEach((r, i) => {
    if (i % 2 === 1) { doc.setFillColor(250, 251, 252); doc.rect(M, y, RIGHT - M, rowH, "F"); }
    const baseline = y + rowH / 2 + font / 3;
    text(doc, r.label.length > 34 ? `${r.label.slice(0, 33)}...` : r.label, M + 8, baseline, { size: font });
    if (r.days) text(doc, r.days, cx.days, baseline, { size: font, align: "right" });
    if (r.hours) text(doc, r.hours, cx.hours, baseline, { size: font, align: "right" });
    if (r.rate) text(doc, r.rate, cx.rate, baseline, { size: font - 1, align: "right" });
    text(doc, usd(r.amount), RIGHT - 8, baseline, { size: font, align: "right" });
    y += rowH;
  });
  text(doc, "Hours are weighted: overtime counted as normal hours (x1.5, x2, x3). See the next page.", M + 8, y + 12, { size: 7.5, color: MUTED });
  y += 16;
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

function rateText(b: Payslip["sites"][number]): string {
  const r = b.rates.map((x) => usd(x));
  return `${r.join(" / ")}${b.flat ? " /day" : " /h"}`;
}

/** One page of hours and rates by site. Each payslip (e.g. Atlantic) gets its own section under a line. */
function drawBreakdown(doc: Doc, slips: Payslip[]) {
  const first = slips[0]!;
  const { name } = periodText(first.month);
  const pageTop = () => {
    doc.setFillColor(...rgb(BRAND));
    doc.rect(0, 0, PAGE_W, 10, "F");
  };
  pageTop();
  text(doc, "HOURS & RATES BY SITE", M, 62, { size: 20, bold: true });
  text(doc, `${first.employee || "Not set"}  ·  ${name}`, M, 82, { size: 10.5, color: MUTED });

  const xs = { site: M, rate: M + 158, days: M + 186, worked: M + 232, x1: M + 272, x15: M + 316, x2: M + 358, x3: M + 398, weighted: M + 450, amt: RIGHT };
  const n = (v: number) => (v ? `${Math.round(v * 100) / 100}` : "-");
  const nh = (v: number) => (v ? `${n(v)} h` : "-");
  const rateText = (b: Payslip["sites"][number]) => {
    const lo = b.rates[0] ?? 0, hi = b.rates[b.rates.length - 1] ?? 0;
    return `${lo === hi ? usd(lo) : `${usd(lo)} - ${usd(hi)}`}${b.flat ? " /day" : " /h"}`;
  };
  const head = (y: number) => {
    doc.setFillColor(...rgb(BAND));
    doc.rect(M, y, RIGHT - M, 22, "F");
    const h = (t: string, x: number, align: "left" | "right" = "right") => text(doc, t, x, y + 15, { size: 7.5, bold: true, color: MUTED, align });
    h("SITE", xs.site + 6, "left"); h("RATE", xs.rate); h("DAYS", xs.days); h("WORKED", xs.worked); h("x1", xs.x1); h("x1.5", xs.x15); h("x2", xs.x2); h("x3", xs.x3); h("WEIGHTED", xs.weighted); h("MONEY", xs.amt - 6);
    return y + 22;
  };

  let y = 100;
  slips.forEach((s, idx) => {
    if (!s.sites.length) return;
    if (y > PAGE_H - 200) { doc.addPage(); pageTop(); y = 50; }
    if (idx > 0) { y += 14; hr(doc, y, INK, 1.2); y += 22; } else { hr(doc, y, LINE, 1); y += 22; }
    text(doc, s.payerName, M, y, { size: 13, bold: true, color: BRAND });
    y += 12;
    y = head(y);
    const total = { days: 0, hours: 0, x1: 0, x15: 0, x2: 0, x3: 0, weighted: 0, amount: 0 };
    for (const b of s.sites) {
      if (y > PAGE_H - 120) { doc.addPage(); pageTop(); y = head(50); }
      const rowH = 32;
      const mid = y + 14;
      const sub = (v: number, mult: number, x: number) => {
        if (!v) return text(doc, "-", x, mid, { size: 9.5, align: "right" });
        text(doc, n(v), x, mid, { size: 9.5, align: "right" });
        if (mult !== 1) text(doc, `= ${n(v * mult)}`, x, mid + 10, { size: 7, color: MUTED, align: "right" });
      };
      text(doc, b.label, xs.site + 6, mid, { size: 9.5, bold: true });
      text(doc, rateText(b), xs.rate + 4, mid, { size: 7.5, align: "right" });
      text(doc, String(b.days), xs.days, mid, { size: 9.5, align: "right" });
      text(doc, nh(b.hours), xs.worked, mid, { size: 9.5, bold: true, align: "right" });
      sub(b.x1, 1, xs.x1); sub(b.x15, 1.5, xs.x15); sub(b.x2, 2, xs.x2); sub(b.x3, 3, xs.x3);
      text(doc, nh(b.weighted), xs.weighted, mid, { size: 9.5, bold: true, align: "right" });
      text(doc, usd(b.amount), xs.amt - 6, mid, { size: 9.5, bold: true, color: GROSS, align: "right" });
      y += rowH;
      hr(doc, y, LINE, 0.5);
      total.days += b.days; total.hours += b.hours; total.x1 += b.x1; total.x15 += b.x15; total.x2 += b.x2; total.x3 += b.x3; total.weighted += b.weighted; total.amount += b.amount;
    }
    hr(doc, y + 2, INK, 1);
    const ty = y + 20;
    text(doc, "TOTAL", xs.site + 6, ty, { size: 10, bold: true });
    text(doc, String(total.days), xs.days, ty, { size: 10, bold: true, align: "right" });
    text(doc, nh(total.hours), xs.worked, ty, { size: 10, bold: true, align: "right" });
    text(doc, n(total.x1), xs.x1, ty, { size: 10, bold: true, align: "right" });
    text(doc, n(total.x15), xs.x15, ty, { size: 10, bold: true, align: "right" });
    text(doc, n(total.x2), xs.x2, ty, { size: 10, bold: true, align: "right" });
    text(doc, n(total.x3), xs.x3, ty, { size: 10, bold: true, align: "right" });
    text(doc, nh(total.weighted), xs.weighted, ty, { size: 10, bold: true, align: "right" });
    text(doc, usd(total.amount), xs.amt - 6, ty, { size: 10, bold: true, color: GROSS, align: "right" });
    y = ty + 14;
    if (Math.abs(total.amount - s.gross) > 0.005) {
      text(doc, `Gross pay on this payslip is ${usd(s.gross)} (includes an adjustment to match your real payslip).`, M, y + 4, { size: 8, color: MUTED });
      y += 14;
    }
  });
  y += 20;
  if (y > PAGE_H - 130) { doc.addPage(); pageTop(); y = 60; }
  const note = doc.splitTextToSize(
    "WORKED is the hours you actually worked at the site. x1, x1.5, x2 and x3 split those hours by pay multiple, and the small \"= \" figure under each is that time counted as normal hours (for example 7 h at x1.5 = 10.5 normal hours). WEIGHTED is all of that added together. On a flat day-rate site the rate shown is the day rate. MONEY is what you earned at the site before tax and deductions.",
    RIGHT - M,
  ) as string[];
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...rgb(MUTED));
  doc.text(note, M, y);
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

  const combined = combinePayslips(slips);
  if (combined) drawSlip(doc, combined, on);
  if (slips.some((x) => x.sites.length)) { doc.addPage(); drawBreakdown(doc, slips); }
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
