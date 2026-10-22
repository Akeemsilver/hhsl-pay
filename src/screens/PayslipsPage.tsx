import { useState } from "react";
import { isCombined, payerLabel, otherPayerId, setTaxModeFrom } from "../model";
import { MONTHS, todayISO } from "../format";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";

export function PayslipsPage() {
  const { data, update } = useStore();
  const [newPayer, setNewPayer] = useState("");
  const payers = { ...data.payerNames };
  for (const v of data.history.sites) for (const s of Object.values(v.value)) payers[s.payer] ??= payerLabel(data.payerNames, s.payer);
  const thisMonth = todayISO().slice(0, 7);
  const [from, setFrom] = useState(thisMonth);
  const combinedNow = isCombined(data, from);
  return (
    <>
      <PageHeader title="Payslips" />
      <h2 className="section-title">How tax is worked out</h2>
      <section className="card">
        <div className="segmented" role="group" aria-label="Tax method">
          <button aria-pressed={!combinedNow} className={!combinedNow ? "on" : ""} onClick={() => update((d) => setTaxModeFrom(d, from, false))}>Split</button>
          <button aria-pressed={combinedNow} className={combinedNow ? "on" : ""} onClick={() => update((d) => setTaxModeFrom(d, from, true))}>Combined</button>
        </div>
        <label>From month
          <input type="month" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <p className="muted small"><strong>Split:</strong> each payslip below pays its own PAYE, NIS and health surcharge on its own income, and you get a separate payslip page for each. <strong>Combined:</strong> all income is added up and taxed once, on one payslip. The choice applies from the month shown onwards; earlier months keep theirs.</p>
        {(data.taxMode ?? []).length > 0 && (
          <ul className="plain small">
            {(data.taxMode ?? []).map((t) => (
              <li key={t.effectiveFrom} className="row">
                <span>From {MONTHS[Number(t.effectiveFrom.slice(5, 7)) - 1]} {t.effectiveFrom.slice(0, 4)}: <strong>{t.combined ? "Combined" : "Split"}</strong></span>
                <button aria-label={`Remove ${t.effectiveFrom}`} onClick={() => update((d) => ({ ...d, taxMode: (d.taxMode ?? []).filter((x) => x.effectiveFrom !== t.effectiveFrom) }))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <h2 className="section-title">Other jobs</h2>
      <section className="card">
        <label>Other jobs are paid on
          <select aria-label="Other jobs payslip" value={otherPayerId(data)} onChange={(e) => update((d) => ({ ...d, otherPayer: e.target.value }))}>
            {Object.entries(payers).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <p className="muted small">Pickups and deliveries that have an amount are added to this payslip's gross and taxed with it. Leave the amount blank until the company confirms it.</p>
      </section>

      <h2 className="section-title">Payslip names</h2>
      <p className="muted pad">Income is taxed per payslip (each employer or paymaster has its own allowance). Name each payslip here, then assign sites to one under Site locations.</p>
      <section className="card">
        {Object.entries(payers).map(([id, name]) => (
          <label key={id}>{id}
            <input value={name} onChange={(e) => update((d) => ({ ...d, payerNames: { ...d.payerNames, ...payers, [id]: e.target.value } }))} />
          </label>
        ))}
        <div className="row add">
          <input placeholder="New payslip name" aria-label="New payslip name" value={newPayer} onChange={(e) => setNewPayer(e.target.value)} />
          <button disabled={!newPayer.trim()} onClick={() => {
            const id = newPayer.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
            update((d) => ({ ...d, payerNames: { ...d.payerNames, ...payers, [id]: newPayer.trim() } }));
            setNewPayer("");
          }}>Add</button>
        </div>
      </section>
    </>
  );
}
