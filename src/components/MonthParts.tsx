import { WEEKDAYS, hoursText, money, timeRange } from "../format";
import { correctionKey, othersByDate, payerLabel } from "../model";
import { useSiteFilter } from "../filter";
import { holidayMap } from "../holidays";
import { useStore } from "../store";
import { SITE_COLORS, siteColorIndex } from "../siteColor";
import type { MonthSlide } from "../slide";
import { AverageLine } from "./AverageLine";
import { useYear } from "../hooks";
import type { MonthResult } from "../engine";
import { sheetSplit, type SheetInfo } from "../sheetSplit";
import type { Entry } from "../model";

/** Small print under a total: each place's own PAYE, NIS and health surcharge. Only shown when payslips are taxed separately. */
/**
 * The tax of each payslip in small print. `groups` is how many payslip groups have income: when tax is combined there is
 * one "All sites" line, shown whenever split would have shown several, so flipping the tax method changes figures only.
 */
export function PayerTax({ payers, groups, sheet }: { payers: Array<{ payer: string; paye: number; nis: number; surcharge: number; weighted?: number; days?: number }>; groups?: number; sheet?: SheetInfo }) {
  const { data } = useStore();
  const combinedNote = payers.length === 1 && payers[0]!.payer === "all" && (groups ?? 0) >= 2;
  if (payers.length < 2 && !combinedNote && !sheet) return null;
  return (
    <ul className="payer-tax" aria-label="Tax for each payslip">
      {payers.map((p) => (
        <li key={p.payer}>
          <b>{p.payer === "all" ? "All sites" : payerLabel(data.payerNames, p.payer)}{p.days !== undefined && <em className="pd">{p.days} d</em>}{p.weighted !== undefined && <em>{hoursText(p.weighted)} h</em>}</b>
          <span>PAYE <i className="c-paye">{money(p.paye)}</i> · NIS {money(p.nis)} · Surcharge {money(p.surcharge)}</span>
        </li>
      ))}
      {sheet && (
        <li className="sheet-line">
          <b>Time sheet<em className="pd">{sheet.days} d</em></b>
          <span>{sheet.sites.join(", ")}</span>
        </li>
      )}
    </ul>
  );
}

