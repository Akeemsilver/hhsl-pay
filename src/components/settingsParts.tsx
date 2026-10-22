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

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const prettyDate = (iso: string) => `${Number(iso.slice(8))} ${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Plain-words name for a version, based on where it sits in the list: "Original rates, until 30 Sep 2026" or "From 1 Oct 2026". */
export function versionLabel(v: Dated<unknown>, all?: Array<Dated<unknown>>): string {
  const sorted = [...(all ?? [v])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const i = sorted.findIndex((x) => x.effectiveFrom === v.effectiveFrom);
  const next = sorted[i + 1];
  const today = todayISO();
  const inUse = v.effectiveFrom <= today && (!next || next.effectiveFrom > today);
  const first = v.effectiveFrom === FIRST_VERSION_DATE || i === 0;
  const range = first
    ? (next ? `Original rates, until ${prettyDate(dayBefore(next.effectiveFrom))}` : "Current rates")
    : `From ${prettyDate(v.effectiveFrom)}${next ? ` to ${prettyDate(dayBefore(next.effectiveFrom))}` : " onwards"}`;
  return inUse && sorted.length > 1 ? `${range} (in use now)` : range;
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
  versions, selected, onSelect, onAdd, onDelete, heading = "Which rates are you editing?", addLabel = "＋ Pay changed? Add new rates", hint,
}: {
  versions: Array<Dated<T>>; selected: string; onSelect: (d: string) => void;
  onAdd: (date: string) => string | null; onDelete: (date: string) => void;
  heading?: string; addLabel?: string; hint?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const sorted = [...versions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const idx = sorted.findIndex((v) => v.effectiveFrom === selected);
  const next = sorted[idx + 1];
  // Older = its period has already ended; a version that is in use now (even if another starts later) is not.
  const isOlder = !!next && next.effectiveFrom <= todayISO();
  const isFuture = selected > todayISO();
  return (
    <div className="versions">
      <label>
        {heading}
        <select value={selected} onChange={(e) => onSelect(e.target.value)}>
          {versions.map((v) => <option key={v.effectiveFrom} value={v.effectiveFrom}>{versionLabel(v, versions)}</option>)}
        </select>
      </label>
      {versions.length > 1 && (
        <p className={`notice ${isOlder ? "warn" : ""}`}>
          {isOlder
            ? <><strong>These are older rates.</strong> Change them only to fix a mistake, because every day in that period is repriced. For a raise, use the button below instead.</>
            : isFuture
              ? <>These rates start on {prettyDate(selected)}. Today's days are not affected yet.</>
              : <>Changes here affect {idx === 0 ? "every day" : `days from ${prettyDate(selected)}`}{next ? ` up to ${prettyDate(dayBefore(next.effectiveFrom))}` : " onwards"}. Other periods keep their own rates.</>}
        </p>
      )}
      {versions.length === 1 && <p className="muted small">These rates are used for every day. When your pay changes, add the new rates below and the old days stay as they were.</p>}
      <div className="row">
        <button onClick={() => { setAdding(!adding); setError(null); }}>{adding ? "Cancel" : addLabel}</button>
        <button className="danger" disabled={versions.length < 2} onClick={() => confirm(`Delete "${versionLabel(versions.find((v) => v.effectiveFrom === selected)!, versions)}"? Days that used these rates will be paid with the rates before them.`) && onDelete(selected)}>
          Delete these rates
        </button>
      </div>
      {adding && (
        <div className="add-version">
          <p className="muted small">{hint ?? "Pick the first day the new pay applies. The app copies your current rates for you to change. Days before that date keep the old rates."}</p>
          <label>New rates start on<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          {date && date < todayISO() && <p className="muted small">That date is in the past, so days since then will be repriced with the new rates.</p>}
          <button className="primary" onClick={() => { const err = onAdd(date); if (err) setError(err); else setAdding(false); }}>Add these new rates</button>
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
