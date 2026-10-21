import { useState } from "react";
import type { TaxRules } from "../engine";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";
import { BandTable, NumInput, VersionBar, addVersion } from "../components/settingsParts";

export function TaxPage() {
  const { data, update } = useStore();
  const versions = data.history.tax;
  const [sel, setSel] = useState(versions.at(-1)!.effectiveFrom);
  const now = versions.find((v) => v.effectiveFrom === sel) ?? versions.at(-1)!;
  const setTax = (fn: (t: TaxRules) => TaxRules) =>
    update((d) => ({
      ...d,
      history: { ...d.history, tax: d.history.tax.map((v) => (v.effectiveFrom === now.effectiveFrom ? { ...v, value: fn(v.value) } : v)) },
    }));

  return (
    <>
      <PageHeader title="NIS & tax" />
      <p className="muted pad">When NIS or tax rules change, add the new rules from the date they start. Earlier months keep calculating with the old rules.</p>

      <section className="card">
        <h2>Which rules</h2>
        <VersionBar
          versions={versions} selected={now.effectiveFrom} onSelect={setSel}
          heading="NIS and tax rules in effect" addLabel="＋ NIS / tax changes on a date"
          hint="Copies the rules shown. Edit the copy afterwards (for example, the new NIS table). Months from this date onward use it; earlier months are untouched."
          onAdd={(date) => {
            const r = addVersion(versions, sel, date);
            if (typeof r === "string") return r;
            update((d) => ({ ...d, history: { ...d.history, tax: r } }));
            setSel(date);
            return null;
          }}
          onDelete={(date) => {
            update((d) => ({ ...d, history: { ...d.history, tax: d.history.tax.filter((v) => v.effectiveFrom !== date) } }));
            setSel(versions.find((v) => v.effectiveFrom !== date)!.effectiveFrom);
          }}
        />
      </section>

      <section className="card">
        <h2>NIS</h2>
        <p className="muted small">Weekly NIS by gross pay. The band at or below your gross applies, multiplied by the Mondays in the month.</p>
        <BandTable title="NIS bands (weekly)" firstLabel="Gross from" secondLabel="Weekly NIS" open bands={now.value.nisBands} onChange={(b) => setTax((t) => ({ ...t, nisBands: b }))} />
        <label>NIS relief before tax (%)
          <NumInput label="NIS relief percent" value={Math.round(now.value.nisRelief * 10000) / 100} onChange={(v) => setTax((t) => ({ ...t, nisRelief: (v ?? 0) / 100 }))} />
        </label>
      </section>

      <section className="card">
        <h2>PAYE</h2>
        <div className="grid2">
          <label>Monthly tax-free allowance<NumInput label="Monthly allowance" value={now.value.monthlyAllowance} onChange={(v) => setTax((t) => ({ ...t, monthlyAllowance: v ?? 0 }))} /></label>
          <label>Tax rate (%)<NumInput label="Tax rate percent" value={Math.round(now.value.rate * 10000) / 100} onChange={(v) => setTax((t) => ({ ...t, rate: (v ?? 0) / 100 }))} /></label>
          <label>Annual threshold<NumInput label="Annual threshold" value={now.value.annualThreshold} onChange={(v) => setTax((t) => ({ ...t, annualThreshold: v ?? 0 }))} /></label>
        </div>
      </section>

      <section className="card">
        <h2>Health surcharge</h2>
        <BandTable title="Health surcharge bands" firstLabel="Gross from" secondLabel="Amount" bands={now.value.surchargeBands} onChange={(b) => setTax((t) => ({ ...t, surchargeBands: b }))} />
        <label>Multiplier in months with five Mondays<NumInput label="Five Monday factor" value={now.value.fiveMondayFactor} onChange={(v) => setTax((t) => ({ ...t, fiveMondayFactor: v ?? 1 }))} /></label>
      </section>
    </>
  );
}
