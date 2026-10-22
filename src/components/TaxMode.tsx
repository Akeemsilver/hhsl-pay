import { isCombined, setCombinedTax } from "../model";
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
