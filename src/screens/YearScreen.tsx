import { useMemo, useState } from "react";
import { annualTaxEstimate, computeMonth, valueOn } from "../engine";
import { MONTHS, money, todayISO } from "../format";
import { overridesFor } from "../model";
import { useStore } from "../store";
import { TopBar } from "../components/TopBar";
import { BackIcon, ForwardIcon } from "../components/Icons";

export function YearScreen() {
  const { data } = useStore();
  const [year, setYear] = useState(Number(todayISO().slice(0, 4)));

  const months = useMemo(
    () => MONTHS.map((_, i) => computeMonth(`${year}-${String(i + 1).padStart(2, "0")}`, data.entries, data.history, overridesFor(data, `${year}-${String(i + 1).padStart(2, "0")}`))),
    [year, data],
  );
  const total = (pick: (m: (typeof months)[number]) => number) => months.reduce((s, m) => s + pick(m), 0);
  const gross = total((m) => m.gross);
  const nis = total((m) => m.nis);
  const paye = total((m) => m.paye);
  const rules = valueOn(data.history.tax, `${year}-12-31`);
  const est = annualTaxEstimate(gross, nis, paye, rules);
  const max = Math.max(1, ...months.map((m) => m.gross));
  const progress = Math.min(1, gross / rules.annualThreshold);

  return (
    <>
      <TopBar title="Year" />
      <div className="monthbar">
        <button className="icon" onClick={() => setYear(year - 1)} aria-label="Previous year"><BackIcon /></button>
        <div className="monthname">{year}</div>
        <button className="icon" onClick={() => setYear(year + 1)} aria-label="Next year"><ForwardIcon /></button>
      </div>

      <section className="card summary">
        <div className="big"><span className="label">Gross for the year</span><span className="value">{money(gross)}</span></div>
        <dl>
          <div><dt>Net</dt><dd>{money(total((m) => m.net))}</dd></div>
          <div><dt>PAYE paid</dt><dd>{money(paye)}</dd></div>
          <div><dt>NIS</dt><dd>{money(nis)}</dd></div>
          <div><dt>Surcharge</dt><dd>{money(total((m) => m.surcharge))}</dd></div>
        </dl>
      </section>

      <section className="card">
        <h2>Year-end tax estimate</h2>
        <div className="meter" role="img" aria-label={`${Math.round(progress * 100)}% of the ${money(rules.annualThreshold)} threshold`}>
          <div style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="muted">
          {gross <= rules.annualThreshold
            ? `${money(rules.annualThreshold - gross)} left before the ${money(rules.annualThreshold)} threshold.`
            : `Over the ${money(rules.annualThreshold)} threshold by ${money(gross - rules.annualThreshold)}.`}
        </p>
        {gross > 0 && (
          <p>
            Estimated tax due <strong>{money(est.taxDue)}</strong> · PAYE paid <strong>{money(paye)}</strong> ·{" "}
            {est.refund >= 0 ? <>possible refund <strong className="good">{money(est.refund)}</strong></> : <>possibly owing <strong className="bad">{money(-est.refund)}</strong></>}
          </p>
        )}
        <p className="muted small">An estimate only. Your employer and the tax office decide the real figures.</p>
      </section>

      <section className="card">
        <h2>Gross by month</h2>
        <svg viewBox="0 0 360 140" className="chart" role="img" aria-label="Gross income per month">
          {months.map((m, i) => {
            const h = (m.gross / max) * 100;
            return (
              <g key={m.month}>
                <rect x={i * 30 + 4} y={110 - h} width="22" height={Math.max(h, m.gross > 0 ? 1 : 0)} rx="3" className="bar-rect" />
                <text x={i * 30 + 15} y="128" textAnchor="middle" className="axis">{MONTHS[i]?.slice(0, 1)}</text>
              </g>
            );
          })}
        </svg>
      </section>

      <section className="card">
        <h2>Month by month</h2>
        <table>
          <thead><tr><th>Month</th><th>Gross</th><th>PAYE</th><th>Net</th></tr></thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={m.month} className={m.gross === 0 ? "muted" : ""}>
                <td>{MONTHS[i]?.slice(0, 3)}</td><td>{money(m.gross)}</td><td>{money(m.paye)}</td><td>{money(m.net)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td>{money(gross)}</td><td>{money(paye)}</td><td>{money(total((m) => m.net))}</td></tr></tfoot>
        </table>
      </section>
    </>
  );
}
