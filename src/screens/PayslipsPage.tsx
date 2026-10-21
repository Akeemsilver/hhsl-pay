import { useState } from "react";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";

export function PayslipsPage() {
  const { data, update } = useStore();
  const [newPayer, setNewPayer] = useState("");
  const payers = { ...data.payerNames };
  for (const v of data.history.sites) for (const s of Object.values(v.value)) payers[s.payer] ??= s.payer;
  return (
    <>
      <PageHeader title="Payslips" />
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
