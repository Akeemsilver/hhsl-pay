import { useState } from "react";
import type { Dated } from "../engine";
import { FIRST_VERSION_DATE } from "../model";
import { todayISO } from "../format";

export type Num = number | undefined;

export function NumInput({ value, onChange, label, step = "any" }: { value: Num; onChange: (v: Num) => void; label: string; step?: string }) {
  return (
    <input
      type="number" inputMode="decimal" step={step} aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}

export function versionLabel(v: Dated<unknown>): string {
  return v.effectiveFrom === FIRST_VERSION_DATE ? "From the start" : `From ${v.effectiveFrom}`;
}

/** Add a copy of the rules in force on `date` as a new version starting on `date`. Returns an error message or the new list. */
export function addVersion<T>(list: Array<Dated<T>>, fallbackFrom: string, date: string): Array<Dated<T>> | string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a valid date.";
  if (list.some((v) => v.effectiveFrom === date)) return "There are already rates starting on that date.";
  const base =
    [...list].filter((v) => v.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ??
    list.find((v) => v.effectiveFrom === fallbackFrom)!;
  return [...list, { effectiveFrom: date, value: structuredClone(base.value) }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

export function VersionBar<T>({
  versions, selected, onSelect, onAdd, onDelete, heading = "Rates in effect", addLabel = "＋ New rates from a date", hint,
}: {
  versions: Array<Dated<T>>; selected: string; onSelect: (d: string) => void;
  onAdd: (date: string) => string | null; onDelete: (date: string) => void;
  heading?: string; addLabel?: string; hint?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="versions">
      <label>
        {heading}
        <select value={selected} onChange={(e) => onSelect(e.target.value)}>
          {versions.map((v) => <option key={v.effectiveFrom} value={v.effectiveFrom}>{versionLabel(v)}</option>)}
        </select>
      </label>
      <div className="row">
        <button onClick={() => { setAdding(!adding); setError(null); }}>{adding ? "Cancel" : addLabel}</button>
        <button className="danger" disabled={versions.length < 2} onClick={() => confirm(`Delete the rates ${versionLabel(versions.find((v) => v.effectiveFrom === selected)!)}? Days that used them will be priced with the earlier rates.`) && onDelete(selected)}>
          Delete this version
        </button>
      </div>
      {adding && (
        <div className="add-version">
          <p className="muted small">{hint ?? "Copies the selected rates. Edit the copy afterwards. Days from this date onward use it; earlier days are untouched. A date in the past reprices those days."}</p>
          <label>Start date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button className="primary" onClick={() => { const err = onAdd(date); if (err) setError(err); else setAdding(false); }}>Create</button>
          {error && <p className="bad" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function BandTable({ title, bands, onChange, firstLabel, secondLabel, open }: {
  title: string; bands: Array<[number, number]>; onChange: (b: Array<[number, number]>) => void;
  firstLabel: string; secondLabel: string; open?: boolean;
}) {
  return (
    <details className="site" open={open}>
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
