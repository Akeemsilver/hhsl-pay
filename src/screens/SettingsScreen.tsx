import { useState } from "react";
import type { Dated, SiteRates, SiteTable, TaxRules, TierCaps } from "../engine";
import { emptySite, FIRST_VERSION_DATE } from "../model";
import { todayISO } from "../format";
import { useStore } from "../store";

type Num = number | undefined;

function NumInput({ value, onChange, label, step = "any" }: { value: Num; onChange: (v: Num) => void; label: string; step?: string }) {
  return (
    <input
      type="number" inputMode="decimal" step={step} aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}

function versionLabel(v: Dated<unknown>): string {
  return v.effectiveFrom === FIRST_VERSION_DATE ? "From the start" : `From ${v.effectiveFrom}`;
}

function VersionBar<T>({
  versions, selected, onSelect, onAdd, onDelete,
}: {
  versions: Array<Dated<T>>; selected: string; onSelect: (d: string) => void;
  onAdd: (date: string) => string | null; onDelete: (date: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="versions">
      <label>
        Rates in effect
        <select value={selected} onChange={(e) => onSelect(e.target.value)}>
          {versions.map((v) => <option key={v.effectiveFrom} value={v.effectiveFrom}>{versionLabel(v)}</option>)}
        </select>
      </label>
      <div className="row">
        <button onClick={() => { setAdding(!adding); setError(null); }}>{adding ? "Cancel" : "＋ New rates from a date"}</button>
        <button className="danger" disabled={versions.length < 2} onClick={() => confirm(`Delete the rates ${versionLabel(versions.find((v) => v.effectiveFrom === selected)!)}? Days that used them will be priced with the earlier rates.`) && onDelete(selected)}>
          Delete this version
        </button>
      </div>
      {adding && (
        <div className="add-version">
          <p className="muted small">Copies the selected rates. Edit the copy afterwards. Days from this date onward use it; earlier days are untouched. A date in the past reprices those days.</p>
          <label>Start date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button className="primary" onClick={() => { const err = onAdd(date); if (err) setError(err); else setAdding(false); }}>Create</button>
          {error && <p className="bad" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

function CapsRow({ label, caps, onChange, withX3 }: { label: string; caps: TierCaps; onChange: (c: TierCaps) => void; withX3?: boolean }) {
  const set = (k: keyof TierCaps) => (v: Num) => onChange({ ...caps, [k]: v });
  return (
    <>
      <span className="cap-label">{label}</span>
      <NumInput label={`${label} ×1 hours`} value={caps.x1} onChange={set("x1")} />
      <NumInput label={`${label} ×1.5 hours`} value={caps.x15} onChange={set("x15")} />
      <NumInput label={`${label} ×2 hours`} value={caps.x2} onChange={set("x2")} />
      {withX3 ? <NumInput label={`${label} ×3 hours`} value={caps.x3} onChange={set("x3")} /> : <span />}
    </>
  );
}

function SiteCard({ name, site, payers, onChange, onRename, onRemove }: {
  name: string; site: SiteRates; payers: Record<string, string>;
  onChange: (s: SiteRates) => void; onRename: (n: string) => void; onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const set = <K extends keyof SiteRates>(k: K, v: SiteRates[K]) => onChange({ ...site, [k]: v });
  return (
    <details className="site">
      <summary>{name}<span className="muted"> · {payers[site.payer] ?? site.payer}</span></summary>
      <label>Site name
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft.trim() && draft !== name && onRename(draft.trim())} />
      </label>
      <label>Payslip
        <select value={site.payer} onChange={(e) => set("payer", e.target.value)}>
          {Object.entries(payers).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </label>
      <div className="grid2">
        <label>Hourly rate<NumInput label="Hourly rate" value={site.baseRate} onChange={(v) => set("baseRate", v)} /></label>
        <label>Lead / instructor rate<NumInput label="Lead rate" value={site.leadRate} onChange={(v) => set("leadRate", v)} /></label>
      </div>
      <p className="muted small">Hours at each pay multiple per day. Use a large number such as 1000 for “no limit”. Leave blank for none.</p>
      <div className="caps">
        <span /><span className="cap-h">×1</span><span className="cap-h">×1.5</span><span className="cap-h">×2</span><span className="cap-h">×3</span>
        <CapsRow label="Weekday" caps={site.weekday} onChange={(c) => set("weekday", c)} />
        <CapsRow label="Weekend" caps={site.weekend} onChange={(c) => set("weekend", c)} />
        <CapsRow label="Holiday" caps={site.holiday} onChange={(c) => set("holiday", c)} withX3 />
      </div>
      <p className="muted small">Flat daily pay (optional). If set, the day pays this amount plus any overtime.</p>
      <div className="grid3">
        <label>Standard<NumInput label="Standard daily pay" value={site.dailyStd} onChange={(v) => set("dailyStd", v)} /></label>
        <label>Lead<NumInput label="Lead daily pay" value={site.dailyLead} onChange={(v) => set("dailyLead", v)} /></label>
        <label>Holiday<NumInput label="Holiday daily pay" value={site.dailyHoliday} onChange={(v) => set("dailyHoliday", v)} /></label>
      </div>
      <p className="muted small">Hourly rate only after a threshold (e.g. offshore): rate applies when hours exceed the threshold.</p>
      <div className="grid2">
        <label>Threshold (hours)<NumInput label="Show rate above hours" value={site.showRateAboveHrs} onChange={(v) => set("showRateAboveHrs", v)} /></label>
        <label>Rate above threshold<NumInput label="Rate above threshold" value={site.rateAboveHrs} onChange={(v) => set("rateAboveHrs", v)} /></label>
      </div>
      <button className="danger" onClick={() => confirm(`Remove ${name} from these rates?`) && onRemove()}>Remove site</button>
    </details>
  );
}

function BandTable({ title, bands, onChange, firstLabel, secondLabel }: {
  title: string; bands: Array<[number, number]>; onChange: (b: Array<[number, number]>) => void; firstLabel: string; secondLabel: string;
}) {
  return (
    <details className="site">
      <summary>{title}</summary>
      <table className="bands">
        <thead><tr><th>{firstLabel}</th><th>{secondLabel}</th><th /></tr></thead>
        <tbody>
          {bands.map(([from, amount], i) => (
            <tr key={i}>
              <td><NumInput label={`${title} from ${i + 1}`} value={from} onChange={(v) => onChange(bands.map((b, j): [number, number] => (j === i ? [v ?? 0, b[1]] : b)))} /></td>
              <td><NumInput label={`${title} amount ${i + 1}`} value={amount} onChange={(v) => onChange(bands.map((b, j): [number, number] => (j === i ? [b[0], v ?? 0] : b)))} /></td>
              <td><button className="icon" aria-label="Remove row" onClick={() => onChange(bands.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => onChange([...bands, [(bands.at(-1)?.[0] ?? 0) + 1, bands.at(-1)?.[1] ?? 0]])}>Add row</button>
    </details>
  );
}

export function SettingsScreen() {
  const { data, update } = useStore();
  const sitesVersions = data.history.sites;
  const taxVersions = data.history.tax;
  const [siteSel, setSiteSel] = useState(sitesVersions.at(-1)!.effectiveFrom);
  const [taxSel, setTaxSel] = useState(taxVersions.at(-1)!.effectiveFrom);
  const [newSite, setNewSite] = useState("");
  const [newPayer, setNewPayer] = useState("");

  const sitesNow = sitesVersions.find((v) => v.effectiveFrom === siteSel) ?? sitesVersions.at(-1)!;
  const taxNow = taxVersions.find((v) => v.effectiveFrom === taxSel) ?? taxVersions.at(-1)!;

  const setSites = (fn: (s: SiteTable) => SiteTable) =>
    update((d) => ({
      ...d,
      history: { ...d.history, sites: d.history.sites.map((v) => (v.effectiveFrom === sitesNow.effectiveFrom ? { ...v, value: fn(v.value) } : v)) },
    }));
  const setTax = (fn: (t: TaxRules) => TaxRules) =>
    update((d) => ({
      ...d,
      history: { ...d.history, tax: d.history.tax.map((v) => (v.effectiveFrom === taxNow.effectiveFrom ? { ...v, value: fn(v.value) } : v)) },
    }));

  const addVersion = <T,>(list: Array<Dated<T>>, from: string, date: string): Array<Dated<T>> | string => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a valid date.";
    if (list.some((v) => v.effectiveFrom === date)) return "There are already rates starting on that date.";
    const base = [...list].filter((v) => v.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? list.find((v) => v.effectiveFrom === from)!;
    return [...list, { effectiveFrom: date, value: structuredClone(base.value) }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  };

  const renameSite = (from: string, to: string) =>
    update((d) => {
      const rename = (t: SiteTable): SiteTable =>
        Object.fromEntries(Object.entries(t).map(([k, v]) => [k === from ? to : k, v]));
      return {
        ...d,
        history: { ...d.history, sites: d.history.sites.map((v) => ({ ...v, value: rename(v.value) })) },
        entries: d.entries.map((e) => (e.site === from ? { ...e, site: to } : e)),
      };
    });

  const payers = { ...data.payerNames };
  for (const v of sitesVersions) for (const s of Object.values(v.value)) payers[s.payer] ??= s.payer;

  return (
    <>
      <header className="bar"><h1>Rates &amp; tax</h1></header>
      <p className="muted pad">Everything here stays on this phone. When you get a raise, add new rates from its start date. Earlier days keep their old rates.</p>

      <section className="card">
        <h2>Sites &amp; pay rates</h2>
        <VersionBar
          versions={sitesVersions} selected={sitesNow.effectiveFrom} onSelect={setSiteSel}
          onAdd={(date) => {
            const r = addVersion(sitesVersions, siteSel, date);
            if (typeof r === "string") return r;
            update((d) => ({ ...d, history: { ...d.history, sites: r } }));
            setSiteSel(date);
            return null;
          }}
          onDelete={(date) => {
            update((d) => ({ ...d, history: { ...d.history, sites: d.history.sites.filter((v) => v.effectiveFrom !== date) } }));
            setSiteSel(sitesVersions.find((v) => v.effectiveFrom !== date)!.effectiveFrom);
          }}
        />
        {Object.entries(sitesNow.value).map(([name, site]) => (
          <SiteCard
            key={`${sitesNow.effectiveFrom}:${name}`} name={name} site={site} payers={payers}
            onChange={(s) => setSites((t) => ({ ...t, [name]: s }))}
            onRename={(to) => renameSite(name, to)}
            onRemove={() => setSites((t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== name)))}
          />
        ))}
        <div className="row add">
          <input placeholder="New site name" aria-label="New site name" value={newSite} onChange={(e) => setNewSite(e.target.value)} />
          <button
            className="primary"
            disabled={!newSite.trim() || Object.keys(sitesNow.value).some((k) => k.toLowerCase() === newSite.trim().toLowerCase())}
            onClick={() => { setSites((t) => ({ ...t, [newSite.trim()]: emptySite(Object.keys(payers)[0] ?? "main") })); setNewSite(""); }}
          >Add site</button>
        </div>
      </section>

      <section className="card">
        <h2>Payslips</h2>
        <p className="muted small">Income is taxed per payslip (each employer or paymaster has its own allowance). Give each a name, then assign sites to one.</p>
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

      <section className="card">
        <h2>Tax rules</h2>
        <VersionBar
          versions={taxVersions} selected={taxNow.effectiveFrom} onSelect={setTaxSel}
          onAdd={(date) => {
            const r = addVersion(taxVersions, taxSel, date);
            if (typeof r === "string") return r;
            update((d) => ({ ...d, history: { ...d.history, tax: r } }));
            setTaxSel(date);
            return null;
          }}
          onDelete={(date) => {
            update((d) => ({ ...d, history: { ...d.history, tax: d.history.tax.filter((v) => v.effectiveFrom !== date) } }));
            setTaxSel(taxVersions.find((v) => v.effectiveFrom !== date)!.effectiveFrom);
          }}
        />
        <div className="grid2">
          <label>Monthly tax-free allowance<NumInput label="Monthly allowance" value={taxNow.value.monthlyAllowance} onChange={(v) => setTax((t) => ({ ...t, monthlyAllowance: v ?? 0 }))} /></label>
          <label>Tax rate (%)<NumInput label="Tax rate percent" value={Math.round(taxNow.value.rate * 10000) / 100} onChange={(v) => setTax((t) => ({ ...t, rate: (v ?? 0) / 100 }))} /></label>
          <label>Annual threshold<NumInput label="Annual threshold" value={taxNow.value.annualThreshold} onChange={(v) => setTax((t) => ({ ...t, annualThreshold: v ?? 0 }))} /></label>
          <label>NIS relief (%)<NumInput label="NIS relief percent" value={Math.round(taxNow.value.nisRelief * 10000) / 100} onChange={(v) => setTax((t) => ({ ...t, nisRelief: (v ?? 0) / 100 }))} /></label>
        </div>
        <BandTable title="NIS bands (weekly)" firstLabel="Gross from" secondLabel="Weekly NIS" bands={taxNow.value.nisBands} onChange={(b) => setTax((t) => ({ ...t, nisBands: b }))} />
        <BandTable title="Health surcharge bands" firstLabel="Gross from" secondLabel="Amount" bands={taxNow.value.surchargeBands} onChange={(b) => setTax((t) => ({ ...t, surchargeBands: b }))} />
      </section>
    </>
  );
}
