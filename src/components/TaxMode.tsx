import { isCombined, otherPayerId, payerLabel, setCombinedTax } from "../model";
import { useStore } from "../store";

/** Split or Combined tax for the whole app, as two buttons. */
export function TaxSegment() {
  const { data, update } = useStore();
  const combined = isCombined(data);
  return (
    <div className="segmented" role="group" aria-label="Tax method">
      <button aria-pressed={!combined} className={!combined ? "on" : ""} onClick={() => update((d) => setCombinedTax(d, false))}>Split</button>
      <button aria-pressed={combined} className={combined ? "on" : ""} onClick={() => update((d) => setCombinedTax(d, true))}>Combined</button>
    </div>
  );
}

/**
 * A small switch that flips the whole app between Split and Combined. It always shows as on: the word beside it says
 * which method is on right now.
 */
export function TaxSwitch() {
  const { data, update } = useStore();
  const combined = isCombined(data);
  return (
    <button
      className="tax-switch"
      aria-label={`Tax is ${combined ? "combined" : "split"} on. Tap to switch to ${combined ? "split" : "combined"} for the whole app.`}
      title="Split or combined tax, for the whole app"
      onClick={() => update((d) => setCombinedTax(d, !isCombined(d)))}
    >
      <span className="ts-label">{combined ? "Combined" : "Split"}</span>
      <span className="ts-track" aria-hidden="true"><i /></span>
    </button>
  );
}

/** Which payslip other jobs (pickups, deliveries) are paid on and taxed with. */
export function OtherJobsPayer() {
  const { data, update } = useStore();
  const payers: Record<string, string> = { ...data.payerNames };
  for (const v of data.history.sites) for (const site of Object.values(v.value)) payers[site.payer] ??= payerLabel(data.payerNames, site.payer);
  return (
    <div className="other-payer">
      <label>Other jobs are paid on
        <select aria-label="Other jobs payslip" value={otherPayerId(data)} onChange={(e) => update((d) => ({ ...d, otherPayer: e.target.value }))}>
          {Object.entries(payers).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </label>
      <p className="muted small">Pickups and deliveries that have an amount are added to this payslip's gross and taxed with it. Leave the amount blank until the company confirms it.</p>
    </div>
  );
}
