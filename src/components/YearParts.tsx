import { MONTHS, hoursText, money } from "../format";
import { averageThrough } from "../averages";
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

/** One payslip group as small, roomy tables with the months down the side: Income, Average a month, Taxes, Year to date, Hours and days. */
export function YearTable({ section, open }: { section: YearSection; open?: boolean }) {
  const ms = section.months;
  const has = (m: YearMonth) => m.gross > 0 || m.days > 0;
  const latest = ms.reduce((l, m, i) => (has(m) ? i : l), -1);
  const gross = ms.map((m) => m.gross);
  const net = ms.map((m) => m.net);
  const unknown = ms.some((m) => m.net === null);
  const sum = (v: Array<number | null>) => v.reduce<number>((t, x) => t + (x ?? 0), 0);
  const money0 = (m: YearMonth, v: number | null) => (has(m) ? m$(v) : dash);
  const ded = (m: YearMonth) => (m.paye === null || m.nis === null || m.surcharge === null ? null : m.paye + m.nis + m.surcharge);
  const dedToDate = runningTotal(ms.map(ded));
  const grossToDate = runningTotal(gross);
  const netToDate = runningTotal(net);
  // An average needs every month up to it, so a month whose net could not be told has no average net.
  const avgNet = (i: number) => (net.slice(0, i + 1).some((v) => v === null) ? null : averageThrough(net as number[], i));
  const rows = (cells: (m: YearMonth, i: number) => Array<string | number>) =>
    ms.map((m, i) => (
      <tr key={m.month} className={has(m) ? "" : "idle"}>
        <th scope="row">{MONTHS[i]?.slice(0, 3)}</th>
        {cells(m, i).map((c, k) => <td key={k}>{c}</td>)}
      </tr>
    ));
  return (
    <details className="ytable" open={open}>
      <summary onClick={(e) => { const d = e.currentTarget.parentElement as HTMLDetailsElement; if (d.open) requestAnimationFrame(() => d.scrollIntoView({ block: "nearest" })); }}>
        <span>{section.title}</span><span className="yt-end"><span className="c-gross">{money(sum(gross))}</span><span className="yt-caret" aria-hidden="true" /></span>
      </summary>

      <h3>Income</h3>
      <table className="ym">
        <thead><tr><th>Month</th><th className="c-gross">Gross</th><th className="c-net">Net</th></tr></thead>
        <tbody>{rows((m) => [money0(m, m.gross), money0(m, m.net)])}</tbody>
        <tfoot><tr><th scope="row">Total</th><td>{money(sum(gross))}</td><td>{money(sum(net))}</td></tr></tfoot>
      </table>

      <h3>Average a month</h3>
      <table className="ym">
        <thead><tr><th>Up to</th><th className="c-gross">Avg gross</th><th className="c-net">Avg net</th></tr></thead>
        <tbody>{rows((_m, i) => [i <= latest ? money(averageThrough(gross, i)) : dash, i <= latest ? m$(avgNet(i)) : dash])}</tbody>
      </table>
      <p className="muted small">Each month's average counts January up to that month, so it does not change when later months do.</p>

      <h3>Taxes</h3>
      <table className="ym">
        <thead><tr><th>Month</th><th className="c-paye">PAYE</th><th>NIS</th><th>Surcharge</th></tr></thead>
        <tbody>{rows((m) => [money0(m, m.paye), money0(m, m.nis), money0(m, m.surcharge)])}</tbody>
        <tfoot>
          <tr><th scope="row">Total</th><td>{money(sum(ms.map((m) => m.paye)))}</td><td>{money(sum(ms.map((m) => m.nis)))}</td><td>{money(sum(ms.map((m) => m.surcharge)))}</td></tr>
        </tfoot>
      </table>
      <p className="muted small">All taxes taken off this year: <strong>{money(sum(ms.map(ded)))}</strong></p>

      <h3>Year to date</h3>
      <table className="ym">
        <thead><tr><th>Month</th><th className="c-gross">Gross</th><th className="c-net">Net</th><th>Taxes</th></tr></thead>
        <tbody>{rows((_m, i) => (i <= latest ? [money(grossToDate[i]!), money(netToDate[i]!), money(dedToDate[i]!)] : [dash, dash, dash]))}</tbody>
      </table>

      <h3>Hours and days</h3>
      <table className="ym">
        <thead><tr><th>Month</th><th>Paid h</th><th>Worked h</th><th>Days</th></tr></thead>
        <tbody>{rows((m) => [m.weighted ? hoursText(m.weighted) : dash, m.hours ? hoursText(m.hours) : dash, m.days || dash])}</tbody>
        <tfoot><tr><th scope="row">Total</th><td>{hoursText(sum(ms.map((m) => m.weighted)))}</td><td>{hoursText(sum(ms.map((m) => m.hours)))}</td><td>{sum(ms.map((m) => m.days))}</td></tr></tfoot>
      </table>
      <p className="muted small">Paid h counts overtime at its multiple: an hour at x1.5 counts as 1.5.</p>
      {unknown && <p className="muted small">A “–” in net or taxes means that month's tax was worked out on all payslips together, so it is not split per payslip.</p>}
    </details>
  );
}

/** One table set for each payslip group. */
export function YearByPayslip({ report }: { report: YearReport }) {
  return <>{report.groups.map((g) => <YearTable key={g.id} section={g} />)}</>;
}
