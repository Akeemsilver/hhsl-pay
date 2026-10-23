import { useState } from "react";
import { DEFAULT_ROLES } from "../model";
import { emptyTimesheetSettings, timesheetSummary, type TimesheetRule } from "../timesheet";
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
  const [medic, setMedic] = useState(settings.medicEverywhere !== false);

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

  const latest = data.history.sites[data.history.sites.length - 1]?.value ?? {};
  const typedField = (site: string) => Object.entries(latest).find(([n]) => n.toLowerCase() === site.toLowerCase())?.[1].roleField;
  const find = (site: string, role?: string) => rules.find((r) => key(r) === key({ site, role }));
  const toggle = (site: string, role?: string) =>
    setRules((list) => (find(site, role) ? list.filter((r) => key(r) !== key({ site, role })) : [...list, { site, role, label: suggested(site, role) }]));
  const relabel = (site: string, role: string | undefined, label: string) =>
    setRules((list) => list.map((r) => (key(r) === key({ site, role }) ? { ...r, label } : r)));

  const dirty = JSON.stringify(rules) !== JSON.stringify(settings.rules) || other !== (settings.includeOther !== false) || medic !== (settings.medicEverywhere !== false);
  const save = () => update((d) => ({ ...d, timesheet: { ...(d.timesheet ?? emptyTimesheetSettings()), rules: rules.map((r) => ({ ...r, label: r.label.trim() || suggested(r.site, r.role) })), includeOther: other, medicEverywhere: medic } }));
  const cancel = () => { setRules(settings.rules); setOther(settings.includeOther !== false); setMedic(settings.medicEverywhere !== false); };

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
        {rule && !role && typedField(site) && <p className="muted small">The Client column uses what you type in “{typedField(site)!.label}” on each day. The text above is only used when that box is empty.</p>}
      </div>
    );
  };

  return (
    <section className="card tj">
      <h2>Jobs that go on the timesheet</h2>
      <p className="tj-summary" aria-live="polite">{timesheetSummary(rules, siteNames, other, medic)}</p>
      <p className="muted small">Tick a site to put every day there on the timesheet. Or leave the site unticked and tick only a role under it, such as Client medic, to put just those days on.</p>

      <div className="tj-row">
        <label className="tj-check">
          <input type="checkbox" checked={medic} onChange={(e) => setMedic(e.target.checked)} />
          <span>Client medic at every site <small className="muted">(named “Site Medic”)</small></span>
        </label>
      </div>

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
            <div className="tj-roles">
              <span className="muted small">{find(site) ? "Roles are already included" : "Or only these roles"}{ticked > 0 && !find(site) ? ` · ${ticked} ticked` : ""}</span>
              {roles.map((r) => row(site, r))}
            </div>
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
