import { useEffect, useRef, useState } from "react";
import { computeDay, findSite, valueOn } from "../engine";
import { WEEKDAYS, durationText, hoursText, money } from "../format";
import { isDetailed, isOther, newId, rolesFor, toDetailed, toSimple, withComputedHours, type Entry } from "../model";
import { useNav } from "../nav";
import { holidayMap } from "../holidays";
import { useStore } from "../store";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { HoursField } from "../components/HoursField";
import { TimeField, quickTimes } from "../components/TimeField";
import { ChevronDown, ChevronUp } from "../components/Icons";

const QUICK_JOBS = ["Airport pickup", "Delivery", "Drop-off", "Yard run"];

/**
 * Edit one day. Changes are held as a draft until Save. Closing with unsaved changes
 * (pull down, tap outside, the X, Escape or the phone's Back button) asks before discarding.
 */
export function DayEditor({ date, add, focus, onClose }: { date: string; add?: "job" | "other"; focus?: string; onClose: () => void }) {
  const { data, update } = useStore();
  const { setGuard } = useNav();
  const sites = valueOn(data.history.sites, date);
  const siteNames = Object.keys(sites);
  const original = useRef<Entry[]>(data.entries.filter((e) => e.date === date));
  const [draft, setDraft] = useState<Entry[]>(() => structuredClone(original.current));
  const started = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  const dirty = JSON.stringify(draft) !== JSON.stringify(original.current);
  const quick = quickTimes(data.entries.flatMap((e) => [e.startTime, e.endTime]));

  useEffect(() => closeRef.current?.focus(), []);

  // Opened from the calendar's "Add job": start with a blank job already on the form. Or scroll to the job being edited.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (add === "job" && siteNames.length > 0) setDraft((list) => [...list, newJob()]);
    else if (add === "other") setDraft((list) => [...list, newOther()]);
    else if (focus) document.querySelector(`[data-entry-id="${focus}"]`)?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** Changing the site keeps the role when the new site offers it, otherwise it goes back to "Not applicable". */
  const changeSite = (entry: Entry, name: string) => {
    const next = findSite(sites, name);
    const keep = entry.role && rolesFor(next).some((r) => r.toLowerCase() === entry.role!.toLowerCase());
    patch(entry.id, { site: name, role: keep ? entry.role : undefined });
  };

  const holidayName = holidayMap([Number(date.slice(0, 4))], data).get(date);
  const patch = (id: string, changes: Partial<Entry>) =>
    setDraft((list) => list.map((e) => (e.id === id ? withComputedHours({ ...e, ...changes }) : e)));
  const remove = (id: string) => setDraft((list) => list.filter((e) => e.id !== id));

  // A new job starts from your most recent job's times and lunch, so a usual 07:00-19:00 day is two taps.
  const newJob = (): Entry => {
    const last = [...data.entries].reverse().find((e) => !isOther(e));
    const fresh: Entry = { id: newId(), date, site: siteNames[0] ?? "", hours: last?.hours ?? 12 };
    if (holidayName) fresh.holiday = true;
    if (last && isDetailed(last)) {
      Object.assign(fresh, { detailed: true, startTime: last.startTime, endTime: last.endTime, lunchPaid: last.lunchPaid, lunchMinutes: last.lunchMinutes });
    } else {
      fresh.detailed = false;
    }
    return withComputedHours(fresh);
  };
  const newOther = (): Entry => ({ id: newId(), date, kind: "other", site: "", hours: 0, description: "" });
  const addJob = () => setDraft((list) => [...list, newJob()]);
  const addOther = () => setDraft((list) => [...list, newOther()]);

  return (
    <>
      <BottomSheet label={`Entries for ${date}`} onRequestClose={requestClose}>
        <header className="bar">
          <h2>{WEEKDAYS[wd]} {date}</h2>
          {holidayName && <p className="hol-name">{holidayName}</p>}
          <button ref={closeRef} className="icon" onClick={requestClose} aria-label="Close">✕</button>
        </header>

        {siteNames.length === 0 && <p className="muted">No sites are set up for this date. Add them in Settings → Rates &amp; tax. You can still log an other job.</p>}

        {draft.map((entry) => {
          if (isOther(entry)) {
            const duration = durationText(entry.startTime, entry.endTime);
            return (
              <div className="entry other" key={entry.id} data-entry-id={entry.id}>
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
                  Amount paid ($, optional)
                  <input
                    type="number" inputMode="decimal" min="0" step="any" placeholder="Unknown"
                    value={entry.amount ?? ""}
                    onChange={(e) => patch(entry.id, { amount: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                  <span className="muted small">Leave blank until the company confirms it, then edit this day and enter it. Once it has an amount it is added to your Point Lisas / other gross and taxed with it.</span>
                </label>
                <button className="danger" onClick={() => remove(entry.id)}>Remove</button>
              </div>
            );
          }

          const pay = computeDay(entry, sites);
          const known = siteNames.some((n) => n.toLowerCase() === entry.site.trim().toLowerCase());
          const detailed = isDetailed(entry);
          const bump = (delta: number) => patch(entry.id, { hours: Math.min(24, Math.max(0, Math.round((entry.hours + delta) * 4) / 4)) });
          return (
            <div className="entry" key={entry.id} data-entry-id={entry.id}>
              <label>
                Site
                <select value={entry.site} onChange={(e) => changeSite(entry, e.target.value)}>
                  {!known && <option value={entry.site}>{entry.site || "Choose…"} (not in rates)</option>}
                  {siteNames.map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
              {(() => {
                const roleNames = rolesFor(findSite(sites, entry.site));
                const orphan = entry.role && !roleNames.some((r) => r.toLowerCase() === entry.role!.toLowerCase());
                return (
                  <label className="field-short">
                    Role
                    <select value={entry.role ?? ""} onChange={(e) => patch(entry.id, { role: e.target.value || undefined })}>
                      <option value="">Not applicable</option>
                      {roleNames.map((r) => <option key={r} value={r}>{r}</option>)}
                      {orphan && <option value={entry.role}>{entry.role} (not in rates)</option>}
                    </select>
                  </label>
                );
              })()}
              <div className="checks">
                <label><input type="checkbox" checked={!!entry.lead} onChange={(e) => patch(entry.id, { lead: e.target.checked })} /> Team lead / instructor</label>
                <label><input type="checkbox" checked={!!entry.holiday} onChange={(e) => patch(entry.id, { holiday: e.target.checked })} /> Holiday / TAR</label>
                <p className="muted small">Tick for a public holiday, or a turnaround / shutdown. It is paid at the holiday rate, even on a weekend.</p>
              </div>

              <div className="hours-block">
                <span className="lbl">Hours paid</span>
                {detailed ? (
                  <div className="hours-tile" aria-label="Hours paid">
                    <strong>{hoursText(entry.hours)} h</strong>
                    <span className="muted small">
                      {entry.hours > 0 || (entry.startTime && entry.endTime)
                        ? <>{entry.startTime}–{entry.endTime} is {durationText(entry.startTime, entry.endTime)}{entry.lunchPaid ? ", lunch paid" : `, minus ${(entry.lunchMinutes ?? 60) === 30 ? "30 min" : "1 hour"} unpaid lunch`}</>
                        : "Set the start and end time below."}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="hours-big">
                      <button type="button" aria-label="Half an hour less" onClick={() => bump(-0.5)}>−</button>
                      <label className="hours-field">
                        <HoursField value={entry.hours} onChange={(hours) => patch(entry.id, { hours })} />
                        <span>h</span>
                      </label>
                      <button type="button" aria-label="Half an hour more" onClick={() => bump(0.5)}>+</button>
                    </div>
                    <span className="muted small">Only the hours you are paid for. 12 h on site minus a 1 h unpaid lunch, enter 11.</span>
                  </>
                )}
              </div>

              {detailed ? (
                <div className="detail-box">
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
                  <div className="mode-switch">
                    <button type="button" className="circle-btn" aria-label="Simple: type the hours instead" onClick={() => setDraft((list) => list.map((e) => (e.id === entry.id ? toSimple(e) : e)))}>
                      <ChevronUp />Simple
                    </button>
                    <span className="muted small">Type the hours instead of using start and end time.</span>
                  </div>
                </div>
              ) : (
                <div className="mode-switch">
                  <button type="button" className="circle-btn" aria-label="Detailed: start and end time, lunch" onClick={() => setDraft((list) => list.map((e) => (e.id === entry.id ? toDetailed(e) : e)))}>
                    <ChevronDown />Detailed
                  </button>
                  <span className="muted small">Add start and end time, and lunch.</span>
                </div>
              )}

              <div className="preview">
                {entry.hours > 0 || pay.dailyPay > 0 ? (
                  <>
                    <span>
                      {pay.dailyPay > 0 ? `Flat ${money(pay.dailyPay)}` : `${money(pay.rate)}/h`}
                      {pay.tierHours.x15 + pay.tierHours.x2 + pay.tierHours.x3 > 0 &&
                        ` · OT ${[["×1.5", pay.tierHours.x15], ["×2", pay.tierHours.x2], ["×3", pay.tierHours.x3]].filter(([, h]) => Number(h) > 0).map(([l, h]) => `${h} h ${l}`).join(", ")}`}
                    </span>
                    <strong>{money(pay.total)}</strong>
                  </>
                ) : (
                  <span className="muted">{detailed ? "Set the start and end time to see the pay." : "Enter the hours to see the pay."}</span>
                )}
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
