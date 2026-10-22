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

export function BandTable({ title, bands, onChange, firstLabel, secondLabel, open }: {
  title: string; bands: Array<[number, number]>; onChange: (b: Array<[number, number]>) => void;
  firstLabel: string; secondLabel: string; open?: boolean;
}) {
  return (
    <details className="site" open={open}>
      <summary>{title}</summary>
      <table className="bands">
        <thead><tr><th className="row-no">Row</th><th>{firstLabel}</th><th>{secondLabel}</th><th /></tr></thead>
        <tbody>
          {bands.map(([from, amount], i) => (
            <tr key={i}>
              <td className="row-no" aria-label={`Row ${i + 1}`}>{i + 1}</td>
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
