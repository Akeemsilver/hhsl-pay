import { WEEKDAYS, hoursText, money } from "../format";
import { correctionKey } from "../model";
import { useStore } from "../store";
import type { MonthResult } from "../engine";
import type { Entry } from "../model";

export function MonthSummary({ result, label }: { result: MonthResult<Entry>; label: string }) {
  const { data } = useStore();
  return (
    <section className="card summary" aria-label={`${label} summary`}>
      <div className="big">
        <span className="label">Gross</span>
        <span className="value">{money(result.gross)}</span>
      </div>
      <dl>
        <div><dt>Net</dt><dd>{money(result.net)}</dd></div>
        <div><dt>PAYE</dt><dd>{money(result.paye)}</dd></div>
        <div><dt>NIS</dt><dd>{money(result.nis)}</dd></div>
        <div><dt>Surcharge</dt><dd>{money(result.surcharge)}</dd></div>
      </dl>
      {result.payers.length > 1 && (
        <ul className="payers">
          {result.payers.map((p) => (
            <li key={p.payer}>
              <span>{data.payerNames[p.payer] ?? p.payer}{p.corrected && " ✎"}</span>
              <span>{hoursText(p.hours)} h · {money(p.gross)} → {money(p.net)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CorrectionBox({ month, result }: { month: string; result: MonthResult<Entry> }) {
  const { data, update } = useStore();
  if (result.payers.length === 0) return null;

  const setCorrection = (payer: string, field: "gross" | "paye", raw: string) =>
    update((d) => {
      const key = correctionKey(month, payer);
      const next = { ...(d.corrections ?? {}) };
      const merged = { ...next[key], [field]: raw === "" ? undefined : Number(raw) };
      if (merged.gross === undefined && merged.paye === undefined) delete next[key];
      else next[key] = merged;
      return { ...d, corrections: next };
    });

  return (
    <details className="card correction">
      <summary>Payslip says something different?</summary>
      <p className="muted small">Enter the actual figures from your payslip. Leave blank to use the calculated ones. Net pay is recalculated from them.</p>
      {result.payers.map((p) => {
        const o = data.corrections?.[correctionKey(month, p.payer)];
        return (
          <fieldset key={p.payer}>
            <legend>{data.payerNames[p.payer] ?? p.payer}</legend>
            <div className="grid2">
              <label>Actual gross
                <input type="number" inputMode="decimal" step="any" placeholder={String(Math.round(p.gross * 100) / 100)}
                  value={o?.gross ?? ""} onChange={(e) => setCorrection(p.payer, "gross", e.target.value)} />
              </label>
              <label>Actual PAYE
                <input type="number" inputMode="decimal" step="any" placeholder="calculated"
                  value={o?.paye ?? ""} onChange={(e) => setCorrection(p.payer, "paye", e.target.value)} />
              </label>
            </div>
          </fieldset>
        );
      })}
    </details>
  );
}

export function DayList({ days, result, today, onPick }: { days: string[]; result: MonthResult<Entry>; today: string; onPick: (d: string) => void }) {
  return (
    <ul className="days">
      {days.map((date) => {
        const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
        const priced = result.entries.filter((e) => e.entry.date === date);
        const total = priced.reduce((s, e) => s + e.pay.total, 0);
        return (
          <li key={date}>
            <button
              className={`day ${wd === 0 || wd === 6 ? "weekend" : ""} ${date === today ? "today" : ""}`}
              onClick={() => onPick(date)}
              aria-label={`${WEEKDAYS[wd]} ${Number(date.slice(8))}, ${priced.length ? money(total) : "no entry"}`}
            >
              <span className="dow">{WEEKDAYS[wd]}</span>
              <span className="dom">{Number(date.slice(8))}</span>
              <span className="entries">
                {priced.length === 0 && <span className="muted">—</span>}
                {priced.map(({ entry, pay }) => (
                  <span key={entry.id} className="chip">
                    {entry.site}
                    {entry.hours > 0 && ` · ${hoursText(entry.hours)}h`}
                    {entry.lead && " · lead"}
                    {entry.holiday && " · hol"}
                    {pay.total === 0 && " ⚠"}
                  </span>
                ))}
              </span>
              <span className="amount">{priced.length ? money(total) : ""}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Month grid, Sunday first. Each cell shows the day's total and the site(s) worked. */
export function CalendarGrid({ month, days, result, today, onPick, payerOrder }: {
  month: string; days: string[]; result: MonthResult<Entry>; today: string; onPick: (d: string) => void; payerOrder: string[];
}) {
  const { data } = useStore();
  const lead = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const siteOf = (name: string) => {
    for (const v of data.history.sites) {
      const hit = Object.entries(v.value).find(([k]) => k.toLowerCase() === name.toLowerCase());
      if (hit) return hit[1];
    }
    return undefined;
  };
  return (
    <section className="card calendar" aria-label="Calendar">
      <div className="cal-head" aria-hidden="true">
        {WEEKDAYS.map((w) => <span key={w}>{w.slice(0, 2)}</span>)}
      </div>
      <div className="cal-grid">
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} className="cal-blank" />)}
        {days.map((date) => {
          const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
          const priced = result.entries.filter((e) => e.entry.date === date);
          const total = priced.reduce((s, e) => s + e.pay.total, 0);
          const first = priced[0];
          const tone = first ? Math.max(0, payerOrder.indexOf(siteOf(first.entry.site)?.payer ?? "")) % 4 : 0;
          return (
            <button
              key={date}
              className={`cal-cell ${wd === 0 || wd === 6 ? "weekend" : ""} ${date === today ? "today" : ""} ${priced.length ? `worked tone${tone}` : ""}`}
              onClick={() => onPick(date)}
              aria-label={`${WEEKDAYS[wd]} ${Number(date.slice(8))}, ${priced.length ? money(total) : "no entry"}`}
            >
              <span className="n">{Number(date.slice(8))}</span>
              {first && (
                <>
                  <span className="amt">${Math.round(total).toLocaleString("en-US")}</span>
                  <span className="cal-site">{first.entry.site.slice(0, 5)}{priced.length > 1 ? ` +${priced.length - 1}` : ""}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