export function MonthSummary({ result, label }: { result: MonthResult<Entry>; label: string }) {
  const { data } = useStore();
  const yearMonths = useYear(Number(label.slice(0, 4)));
  const { site: filterSite } = useSiteFilter();
  const split = sheetSplit(result, data, { others: !filterSite });
  return (
    <section className="card summary" aria-label={`${label} summary`}>
      <div className="big">
        <span className="label"><i className="dot dot-gross" />Gross</span>
        <span className="value">{money(result.gross)}</span>
      </div>
      <dl>
        <div><dt><i className="dot dot-net" />Net</dt><dd className="c-net">{money(result.net)}</dd></div>
        <div><dt><i className="dot dot-paye" />PAYE</dt><dd className="c-paye">{money(result.paye)}</dd></div>
        <div><dt><i className="dot dot-nis" />NIS</dt><dd className="c-nis">{money(result.nis)}</dd></div>
        <div><dt><i className="dot dot-sur" />Surcharge</dt><dd className="c-sur">{money(result.surcharge)}</dd></div>
      </dl>
      <AverageLine gross={yearMonths.map((m) => m.gross)} net={yearMonths.map((m) => m.net)} index={Number(label.slice(5)) - 1} />
      <PayerTax payers={split.payers} sheet={split.sheet} />
      {result.payers.length > 1 && (
        <ul className="payers">
          {result.payers.map((p) => (
            <li key={p.payer}>
              <span>{payerLabel(data.payerNames, p.payer)}{p.corrected && " ✎"}</span>
              <span>{hoursText(p.hours)} h · <span className="c-gross">{money(p.gross)}</span> → <span className="c-net">{money(p.net)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CorrectionBox({ month, result }: { month: string; result: MonthResult<Entry> }) {
  const { data, update } = useStore();
  if (result.payers.length === 0) return null;

  const setCorrection = (payer: string, field: "gross" | "paye", raw: string) =>
    update((d) => {
      const key = correctionKey(month, payer);
      const next = { ...(d.corrections ?? {}) };
      const merged = { ...next[key], [field]: raw === "" ? undefined : Number(raw) };
      if (merged.gross === undefined && merged.paye === undefined) delete next[key];
      else next[key] = merged;
      return { ...d, corrections: next };
    });

  return (
    <details className="card correction">
      <summary>Payslip says something different?</summary>
      <p className="muted small">Enter the actual figures from your payslip. Leave blank to use the calculated ones. Net pay is recalculated from them.</p>
      {result.payers.map((p) => {
        const o = data.corrections?.[correctionKey(month, p.payer)];
        return (
          <fieldset key={p.payer}>
            <legend>{p.payer === "all" ? "All sites (combined)" : payerLabel(data.payerNames, p.payer)}</legend>
            <div className="grid2">
              <label>Actual gross
                <input type="number" inputMode="decimal" step="any" placeholder={String(Math.round(p.gross * 100) / 100)}
                  value={o?.gross ?? ""} onChange={(e) => setCorrection(p.payer, "gross", e.target.value)} />
              </label>
              <label>Actual PAYE
                <input type="number" inputMode="decimal" step="any" placeholder="calculated"
                  value={o?.paye ?? ""} onChange={(e) => setCorrection(p.payer, "paye", e.target.value)} />
              </label>
            </div>
          </fieldset>
        );
      })}
    </details>
  );
}

export function DayList({ days, result, today, onPick, slide }: { days: string[]; result: MonthResult<Entry>; today: string; onPick: (d: string) => void; slide?: MonthSlide }) {
  const { data } = useStore();
  const hol = holidayMap(days.map((d) => Number(d.slice(0, 4))), data);
  const { site: fsite } = useSiteFilter();
  const others = fsite ? new Map<string, Entry[]>() : othersByDate(data.entries, (days[0] ?? "").slice(0, 7));
  return (
    <div className="slide-clip days-clip" {...(slide ? slide.bind : {})}>
    <ul className="days" ref={slide ? (slide.ref as unknown as React.RefObject<HTMLUListElement>) : undefined}>
      {days.map((date) => {
        const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
        const priced = result.entries.filter((e) => e.entry.date === date);
        const extra = others.get(date) ?? [];
        const total = priced.reduce((s, e) => s + e.pay.total, 0);
        return (
          <li key={date}>
            <button
              className={`day ${wd === 0 || wd === 6 ? "weekend" : ""} ${hol.has(date) ? "holiday" : ""} ${date === today ? "today" : ""}`}
              onClick={() => onPick(date)}
              aria-label={`${WEEKDAYS[wd]} ${Number(date.slice(8))}${hol.has(date) ? ` (${hol.get(date)})` : ""}, ${priced.length ? money(total) : "no job"}${extra.length ? `, ${extra.length} other job${extra.length > 1 ? "s" : ""}` : ""}`}
            >
              <span className="dow">{WEEKDAYS[wd]}</span>
              <span className="dom">{Number(date.slice(8))}</span>
              <span className="entries">
                {priced.length === 0 && extra.length === 0 && <span className="muted">—</span>}
                {priced.map(({ entry, pay }) => (
                  <span key={entry.id} className="chip" style={{ background: `color-mix(in srgb, ${SITE_COLORS[siteColorIndex(data, entry.site)]!.hex} 22%, var(--card))` }}>
                    <i className="sw" style={{ background: SITE_COLORS[siteColorIndex(data, entry.site)]!.hex }} />
                    {entry.site}
                    {entry.hours > 0 && ` · ${hoursText(entry.hours)} h`}
                    {entry.lead && " · lead"}
                    {entry.holiday && " · HOL/TAR"}
                    {pay.total === 0 && " ⚠"}
                  </span>
                ))}
                {extra.map((o) => (
                  <span key={o.id} className="chip other">
                    Other · {o.description || "no description"}
                    {timeRange(o.startTime, o.endTime) && ` · ${timeRange(o.startTime, o.endTime)}`}
                  </span>
                ))}
              </span>
              <span className="amount">{priced.length ? money(total) : ""}</span>
            </button>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

/** Month grid, Sunday first. Each cell shows the day's total and the site(s) worked, plus other jobs. */
export function CalendarGrid({ month, days, result, today, onPick, selected, slide }: {
  month: string; days: string[]; result: MonthResult<Entry>; today: string; onPick: (d: string) => void; selected?: string | null;
  /** Swipe left or right to change the month (see useMonthSlide). */
  slide?: MonthSlide;
}) {
  const { data } = useStore();
  const hol = holidayMap(days.map((d) => Number(d.slice(0, 4))), data);
  const { site: fsite } = useSiteFilter();
  const others = fsite ? new Map<string, Entry[]>() : othersByDate(data.entries, month);
  const legend = [...new Set(result.entries.map((e) => e.entry.site))];
  const lead = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  return (
    <section className="card calendar slide-clip" aria-label="Calendar" {...(slide ? slide.bind : {})}>
      <div className="cal-slide" ref={slide?.ref}>
      <div className="cal-head" aria-hidden="true">
        {WEEKDAYS.map((w) => <span key={w} className={w === "Sun" || w === "Sat" ? "red" : ""}>{w.slice(0, 2)}</span>)}
      </div>
      <div className="cal-grid">
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} className="cal-blank" />)}
        {days.map((date) => {
          const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
          const priced = result.entries.filter((e) => e.entry.date === date);
          const extra = others.get(date) ?? [];
          const total = priced.reduce((s, e) => s + e.pay.total, 0);
          const first = priced[0];
          const tone = first ? siteColorIndex(data, first.entry.site) : 0;
          const state = first ? `worked tone${tone}` : extra.length ? "worked other" : "";
          const jobCount = priced.length + extra.length;
          const dotTones = [
            ...priced.map((p) => siteColorIndex(data, p.entry.site)),
            ...extra.map(() => "o"),
          ].slice(0, 4);
          return (
            <button
              key={date}
              className={`cal-cell ${wd === 0 || wd === 6 ? "weekend" : ""} ${hol.has(date) ? "holiday" : ""} ${date === today ? "today" : ""} ${selected === date ? "selected" : ""} ${state}`}
              onClick={() => onPick(date)}
              aria-pressed={selected === undefined ? undefined : selected === date}
              aria-label={`${WEEKDAYS[wd]} ${Number(date.slice(8))}${hol.has(date) ? ` (${hol.get(date)})` : ""}, ${priced.length ? money(total) : "no job"}${extra.length ? `, ${extra.length} other job${extra.length > 1 ? "s" : ""}` : ""}`}
            >
              <span className="n">{Number(date.slice(8))}</span>
              {first && (
                <>
                  <span className="amt">${Math.round(total).toLocaleString("en-US")}</span>
                  {jobCount === 1 && <span className="cal-site">{first.entry.site.slice(0, 5)}</span>}
                </>
              )}
              {!first && extra[0] && (
                <>
                  <span className="amt">Other{extra.length > 1 ? ` ×${extra.length}` : ""}</span>
                  <span className="cal-site">{(extra[0].description || "job").slice(0, 6)}</span>
                </>
              )}
              {jobCount > 1 && (
                <span className="dots" aria-hidden="true">
                  {dotTones.map((t, i) => <span key={i} className={`d tone${t}`} />)}
                  {jobCount > 4 && <span className="more">+</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {legend.length > 0 && (
        <p className="cal-legend">
          {legend.map((n) => <span key={n} className="k"><i style={{ background: SITE_COLORS[siteColorIndex(data, n)]!.hex }} />{n}</span>)}
        </p>
      )}
      </div>
    </section>
  );
}
