import { useEffect, useRef, useState, type ReactNode } from "react";

/** Compact money for axes and labels: $950, $5.2K, $22K. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}K`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** Round axis ticks: 0 .. a clean maximum, at most ~5 steps. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

interface Tip { x: number; y: number; node: ReactNode }

/** One tooltip per chart. Works for hover, tap and keyboard focus. */
export function useTip() {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (el: Element, node: ReactNode) => {
    const w = wrap.current?.getBoundingClientRect();
    if (!w) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2 - w.left, 80), Math.max(80, w.width - 80));
    setTip({ x, y: r.top - w.top, node });
  };
  const hide = () => setTip(null);

  useEffect(() => {
    if (!tip) return;
    const outside = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setTip(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setTip(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [tip]);

  const bind = (node: ReactNode) => ({
    tabIndex: 0,
    onPointerEnter: (e: React.PointerEvent<Element>) => show(e.currentTarget, node),
    onPointerDown: (e: React.PointerEvent<Element>) => show(e.currentTarget, node),
    onPointerLeave: (e: React.PointerEvent<Element>) => e.pointerType === "mouse" && hide(),
    onFocus: (e: React.FocusEvent<Element>) => show(e.currentTarget, node),
    onBlur: hide,
  });

  const layer = tip && (
    <div className="tip" role="status" style={{ left: tip.x, top: tip.y }}>
      {tip.node}
    </div>
  );
  return { wrap, bind, layer, active: tip !== null };
}

export interface LegendItem { name: string; color: string }

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.name}><span className="swatch" style={{ background: i.color }} aria-hidden="true" />{i.name}</li>
      ))}
    </ul>
  );
}

export function ChartCard({ title, note, legend, table, action, children }: {
  title: string; note?: string; legend?: LegendItem[]; /** Sits on the same row as "View as table", at the far right. */ action?: ReactNode;
  table: { head: string[]; rows: string[][]; foot?: string[] };
  children: ReactNode;
}) {
  return (
    <section className="card viz">
      <h2>{title}</h2>
      {note && <p className="muted small">{note}</p>}
      {legend && <Legend items={legend} />}
      {children}
      <div className="table-wrap">
      <details className="table-view">
        <summary>View as table</summary>
        <table>
          <thead><tr>{table.head.map((h, i) => <th key={h + i}>{h}</th>)}</tr></thead>
          <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          {table.foot && <tfoot><tr>{table.foot.map((c, i) => <td key={i}>{c}</td>)}</tr></tfoot>}
        </table>
      </details>
      {action && <div className="tv-action">{action}</div>}
      </div>
    </section>
  );
}

export function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="tip-row">
      {color && <span className="key" style={{ background: color }} aria-hidden="true" />}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/** Horizontal bars for one series, sorted by the caller. Value sits in a column at the right. */
export function HBars({ rows, format, tipFor }: {
  rows: Array<{ name: string; value: number }>;
  format: (n: number) => string;
  tipFor: (r: { name: string; value: number }) => ReactNode;
}) {
  const { wrap, bind, layer } = useTip();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="chart-wrap" ref={wrap}>
      <div className="hbars" role="list">
        {rows.map((r) => (
          <div className="hbar" role="listitem" key={r.name} aria-label={`${r.name} ${format(r.value)}`} {...bind(tipFor(r))}>
            <span className="name">{r.name}</span>
            <span className="track"><span className="fill" style={{ width: `${(r.value / max) * 100}%`, background: "var(--gross)" }} /></span>
            <span className="val">{format(r.value)}</span>
          </div>
        ))}
      </div>
      {layer}
    </div>
  );
}

export interface PairSeries { name: string; color: string; values: number[] }

const W = 360, H = 196, L = 40, R = 6, T = 10, B = 24;

function barPath(x: number, base: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${base} V${base - h + r} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} Z`;
}

/** Twelve month slots, one column per series, a single y-axis. */
export function MonthColumns({ labels, series, title, tipTitle }: {
  labels: string[]; series: PairSeries[]; title: string; tipTitle: (i: number) => string;
}) {
  const { wrap, bind, layer } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...series.flatMap((s) => s.values), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] ?? 1;
  const plotW = W - L - R, plotH = H - T - B;
  const slot = plotW / labels.length;
  const barW = 10, gap = 2;
  const group = series.length * barW + (series.length - 1) * gap;
  const y = (v: number) => T + plotH - (v / top) * plotH;

  // Label only the single tallest bar.
  let peak = { s: 0, i: 0, v: 0 };
  series.forEach((s, si) => s.values.forEach((v, i) => { if (v > peak.v) peak = { s: si, i, v }; }));

  return (
    <div className="chart-wrap" ref={wrap} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="axis">{compact(t)}</text>
          </g>
        ))}
        {labels.map((lab, i) => {
          const sx = L + i * slot;
          const x0 = sx + (slot - group) / 2;
          const tipNode = (
            <>
              <div className="tip-title">{tipTitle(i)}</div>
              {series.map((s) => <TipRow key={s.name} color={s.color} label={s.name} value={fullMoney(s.values[i] ?? 0)} />)}
            </>
          );
          const b = bind(tipNode);
          return (
            <g key={lab}>
              {hover === i && <rect x={sx} y={T} width={slot} height={plotH} className="hover-band" />}
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const h = (v / top) * plotH;
                return v > 0 ? <path key={s.name} d={barPath(x0 + si * (barW + gap), T + plotH, barW, h)} fill={s.color} /> : null;
              })}
              <text x={sx + slot / 2} y={H - 8} textAnchor="middle" className="axis">{lab}</text>
              <rect
                x={sx} y={T} width={slot} height={plotH + B} className="hit"
                aria-label={`${tipTitle(i)}: ${series.map((s) => `${s.name} ${compact(s.values[i] ?? 0)}`).join(", ")}`}
                {...b}
                onPointerEnter={(e) => { setHover(i); b.onPointerEnter(e); }}
                onPointerDown={(e) => { setHover(i); b.onPointerDown(e); }}
                onFocus={(e) => { setHover(i); b.onFocus(e); }}
              />
            </g>
          );
        })}
        {peak.v > 0 && (
          <text
            x={L + peak.i * slot + (slot - group) / 2 + peak.s * (barW + gap) + barW / 2}
            y={y(peak.v) - 4} textAnchor="middle" className="axis strong"
          >{compact(peak.v)}</text>
        )}
      </svg>
      {layer}
    </div>
  );
}

export function fullMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 100% bar: one segment per part, 2px gaps, with a labelled row for each below. */
export function SplitBar({ parts }: { parts: Array<{ name: string; value: number; color: string }> }) {
  const { wrap, bind, layer } = useTip();
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="chart-wrap" ref={wrap}>
      <div className="split" role="img" aria-label={shown.map((p) => `${p.name} ${((p.value / total) * 100).toFixed(1)} percent`).join(", ")}>
        {shown.map((p) => (
          <span
            key={p.name} className="seg" style={{ flexGrow: p.value, background: p.color }}
            {...bind(<><TipRow color={p.color} label={p.name} value={fullMoney(p.value)} /><div className="tip-title">{((p.value / total) * 100).toFixed(1)}% of gross</div></>)}
          />
        ))}
      </div>
      <ul className="split-rows">
        {shown.map((p) => (
          <li key={p.name}>
            <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
            <span className="who">{p.name}</span>
            <strong>{fullMoney(p.value)}</strong>
            <span className="muted">{((p.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
      {layer}
    </div>
  );
}
