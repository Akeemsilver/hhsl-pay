import { useEffect, useState } from "react";
import { valueOn, type TaxRules } from "../engine";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";
import { BandTable, NumInput, versionLabel } from "../components/settingsParts";
import { applyFrom, diffObject } from "../rateEdit";
import { todayISO } from "../format";

export function TaxPage() {
  const { data, update } = useStore();
  const versions = data.history.tax;
  const [asOf, setAsOf] = useState(todayISO());
  const saved = valueOn(versions, asOf < versions[0]!.effectiveFrom ? versions[0]!.effectiveFrom : asOf);
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState<TaxRules>(saved);
  useEffect(() => setDraft(JSON.parse(savedKey) as TaxRules), [savedKey]);
  const dirty = JSON.stringify(draft) !== savedKey;
  const [from, setFrom] = useState(todayISO());
  const setTax = (fn: (t: TaxRules) => TaxRules) => setDraft((t) => fn(t));

  const save = () => {
    const patch = diffObject(saved, draft);
    update((d) => ({ ...d, history: { ...d.history, tax: applyFrom(d.history.tax, from, (t) => ({ ...t, ...patch })) } }));
    // Show the rules that now apply from that day, so a future-dated change is visible.
    setAsOf(from > todayISO() ? from : todayISO());
    setDraft({ ...saved, ...patch });
  };

  return (
    <>
      <PageHeader title="NIS & tax" />
      <p className="muted pad">Edit the rules, then tap Save and choose “Take effect from”. That is today unless you pick another day, for example the 1st of next month. Earlier months keep calculating with the old rules.</p>

      {asOf !== todayISO() && (
        <p className="notice">Showing the rules in force on <strong>{asOf}</strong>. <button className="link" onClick={() => setAsOf(todayISO())}>Back to today</button></p>
      )}

      <section className="card">
        <h2>NIS</h2>
        <p className="muted small">Weekly NIS by gross pay. The row at or below your gross applies, multiplied by the Mondays in the month. Rows are numbered so you can see which one you are editing.</p>
        <BandTable title="NIS bands (weekly)" firstLabel="Gross from" secondLabel="Weekly NIS" open bands={draft.nisBands} onChange={(b) => setTax((t) => ({ ...t, nisBands: b }))} />
        <label>NIS relief before tax (%)
          <NumInput label="NIS relief percent" value={Math.round(draft.nisRelief * 10000) / 100} onChange={(v) => setTax((t) => ({ ...t, nisRelief: (v ?? 0) / 100 }))} />
        </label>
      </section>

      <section className="card">
        <h2>PAYE</h2>
        <div className="grid2">
          <label>Monthly tax-free allowance<NumInput label="Monthly allowance" value={draft.monthlyAllowance} onChange={(v) => setTax((t) => ({ ...t, monthlyAllowance: v ?? 0 }))} /></label>
          <label>Tax rate (%)<NumInput label="Tax rate percent" value={Math.round(draft.rate * 10000) / 100} onChange={(v) => setTax((t) => ({ ...t, rate: (v ?? 0) / 100 }))} /></label>
          <label>Annual threshold<NumInput label="Annual threshold" value={draft.annualThreshold} onChange={(v) => setTax((t) => ({ ...t, annualThreshold: v ?? 0 }))} /></label>
        </div>
      </section>

      <section className="card">
        <h2>Health surcharge</h2>
        <BandTable title="Health surcharge bands" firstLabel="Gross from" secondLabel="Amount" bands={draft.surchargeBands} onChange={(b) => setTax((t) => ({ ...t, surchargeBands: b }))} />
        <label>Multiplier in months with five Mondays<NumInput label="Five Monday factor" value={draft.fiveMondayFactor} onChange={(v) => setTax((t) => ({ ...t, fiveMondayFactor: v ?? 1 }))} /></label>
      </section>

      {dirty && (
        <div className="save-bar" role="group" aria-label="Save NIS and tax changes">
          <div className="save-row">
            <label>Take effect from
              <input type="date" aria-label="NIS and tax take effect from" value={from} onChange={(e) => setFrom(e.target.value || todayISO())} />
            </label>
            <button onClick={() => setDraft(saved)}>Discard</button>
            <button className="primary" onClick={save}>Save</button>
          </div>
          <p className="muted small">{from === todayISO() ? "Starts today; earlier months keep the old rules." : from < todayISO() ? "Past date: months since then are recalculated with these rules." : "Nothing changes until that day."}</p>
        </div>
      )}

      <details className="card history">
        <summary>Rule history (advanced)</summary>
        <p className="muted small">Each saved change with a “Take effect from” date starts a new set of rules on that day. Older months always use the set in force on their date.</p>
        <label>Show the rules in force on
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || todayISO())} />
        </label>
        <ul className="plain small">
          {versions.map((v) => (
            <li key={v.effectiveFrom} className="row">
              <span>{versionLabel(v, versions)}</span>
              <button className="danger" disabled={versions.length < 2} onClick={() => confirm(`Delete "${versionLabel(v, versions)}"? Those months will use the rules before them.`) && update((d) => ({ ...d, history: { ...d.history, tax: d.history.tax.filter((x) => x.effectiveFrom !== v.effectiveFrom) } }))}>Delete</button>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
