import { useMemo, useState } from "react";
import { correctionKey, overridesFor } from "../model";
import { computeMonth, valueOn } from "../engine";
import { MONTHS, WEEKDAYS, daysOfMonth, hoursText, money, monthLabel, shiftMonth, todayISO } from "../format";
import { useStore } from "../store";
import { DayEditor } from "./DayEditor";

const DAY_MS = 86_400_000;

export function MonthScreen({ goTo }: { goTo: (tab: "settings" | "backup") => void }) {
  const { data, update } = useStore();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [editing, setEditing] = useState<string | null>(null);

  const result = useMemo(
    () => computeMonth(month, data.entries, data.history, overridesFor(data, month)),
    [month, data],
  );

  const setCorrection = (payer: string, field: "gross" | "paye", raw: string) =>
    update((d) => {
      const key = correctionKey(month, payer);
      const next = { ...(d.corrections ?? {}) };
      const merged = { ...next[key], [field]: raw === "" ? undefined : Number(raw) };
      if (merged.gross === undefined && merged.paye === undefined) delete next[key];
      else next[key] = merged;
      return { ...d, corrections: next };
    });
  const days = daysOfMonth(month);
  const today = todayISO();
  const noSites = Object.keys(valueOn(data.history.sites, `${month}-01`)).length === 0;
  const lastBackup = data.lastBackupAt ? Date.parse(data.lastBackupAt) : 0;
  const backupDue = data.entries.length > 0 && Date.now() - lastBackup > 30 * DAY_MS;
  const year = Number(month.slice(0, 4));

  return (
    <>
      <header className="bar">
        <button className="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
        <h1>
          <select
            aria-label="Month"
            value={month.slice(5)}
            onChange={(e) => setMonth(`${year}-${e.target.value}`)}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>{" "}
          {year}
        </h1>
        <button className="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
      </header>

      {noSites && (
        <div className="notice">
          <strong>Add your sites and rates first.</strong>
          <p>Nothing is saved anywhere except this phone. Set up the sites you work at, or restore a backup.</p>
          <div className="row">
            <button className="primary" onClick={() => goTo("settings")}>Set up rates</button>
            <button onClick={() => goTo("backup")}>Restore a backup</button>
          </div>
        </div>
      )}

      {backupDue && (
        <div className="notice warn">
          <strong>Back up your data</strong>
          <p>{data.lastBackupAt ? "It has been over 30 days since your last backup." : "You have not backed up yet."} If this phone is lost or its browser data cleared, your entries are gone.</p>
          <button onClick={() => goTo("backup")}>Back up now</button>
        </div>
      )}

      <section className="card summary" aria-label={`${monthLabel(month)} summary`}>
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

      {result.payers.length > 0 && (
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
      )}

      <ul className="days">
        {days.map((date) => {
          const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
          const priced = result.entries.filter((e) => e.entry.date === date);
          const total = priced.reduce((s, e) => s + e.pay.total, 0);
          return (
            <li key={date}>
              <button
                className={`day ${wd === 0 || wd === 6 ? "weekend" : ""} ${date === today ? "today" : ""}`}
                onClick={() => setEditing(date)}
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

      {editing && <DayEditor date={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

