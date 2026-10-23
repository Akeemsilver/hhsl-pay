import { useState } from "react";
import { computeDay, valueOn } from "../engine";
import { dayDMY, dmy, hoursText, money, timeRange } from "../format";
import { isOther, type Entry } from "../model";
import { useNav } from "../nav";
import { useSiteFilter } from "../filter";
import { useStore } from "../store";
import { ConfirmDialog } from "./ConfirmDialog";

/** The selected day's jobs, shown under the calendar, with Edit, Delete and Add job. */
export function DayPanel({ date }: { date: string }) {
  const { data, update } = useStore();
  const { open } = useNav();
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const sites = valueOn(data.history.sites, date);
  const { site: filterSite } = useSiteFilter();
  const jobs = data.entries.filter((e) => e.date === date && (!filterSite || e.site === filterSite));
  const total = jobs.reduce((s, e) => s + (isOther(e) ? (e.amount ?? 0) : computeDay(e, sites).total), 0);
  const noSites = Object.keys(sites).length === 0;

  return (
    <section className="card day-panel" aria-label={`Jobs on ${dmy(date)}`}>
      <div className="card-head">
        <h2>{dayDMY(date)}</h2>
        {total > 0 && <strong>{money(total)}</strong>}
      </div>

      {jobs.length === 0 && <p className="muted">No jobs on this day.</p>}

      {jobs.map((e) => {
        const other = isOther(e);
        const pay = other ? null : computeDay(e, sites);
        const times = timeRange(e.startTime, e.endTime);
        return (
          <div className={`day-job ${other ? "other" : ""}`} key={e.id}>
            <div className="info">
              <div className="title">
                <strong>{other ? `Other · ${e.description || "no description"}` : e.site}</strong>
                {e.role && <span className="badge">{e.role}</span>}
                {e.lead && <span className="badge">Team lead</span>}
                {e.holiday && <span className="badge">Holiday / TAR</span>}
              </div>
              <span className="muted small">
                {[times, !other && e.hours > 0 ? `${hoursText(e.hours)} h paid` : "", other && e.amount ? `paid ${money(e.amount)}` : ""].filter(Boolean).join(" · ") || "no times"}
              </span>
            </div>
            {pay && <span className="amount">{money(pay.total)}</span>}
            <div className="row">
              <button onClick={() => open({ day: date, focus: e.id })}>Edit</button>
              <button className="danger" onClick={() => setDeleting(e)}>Delete</button>
            </div>
          </div>
        );
      })}

      <div className="grid2 add-buttons">
        <button className="primary" disabled={noSites} onClick={() => open({ day: date, add: "job" })}>＋ Add job</button>
        <button onClick={() => open({ day: date, add: "other" })}>＋ Other job</button>
      </div>
      {noSites && <p className="muted small">Add your sites in Settings first to log a job.</p>}

      {deleting && (
        <ConfirmDialog
          title="Delete this job?"
          message={`${isOther(deleting) ? deleting.description || "This other job" : deleting.site} on ${dmy(date)} will be removed.`}
          cancelLabel="Keep it"
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => { update((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== deleting.id) })); setDeleting(null); }}
        />
      )}
    </section>
  );
}
