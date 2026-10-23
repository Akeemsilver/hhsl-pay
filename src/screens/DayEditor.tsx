import { useEffect, useRef, useState } from "react";
import { SitePicker } from "../components/SitePicker";
import { computeDay, findSite, valueOn } from "../engine";
import { WEEKDAYS, durationText, hoursText, money } from "../format";
import { isDetailed, isOther, newId, rolesFor, siteHasLunch, toDetailed, toSimple, withComputedHours, type Entry } from "../model";
import { useNav } from "../nav";
import { holidayMap } from "../holidays";
import { useStore } from "../store";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { HoursField } from "../components/HoursField";
import { TimeField, quickTimes } from "../components/TimeField";
import { ChevronDown, ChevronUp } from "../components/Icons";
import { emptyTimesheetSettings, matchRule, type TimesheetRule } from "../timesheet";

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
  // The "Include on the time sheet" tick changes the site's time sheet rule, so it is held here until Save too.
  const originalRules = useRef<TimesheetRule[]>(data.timesheet?.rules ?? []);
  const [rulesDraft, setRulesDraft] = useState<TimesheetRule[]>(() => structuredClone(originalRules.current));
  // Other jobs go on the time sheet as a group (any other job, whatever it is called); this tick is that one setting.
  const originalOther = useRef(data.timesheet?.includeOther !== false);
  const [otherOn, setOtherOn] = useState(originalOther.current);
  const rulesChanged = JSON.stringify(rulesDraft) !== JSON.stringify(originalRules.current) || otherOn !== originalOther.current;
  const dirty = JSON.stringify(draft) !== JSON.stringify(original.current) || rulesChanged;
  // Only jobs were taken off (nothing else edited): the button says Remove instead of Save.
  const removingOnly = dirty && draft.length < original.current.length
    && !rulesChanged && draft.every((e) => JSON.stringify(original.current.find((o) => o.id === e.id)) === JSON.stringify(e));
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
    update((d) => ({
      ...d,
      entries: [...d.entries.filter((e) => e.date !== date), ...draft],
      ...(rulesChanged ? { timesheet: { ...(d.timesheet ?? emptyTimesheetSettings()), rules: rulesDraft, includeOther: otherOn } } : {}),
    }));
    leave();
  };

  /** Changing the site keeps the role when the new site offers it, otherwise it goes back to "Not applicable". */
  const changeSite = (entry: Entry, name: string) => {
    const next = findSite(sites, name);
    const was = findSite(sites, entry.site);
    const keep = next?.roleField ? !!was?.roleField : entry.role && rolesFor(next).some((r) => r.toLowerCase() === entry.role!.toLowerCase());
    patch(entry.id, { site: name, role: keep ? entry.role : undefined });
  };

  const holidayName = holidayMap([Number(date.slice(0, 4))], data).get(date);
  const lunchAt = (name: string) => siteHasLunch(findSite(sites, name));
  // A job that goes on the time sheet always uses start and end time: the hours come from the times and cannot be typed.
  const tsRules = rulesDraft;
  const medicAll = data.timesheet?.medicEverywhere !== false;
  const onSheet = (e: Entry) => !isOther(e) && !!matchRule(e, tsRules, false, medicAll);
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const siteRuleOf = (site: string) => rulesDraft.find((r) => !r.role && sameName(r.site, site));
  const roleRuleOf = (site: string, role: string) => rulesDraft.find((r) => r.role && sameName(r.site, site) && sameName(r.role, role));
  // With a role chosen the tick is for that role only (for example PLNL Client medic); with none it is for the whole site.
  const toggleSheet = (site: string, role: string | undefined, on: boolean) => {
    const next = on
      ? [...rulesDraft, role ? { site, role, label: `${site} ${role}` } : { site, label: site }]
      : rulesDraft.filter((r) => (role ? !(r.role && sameName(r.site, site) && sameName(r.role, role)) : r.role || !sameName(r.site, site)));
    setRulesDraft(next);
    // Those jobs switch to start and end time right away; their hours stay until the times are set.
    if (on) setDraft((list) => list.map((e) => (!isOther(e) && sameName(e.site, site) && (!role || sameName(e.role ?? "", role)) && !isDetailed(e) ? { ...e, detailed: true } : e)));
  };
  const patch = (id: string, changes: Partial<Entry>) =>
    setDraft((list) => list.map((e) => {
      if (e.id !== id) return e;
      const next = { ...e, ...changes };
      if (onSheet(next) && !isDetailed(next)) next.detailed = true;
      return withComputedHours(next, lunchAt(next.site));
    }));
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
    return withComputedHours(fresh, lunchAt(fresh.site));
  };
  const newOther = (): Entry => ({ id: newId(), date, kind: "other", site: "", hours: 0, description: "" });
  const addJob = () => setDraft((list) => [...list, newJob()]);
  const addOther = () => setDraft((list) => [...list, newOther()]);

  return (
    <>
      <BottomSheet label={`Entries for ${date}`} onRequestClose={requestClose} onPullDismiss={leave}>
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
                <label className="check ts-check">
                  <input type="checkbox" checked={otherOn} onChange={(e) => setOtherOn(e.target.checked)} />
                  <span>
                    Put other jobs on the time sheet
                    <small className="muted">All other jobs, whatever they are called.</small>
                  </span>
                </label>
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
                {duration && <p className="muted small">Duration {duration}. The hours below are filled in from the times.</p>}
                <label>
                  Hours worked (optional)
                  <HoursField value={entry.hours} onChange={(h) => patch(entry.id, { hours: h })} />
                  <span className="muted small">Goes in the hours column of the timesheet. Leave it blank if you do not know it.</span>
                </label>
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
          const forced = onSheet(entry);
          const detailed = isDetailed(entry) || forced;
          const bump = (delta: number) => patch(entry.id, { hours: Math.min(24, Math.max(0, Math.round((entry.hours + delta) * 4) / 4)) });
          return (
            <div className="entry" key={entry.id} data-entry-id={entry.id}>
              <SitePicker value={entry.site} names={siteNames} onPick={(n) => changeSite(entry, n)} />
              {findSite(sites, entry.site)?.roleField ? (
                <label>
                  {findSite(sites, entry.site)!.roleField!.label}
                  <input aria-label={findSite(sites, entry.site)!.roleField!.label}
                    value={entry.role ?? ""} placeholder={`e.g. ${findSite(sites, entry.site)!.roleField!.placeholder ?? ""}`.trim()}
                    onChange={(e) => patch(entry.id, { role: e.target.value || undefined })}
                  />
                </label>
              ) : (() => {
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
              {entry.site && (() => {
                const typedSite = !!findSite(sites, entry.site)?.roleField;
                const role = !typedSite && entry.role?.trim() ? entry.role.trim() : undefined;
                const siteRule = siteRuleOf(entry.site);
                const own = role ? !!roleRuleOf(entry.site, role) : !!siteRule;
                const viaOther = !own && forced;
                return (
                  <label className="check ts-check">
                    <input type="checkbox" checked={own || viaOther} disabled={viaOther} onChange={(e) => toggleSheet(entry.site, role, e.target.checked)} />
                    <span>
                      {role ? `Put ${entry.site} ${role} on the time sheet` : `Put ${entry.site} on the time sheet`}
                      <small className="muted">{viaOther ? (siteRule ? "The whole site is on it (Settings, Timesheet)." : "On it by a role rule (Settings, Timesheet).") : role ? `All ${role} days at this site, not just this one.` : "All days at this site, not just this one."}</small>
                    </span>
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
                      {entry.startTime && entry.endTime
                        ? <>{entry.startTime}–{entry.endTime} is {durationText(entry.startTime, entry.endTime)}{!lunchAt(entry.site) ? "" : entry.lunchPaid ? ", lunch paid" : `, minus ${(entry.lunchMinutes ?? 60) === 30 ? "30 min" : "1 hour"} unpaid lunch`}</>
                        : forced ? "This job goes on the time sheet. Set the start and end time below: the hours come from them." : "Set the start and end time below."}
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
                  {lunchAt(entry.site) && (
                    <div className="checks lunch">
                      <label><input type="checkbox" checked={!!entry.lunchPaid} onChange={(e) => patch(entry.id, { lunchPaid: e.target.checked })} /> Lunch was paid</label>
                    </div>
                  )}
                  {lunchAt(entry.site) && !entry.lunchPaid && (
                    <div className="lunch-length" role="group" aria-label="Unpaid lunch">
                      <span className="lbl">Unpaid lunch</span>
                      {[30, 60].map((m) => (
                        <button key={m} type="button" aria-pressed={(entry.lunchMinutes ?? 60) === m} className={(entry.lunchMinutes ?? 60) === m ? "on" : ""} onClick={() => patch(entry.id, { lunchMinutes: m })}>
                          {m === 30 ? "30 min" : "1 hour"}
                        </button>
                      ))}
                    </div>
                  )}
                  {!forced && <div className="mode-switch">
                    <button type="button" className="circle-btn" aria-label="Simple: type the hours instead" onClick={() => setDraft((list) => list.map((e) => (e.id === entry.id ? toSimple(e) : e)))}>
                      <ChevronUp />Simple
                    </button>
                    <span className="muted small">Type the hours instead of using start and end time.</span>
                  </div>}
                </div>
              ) : (
                <div className="mode-switch">
                  <button type="button" className="circle-btn" aria-label="Detailed: start and end time, lunch" onClick={() => setDraft((list) => list.map((e) => (e.id === entry.id ? withComputedHours(toDetailed(e), lunchAt(e.site)) : e)))}>
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
          {removingOnly
            ? <button className="danger outline" onClick={save}>Remove</button>
            : <button className="primary" onClick={save} disabled={!dirty}>Save</button>}
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
