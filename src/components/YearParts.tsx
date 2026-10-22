import { useEffect, useRef } from "react";
import { MONTHS, hoursText, money } from "../format";
import { useStore } from "../store";
import { SITE_COLORS, siteColorIndex } from "../siteColor";
import { payerLabel } from "../model";
import { runningTotal, type YearMonth, type YearReport, type YearSection, type YearSite } from "../yearReport";

const dash = "–";
const m$ = (v: number | null) => (v === null ? dash : money(v));
const h$ = (v: number) => (v === 0 ? dash : `${hoursText(v)} h`);

/** Every site with its days, hours worked, hours paid for (overtime counted at its multiple) and pay for the year. */
export function YearSites({ sites, year }: { sites: YearSite[]; year: number }) {
  const { data } = useStore();
  const total = sites.reduce((t, s) => ({ days: t.days + s.days, hours: t.hours + s.hours, weighted: t.weighted + s.weighted, amount: t.amount + s.amount }), { days: 0, hours: 0, weighted: 0, amount: 0 });
  if (sites.length === 0) return <p className="muted">No days logged in {year} yet.</p>;
  return (
    <>
      <div className="ysite-total" aria-label="All sites">
        <div><span>Days</span><strong>{total.days}</strong></div>
        <div><span>Worked</span><strong>{hoursText(total.hours)} h</strong></div>
        <div><span>Paid hours</span><strong>{hoursText(total.weighted)} h</strong></div>
        <div><span>Earned</span><strong className="c-gross">{money(total.amount)}</strong></div>
      </div>
      <ul className="ysites">
        {sites.map((s) => {
          const share = total.amount > 0 ? s.amount / total.amount : 0;
          const hex = s.site === "Other jobs" ? "var(--muted)" : SITE_COLORS[siteColorIndex(data, s.site)]!.hex;
          return (
            <li key={s.site}>
              <details>
                <summary>
                  <span className="ysite-name"><i className="sw" style={{ background: hex }} />{s.site}<span className="muted small"> · {payerLabel(data.payerNames, s.group)}</span></span>
                  <span className="ysite-amount c-gross">{money(s.amount)}</span>
                  <span className="ysite-bar" aria-hidden="true"><i style={{ width: `${Math.max(share * 100, s.amount > 0 ? 2 : 0)}%`, background: hex }} /></span>
                  <span className="ysite-stats">
                    <span><b>{s.days}</b> {s.days === 1 ? "day" : "days"}</span>
                    <span><b>{hoursText(s.hours)}</b> h worked</span>
                    <span><b>{hoursText(s.weighted)}</b> h paid</span>
                    <span>{Math.round(share * 1000) / 10}%</span>
                  </span>
                </summary>
                <table className="ysite-table">
                  <thead><tr><th>Month</th><th className="num">Days</th><th className="num">Worked</th><th className="num">Paid h</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {s.byMonth.map((b, i) => (b.days > 0 || b.amount > 0) && (
                      <tr key={i}><td>{MONTHS[i]?.slice(0, 3)}</td><td className="num">{b.days}</td><td className="num">{hoursText(b.hours)}</td><td className="num">{hoursText(b.weighted)}</td><td className="num">{money(b.amount)}</td></tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Total</td><td className="num">{s.days}</td><td className="num">{hoursText(s.hours)}</td><td className="num">{hoursText(s.weighted)}</td><td className="num">{money(s.amount)}</td></tr></tfoot>
                </table>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}

type Row = { label: string; cells: Array<string>; total?: string; avg?: string; strong?: boolean; dotted?: boolean };

function rowsOf(months: YearMonth[]): { income: Row[]; taxes: Row[]; hours: Row[] } {
  const pick = (f: (m: YearMonth) => number | null) => months.map(f);
  const sum = (v: Array<number | null>) => v.reduce<number>((t, x) => t + (x ?? 0), 0);
  const withIncome = months.filter((m) => m.gross > 0).length || 1;
  const fmt = (v: Array<number | null>) => v.map((x, i) => (months[i]!.gross === 0 && months[i]!.days === 0 && (x === 0 || x === null) ? dash : m$(x)));
  const avg = (v: Array<number | null>) => money(sum(v) / withIncome);
  const gross = pick((m) => m.gross), net = pick((m) => m.net), paye = pick((m) => m.paye), nis = pick((m) => m.nis), sur = pick((m) => m.surcharge);
  const ded = months.map((m) => (m.paye === null || m.nis === null || m.surcharge === null ? null : m.paye + m.nis + m.surcharge));
  const ytd = (v: Array<number | null>) => runningTotal(v).map((x, i) => (months[i]!.gross === 0 && months[i]!.days === 0 && x === 0 ? dash : money(x)));
  const days = pick((m) => m.days), hrs = pick((m) => m.hours), paid = pick((m) => m.weighted);
  const num = (v: Array<number | null>, f: (n: number) => string) => v.map((x) => (x === 0 || x === null ? dash : f(x)));
  return {
    income: [
      { label: "Gross", cells: fmt(gross), total: money(sum(gross)), avg: avg(gross), strong: true },
      { label: "Net", cells: fmt(net), total: money(sum(net)), avg: avg(net) },
      { label: "Gross to date", cells: ytd(gross), dotted: true },
      { label: "Net to date", cells: ytd(net) },
    ],
    taxes: [
      { label: "PAYE", cells: fmt(paye), total: money(sum(paye)), avg: avg(paye) },
      { label: "Health surcharge", cells: fmt(sur), total: money(sum(sur)), avg: avg(sur) },
      { label: "NIS", cells: fmt(nis), total: money(sum(nis)), avg: avg(nis) },
      { label: "Total deductions", cells: fmt(ded), total: money(sum(ded)), avg: avg(ded), strong: true, dotted: true },
      { label: "PAYE to date", cells: ytd(paye) },
      { label: "NIS to date", cells: ytd(nis) },
    ],
    hours: [
      { label: "Hours (paid)", cells: num(paid, (n) => hoursText(n)), total: hoursText(sum(paid)), avg: hoursText(Math.round((sum(paid) / withIncome) * 100) / 100), strong: true },
      { label: "Hours worked", cells: num(hrs, (n) => hoursText(n)), total: hoursText(sum(hrs)), avg: hoursText(Math.round((sum(hrs) / withIncome) * 100) / 100) },
      { label: "Days", cells: num(days, (n) => String(n)), total: String(sum(days)), avg: (Math.round((sum(days) / withIncome) * 10) / 10).toString() },
      { label: "Paid hours to date", cells: runningTotal(paid).map((x, i) => (months[i]!.days === 0 && x === 0 ? dash : hoursText(x))), dotted: true },
      { label: "Days to date", cells: runningTotal(days).map((x, i) => (months[i]!.days === 0 && x === 0 ? dash : String(x))) },
      { label: "Most worked site", cells: months.map((m) => m.topSite ?? dash) },
    ],
  };
}

function Block({ title, rows, hasTotals }: { title: string; rows: Row[]; hasTotals: boolean }) {
  return (
    <tbody>
      <tr className="yt-block"><th scope="row">{title}</th><td colSpan={hasTotals ? 14 : 12} /></tr>
      {rows.map((r) => (
        <tr key={r.label} className={`${r.strong ? "strong" : ""} ${r.dotted ? "dotted" : ""}`}>
          <th scope="row">{r.label}</th>
          {r.cells.map((c, i) => <td key={i} className={c === dash ? "muted" : ""}>{c}</td>)}
          {hasTotals && <td className="tot">{r.total ?? ""}</td>}
          {hasTotals && <td className="tot">{r.avg ?? ""}</td>}
        </tr>
      ))}
    </tbody>
  );
}

/** One payslip group (or all sites) laid out like the yearly spreadsheet: Income, Taxes, Hours and days by month. */
export function YearTable({ section, open }: { section: YearSection; open?: boolean }) {
  const { income, taxes, hours } = rowsOf(section.months);
  const gross = section.months.reduce((t, m) => t + m.gross, 0);
  const unknown = section.months.some((m) => m.net === null);
  const scroller = useRef<HTMLDivElement>(null);
  // Start the table showing the latest months with income instead of January.
  const last = section.months.reduce((l, m, i) => (m.gross > 0 || m.days > 0 ? i : l), 0);
  const jump = () => {
    const el = scroller.current;
    const th = el?.querySelectorAll<HTMLElement>("thead th")[Math.max(1, last - 1) + 1];
    if (el && th && el.scrollLeft < 12) el.scrollLeft = Math.max(0, th.offsetLeft - 138);
  };
  useEffect(() => { const id = window.setTimeout(jump, 60); return () => window.clearTimeout(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <details className="ytable" open={open} onToggle={() => window.setTimeout(jump, 30)}>
      <summary><span>{section.title}</span><span className="c-gross">{money(gross)}</span></summary>
      <div className="yt-scroll" ref={scroller}>
        <table>
          <thead>
            <tr><th scope="col" />{MONTHS.map((m) => <th key={m} scope="col">{m.slice(0, 3)}</th>)}<th scope="col" className="tot">Total</th><th scope="col" className="tot">Average</th></tr>
          </thead>
          <Block title="Income" rows={income} hasTotals />
          <Block title="Taxes" rows={taxes} hasTotals />
          <Block title="Hours and days" rows={hours} hasTotals />
        </table>
      </div>
      {unknown && <p className="muted small">A “–” in the taxes means that month's tax was worked out on all payslips together. See “All sites” for it.</p>}
      <p className="muted small">Hours (paid) count overtime at its multiple: an hour at x1.5 counts as 1.5. Averages are per month with income.</p>
    </details>
  );
}

export function YearByPayslip({ report }: { report: YearReport }) {
  return (
    <>
      <YearTable section={report.all} open />
      {report.groups.length > 1 && report.groups.map((g) => <YearTable key={g.id} section={g} />)}
    </>
  );
}
