import { useEffect, useRef } from "react";
import { computeDay, minutesBetween, paidHoursFrom, valueOn } from "../engine";
import { WEEKDAYS, durationText, hoursText, money } from "../format";
import { TimeField, quickTimes } from "../components/TimeField";
import { isOther, newId, withComputedHours, type Entry } from "../model";
import { useStore } from "../store";

const QUICK_JOBS = ["Airport pickup", "Delivery", "Drop-off", "Yard run"];

export function DayEditor({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, update } = useStore();
  const sites = valueOn(data.history.sites, date);
  const siteNames = Object.keys(sites);
  const entries = data.entries.filter((e) => e.date === date);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const quick = quickTimes(data.entries.flatMap((e) => [e.startTime, e.endTime]));

  const patch = (id: string, changes: Partial<Entry>) =>
    update((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? withComputedHours({ ...e, ...changes }) : e)) }));
  const remove = (id: string) => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  // A new shift starts from your most recent shift's times and lunch, so a usual 07:00-19:00 day is two taps.
  const addShift = () =>
    update((d) => {
      const last = [...d.entries].reverse().find((e) => !isOther(e) && e.startTime && e.endTime);
      const fresh: Entry = { id: newId(), date, site: siteNames[0] ?? "", hours: 0 };
      if (last) Object.assign(fresh, { startTime: last.startTime, endTime: last.endTime, lunchPaid: last.lunchPaid, lunchMinutes: last.lunchMinutes });
      return { ...d, entries: [...d.entries, withComputedHours(fresh)] };
    });
  const addOther = () =>
    update((d) => ({ ...d, entries: [...d.entries, { id: newId(), date, kind: "other", site: "", hours: 0, description: "" }] }));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Entries for ${date}`} onClick={(e) => e.stopPropagation()}>
        <header className="bar">
          <h2>{WEEKDAYS[wd]} {date}</h2>
          <button ref={closeRef} className="icon" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {siteNames.length === 0 && <p className="muted">No sites are set up for this date. Add them in Settings → Rates &amp; tax. You can still log an other job.</p>}

        {entries.map((entry) => {
          if (isOther(entry)) {
            const duration = durationText(entry.startTime, entry.endTime);
            return (
              <div className="entry other" key={entry.id}>
                <strong className="entry-kind">Other job</strong>
                <label>
                  What was the job?
                  <input
                    value={entry.description ?? ""} placeholder="e.g. Airport pickup"
                    onChange={(e) => patch(entry.id, { description: e.target.value })}
                  />
                </label>
                <div className="quick" role="group" aria-label="Quick descriptions">
                  {QUICK_JOBS.map((q) => (
                    <button key={q} type="button" className="pill" onClick={() => patch(entry.id, { description: q })}>{q}</button>
                  ))}
                </div>
                <div className="grid2">
                  <TimeField label="Start time (optional)" value={entry.startTime} quick={quick} onChange={(v) => patch(entry.id, { startTime: v })} />
                  <TimeField label="End time (optional)" value={entry.endTime} quick={quick} onChange={(v) => patch(entry.id, { endTime: v })} />
                </div>
                {duration && <p className="muted small">Duration {duration}</p>}
                <label>
                  Amount paid (optional)
                  <input
                    type="number" inputMode="decimal" min="0" step="any" placeholder="Unknown"
                    value={entry.amount ?? ""}
                    onChange={(e) => patch(entry.id, { amount: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                  <span className="muted small">A note only. It is not added to your pay totals.</span>
                </label>
                <button className="danger" onClick={() => remove(entry.id)}>Remove</button>
              </div>
            );
          }

          const pay = computeDay(entry, sites);
          const known = siteNames.some((n) => n.toLowerCase() === entry.site.trim().toLowerCase());
          return (
            <div className="entry" key={entry.id}>
              <label>
                Site
                <select value={entry.site} onChange={(e) => patch(entry.id, { site: e.target.value })}>
                  {!known && <option value={entry.site}>{entry.site || "Choose…"} (not in rates)</option>}
                  {siteNames.map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
              <div className="grid2">
                <TimeField label="Start time" value={entry.startTime} quick={quick} onChange={(v) => patch(entry.id, { startTime: v })} />
                <TimeField label="End time" value={entry.endTime} quick={quick} onChange={(v) => patch(entry.id, { endTime: v })} />
              </div>
              <div className="checks lunch">
                <label><input type="checkbox" checked={!!entry.lunchPaid} onChange={(e) => patch(entry.id, { lunchPaid: e.target.checked })} /> Lunch was paid</label>
              </div>
              {!entry.lunchPaid && (
                <div className="lunch-length" role="group" aria-label="Unpaid lunch">
                  <span className="lbl">Unpaid lunch</span>
                  {[30, 60].map((m) => (
                    <button key={m} type="button" aria-pressed={(entry.lunchMinutes ?? 60) === m} className={(entry.lunchMinutes ?? 60) === m ? "on" : ""} onClick={() => patch(entry.id, { lunchMinutes: m })}>
                      {m === 30 ? "30 min" : "1 hour"}
                    </button>
                  ))}
                </div>
              )}
              {paidHoursFrom(entry) !== undefined ? (
                <div className="hours-tile">
                  <span className="lbl">Hours paid</span>
                  <strong>{hoursText(entry.hours)} h</strong>
                  <span className="muted small">
                    {entry.startTime}–{entry.endTime} is {durationText(entry.startTime, entry.endTime)}
                    {entry.lunchPaid ? ", lunch paid" : `, minus ${(entry.lunchMinutes ?? 60) === 30 ? "30 min" : "1 hour"} unpaid lunch`}
                  </span>
                </div>
              ) : (
                <label>
                  Hours paid
                  <input
                    type="number" inputMode="decimal" min="0" max="24" step="0.25"
                    value={entry.hours}
                    onChange={(e) => patch(entry.id, { hours: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="muted small">Set a start and end time and the paid hours are worked out for you. Or type only the hours you are paid for (12 h on site minus a 1 h unpaid lunch, enter 11).</span>
                </label>
              )}
              <div className="checks">
                <label><input type="checkbox" checked={!!entry.lead} onChange={(e) => patch(entry.id, { lead: e.target.checked })} /> Lead / instructor / medic</label>
                <label><input type="checkbox" checked={!!entry.holiday} onChange={(e) => patch(entry.id, { holiday: e.target.checked })} /> Public holiday</label>
              </div>
              <div className="preview">
                <span>
                  Paid for {hoursText(entry.hours)} h · {pay.dailyPay > 0 ? `flat ${money(pay.dailyPay)}` : `${money(pay.rate)}/h`}
                  {pay.tierHours.x15 + pay.tierHours.x2 + pay.tierHours.x3 > 0 &&
                    ` · OT ${[["×1.5", pay.tierHours.x15], ["×2", pay.tierHours.x2], ["×3", pay.tierHours.x3]].filter(([, h]) => Number(h) > 0).map(([l, h]) => `${h}h ${l}`).join(", ")}`}
                </span>
                <strong>{money(pay.total)}</strong>
              </div>
              <button className="danger" onClick={() => remove(entry.id)}>Remove</button>
            </div>
          );
        })}

        <div className="grid2 add-buttons">
          <button className="primary" onClick={addShift} disabled={siteNames.length === 0}>
            {entries.some((e) => !isOther(e)) ? "Add another shift" : "Add shift"}
          </button>
          <button onClick={addOther}>Add other job</button>
        </div>
      </div>
    </div>
  );
}
