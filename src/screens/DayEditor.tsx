import { useEffect, useRef, useState } from "react";
import { computeDay, minutesBetween, paidHoursFrom, valueOn } from "../engine";
import { WEEKDAYS, durationText, hoursText, money } from "../format";
import { isOther, newId, withComputedHours, type Entry } from "../model";
import { useNav } from "../nav";
import { useStore } from "../store";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TimeField, quickTimes } from "../components/TimeField";

const QUICK_JOBS = ["Airport pickup", "Delivery", "Drop-off", "Yard run"];

/**
 * Edit one day. Changes are held as a draft until Save. Closing with unsaved changes
 * (pull down, tap outside, the X, Escape or the phone's Back button) asks before discarding.
 */
export function DayEditor({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, update } = useStore();
  const { setGuard } = useNav();
  const sites = valueOn(data.history.sites, date);
  const siteNames = Object.keys(sites);
  const original = useRef<Entry[]>(data.entries.filter((e) => e.date === date));
  const [draft, setDraft] = useState<Entry[]>(() => structuredClone(original.current));
  const [confirming, setConfirming] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  const dirty = JSON.stringify(draft) !== JSON.stringify(original.current);
  const quick = quickTimes(data.entries.flatMap((e) => [e.startTime, e.endTime]));

  useEffect(() => closeRef.current?.focus(), []);

  // Pressing the phone's Back button while there are unsaved changes asks first instead of closing.
  useEffect(() => {
    if (!dirty) return;
    setGuard({ blocks: (next) => !next.day, onBlocked: () => setConfirming(true) });
    return () => setGuard(null);
  }, [dirty, setGuard]);

  const leave = () => { setGuard(null); onClose(); };
  const requestClose = () => (dirty ? setConfirming(true) : leave());
  const save = () => {
    update((d) => ({ ...d, entries: [...d.entries.filter((e) => e.date !== date), ...draft] }));
    leave();
  };

  const patch = (id: string, changes: Partial<Entry>) =>
    setDraft((list) => list.map((e) => (e.id === id ? withComputedHours({ ...e, ...changes }) : e)));
  const remove = (id: string) => setDraft((list) => list.filter((e) => e.id !== id));

  // A new job starts from your most recent job's times and lunch, so a usual 07:00-19:00 day is two taps.
  const addJob = () => {
    const last = [...data.entries].reverse().find((e) => !isOther(e) && e.startTime && e.endTime);
    const fresh: Entry = { id: newId(), date, site: siteNames[0] ?? "", hours: 0 };
    if (last) Object.assign(fresh, { startTime: last.startTime, endTime: last.endTime, lunchPaid: last.lunchPaid, lunchMinutes: last.lunchMinutes });
    setDraft((list) => [...list, withComputedHours(fresh)]);
  };
  const addOther = () =>
    setDraft((list) => [...list, { id: newId(), date, kind: "other", site: "", hours: 0, description: "" }]);

  return (
    <>
      <BottomSheet label={`Entries for ${date}`} onRequestClose={requestClose}>
        <header className="bar">
          <h2>{WEEKDAYS[wd]} {date}</h2>
          <button ref={closeRef} className="icon" onClick={requestClose} aria-label="Close">✕</button>
        </header>

        {siteNames.length === 0 && <p className="muted">No sites are set up for this date. Add them in Settings → Rates &amp; tax. You can still log an other job.</p>}

        {draft.map((entry) => {
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
          <button onClick={addJob} disabled={siteNames.length === 0}>
            {draft.some((e) => !isOther(e)) ? "Add another job" : "Add job"}
          </button>
          <button onClick={addOther}>Add other job</button>
        </div>

        <div className="sheet-footer">
          <button onClick={requestClose}>Cancel</button>
          <button className="primary" onClick={save} disabled={!dirty}>Save</button>
        </div>
      </BottomSheet>

      {confirming && (
        <ConfirmDialog
          title="Discard changes?"
          message="You have unsaved changes to this day. If you leave now they will be lost."
          cancelLabel="Keep editing"
          confirmLabel="Discard"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); leave(); }}
        />
      )}
    </>
  );
}
