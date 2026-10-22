import { useState } from "react";
import { DEFAULT_ROLES } from "../model";
import { emptyTimesheetSettings, type TimesheetRule } from "../timesheet";
import { useStore } from "../store";

const key = (r: { site: string; role?: string }) => `${r.site.toLowerCase()}|${(r.role ?? "").toLowerCase()}`;
const suggested = (site: string, role?: string) => (role ? `${site} ${role}` : site);

/**
 * Tick the jobs that go on the timesheet, one box for a whole site and one for each role at it, plus other jobs. Each
 * ticked job has the text that goes in the Client column. Nothing changes until Save.
 */
export function TimesheetJobs() {
  const { data, update } = useStore();
  const settings = data.timesheet ?? emptyTimesheetSettings();
  const [rules, setRules] = useState<TimesheetRule[]>(settings.rules);
  const [other, setOther] = useState(settings.includeOther !== false);

  // Every site, with the roles it can have (the standard ones and any it has its own pay for).
  const sites = new Map<string, Set<string>>();
  for (const v of data.history.sites) for (const [name, s] of Object.entries(v.value)) {
    const roles = sites.get(name) ?? new Set<string>(DEFAULT_ROLES);
    for (const r of Object.keys(s.roles ?? {})) roles.add(r);
    sites.set(name, roles);
  }
  const siteNames = [...sites.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const listed = new Set(siteNames.flatMap((n) => [key({ site: n }), ...[...sites.get(n)!].map((r) => key({ site: n, role: r }))]));
  const stray = rules.filter((r) => !listed.has(key(r)));

  const find = (site: string, role?: string) => rules.find((r) => key(r) === key({ site, role }));
  const toggle = (site: string, role?: string) =>
    setRules((list) => (find(site, role) ? list.filter((r) => key(r) !== key({ site, role })) : [...list, { site, role, label: suggested(site, role) }]));
  const relabel = (site: string, role: string | undefined, label: string) =>
    setRules((list) => list.map((r) => (key(r) === key({ site, role }) ? { ...r, label } : r)));

  const dirty = JSON.stringify(rules) !== JSON.stringify(settings.rules) || other !== (settings.includeOther !== false);
  const save = () => update((d) => ({ ...d, timesheet: { ...(d.timesheet ?? emptyTimesheetSettings()), rules: rules.map((r) => ({ ...r, label: r.label.trim() || suggested(r.site, r.role) })), includeOther: other } }));
  const cancel = () => { setRules(settings.rules); setOther(settings.includeOther !== false); };

  const row = (site: string, role?: string) => {
    const rule = find(site, role);
    return (
      <div className="tj-row" key={key({ site, role })}>
        <label className="tj-check">
          <input type="checkbox" checked={!!rule} onChange={() => toggle(site, role)} />
          <span>{role ?? site}</span>
        </label>
        {rule && (
          <label className="tj-label">Client column
            <input value={rule.label} onChange={(e) => relabel(site, role, e.target.value)} placeholder={suggested(site, role)} />
          </label>
        )}
      </div>
    );
  };

  return (
    <section className="card tj">
      <h2>Jobs that go on the timesheet</h2>
      <p className="muted small">Tick every job that should be on your payroll timesheet, then press Save. Client medic jobs at any site are always included, named “Site Medic”. Anything not ticked stays off the form.</p>

      <div className="tj-row">
        <label className="tj-check">
          <input type="checkbox" checked={other} onChange={(e) => setOther(e.target.checked)} />
          <span>Other jobs <small className="muted">(pickups, deliveries)</small></span>
        </label>
        {other && <p className="muted small">Each is its own row, “what it was” in the Client column, with the hours from its start and end time. Which payslip they are paid on is set in Settings.</p>}
      </div>

      {siteNames.length === 0 && <p className="muted">Add your sites first under Site locations &amp; rates.</p>}
      {siteNames.map((site) => {
        const roles = [...sites.get(site)!];
        const ticked = roles.filter((r) => find(site, r)).length;
        return (
          <div className="tj-site" key={site}>
            {row(site)}
            <details className="tj-roles">
              <summary>Roles{ticked > 0 ? ` · ${ticked} ticked` : ""}</summary>
              {roles.map((r) => row(site, r))}
            </details>
          </div>
        );
      })}

      {stray.length > 0 && (
        <div className="tj-site">
          <p className="muted small">Older timesheet jobs for sites you no longer have. Untick to remove.</p>
          {stray.map((r) => row(r.site, r.role))}
        </div>
      )}

      <div className={`save-bar ${dirty ? "" : "idle"}`} role="group" aria-label="Save the timesheet jobs">
        <button className="primary" disabled={!dirty} onClick={save}>{dirty ? "Save" : "Saved"}</button>
        {dirty && <button onClick={cancel}>Cancel</button>}
      </div>
    </section>
  );
}
