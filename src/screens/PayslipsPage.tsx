import { useState } from "react";
import { payerLabel, otherPayerId } from "../model";
import { OtherJobsPayer, TaxSegment } from "../components/TaxMode";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";

export function PayslipsPage() {
  const { data, update } = useStore();
  const [newPayer, setNewPayer] = useState("");
  const payers = { ...data.payerNames };
  for (const v of data.history.sites) for (const s of Object.values(v.value)) payers[s.payer] ??= payerLabel(data.payerNames, s.payer);
  return (
    <>
      <PageHeader title="Payslips" />
      <h2 className="section-title">How tax is worked out</h2>
      <section className="card">
        <TaxSegment />
        <p className="muted small"><strong>Split:</strong> each payslip below pays its own PAYE, NIS and health surcharge on its own income, and you get a separate payslip page for each. <strong>Combined:</strong> all income is added up and taxed once, on one payslip. The choice applies to the whole app, every month.</p>
      </section>
      <h2 className="section-title">Other jobs</h2>
      <section className="card">
        <OtherJobsPayer />
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
