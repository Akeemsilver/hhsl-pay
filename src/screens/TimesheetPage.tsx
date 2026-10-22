import { useRef, useState } from "react";
import { DEFAULT_PAYROLL_EMAIL, emptyTimesheetSettings, type TimesheetRule } from "../timesheet";
import { useTemplate } from "../hooks";
import { DEFAULT_ROLES, userNameOf } from "../model";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";

export function TimesheetPage() {
  const { data, update } = useStore();
  const settings = data.timesheet ?? emptyTimesheetSettings();
  const setSettings = (patch: Partial<typeof settings>) => update((d) => ({ ...d, timesheet: { ...(d.timesheet ?? emptyTimesheetSettings()), ...patch } }));
  const { template, save, clear } = useTemplate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sites = new Map<string, string[]>();
  for (const v of data.history.sites) for (const [name, s] of Object.entries(v.value)) {
    const roles = new Set([...DEFAULT_ROLES, ...(sites.get(name) ?? []), ...Object.keys(s.roles ?? {})]);
    sites.set(name, [...roles]);
  }
  const siteNames = [...sites.keys()];
  const [site, setSite] = useState(siteNames[0] ?? "");
  const [role, setRole] = useState("");
  const [label, setLabel] = useState("");
  const roles = sites.get(site) ?? [];
  const suggested = role ? `${site} ${role}` : site;

  const addRule = () => {
    const rule: TimesheetRule = { site, role: role || undefined, label: (label || suggested).trim() };
    setSettings({ rules: [...settings.rules, rule] });
    setLabel("");
  };
  const duplicate = settings.rules.some((r) => r.site === site && (r.role ?? "") === role);

  return (
    <>
      <PageHeader title="Timesheet" />
      <p className="muted pad">Set this up once. Then “Download timesheet” on the Calendar fills your payroll form for the month you are viewing.</p>

      <section className="card">
        <h2>Header</h2>
        <label>Your name (printed in block letters)
          <input value={userNameOf(data)} autoCapitalize="characters" onChange={(e) => update((d) => ({ ...d, userName: e.target.value }))} />
        </label>
        <label>Site line
          <input value={settings.siteLabel} onChange={(e) => setSettings({ siteLabel: e.target.value })} />
        </label>
        <label>Payroll email (for “Send to payroll”)
          <input type="email" inputMode="email" autoCapitalize="none" value={settings.payrollEmail ?? DEFAULT_PAYROLL_EMAIL} onChange={(e) => setSettings({ payrollEmail: e.target.value })} />
        </label>
      </section>

      <section className="card">
        <h2>Other jobs</h2>
        <label className="check">
          <input type="checkbox" aria-label="List other jobs on the timesheet" checked={settings.includeOther !== false} onChange={(e) => setSettings({ includeOther: e.target.checked })} />
          {" "}List other jobs (pickups, deliveries) on the timesheet
        </label>
        <p className="muted small">Each one appears as its own row, named “Other job - what it was”, with the hours from its start and end time. They are also paid and listed on the payslip once you enter their amount.</p>
      </section>

      <section className="card">
        <h2>Jobs that go on the timesheet</h2>
        <p className="muted small">Only these jobs are listed when you download. Client medic jobs at any site are always included automatically (named “Site Medic”, e.g. “PLNL Medic”). Everything else stays off the form.</p>
        {settings.rules.length === 0 ? <p className="muted">None yet. Add your first below.</p> : (
          <ul className="rule-list">
            {settings.rules.map((r, i) => (
              <li key={`${r.site}|${r.role ?? ""}`}>
                <span>
                  {r.site} · {r.role ?? "any role"}
                  <small>Client column: “{r.label}”</small>
                </span>
                <button className="icon" aria-label={`Remove ${r.site} ${r.role ?? ""}`} onClick={() => setSettings({ rules: settings.rules.filter((_, j) => j !== i) })}>✕</button>
              </li>
            ))}
          </ul>
        )}
        {siteNames.length === 0 ? <p className="muted">Add your sites first under Site locations & rates.</p> : (
          <>
            <div className="grid2">
              <label>Site
                <select value={site} onChange={(e) => { setSite(e.target.value); setRole(""); setLabel(""); }}>
                  {siteNames.map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
              <label>Role
                <select value={role} onChange={(e) => { setRole(e.target.value); setLabel(""); }}>
                  <option value="">Any role</option>
                  {roles.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
            </div>
            <label>Client column text
              <input value={label} placeholder={suggested} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <button className="primary" disabled={!site || duplicate} onClick={addRule}>{duplicate ? "Already added" : "Add to timesheet"}</button>
          </>
        )}
      </section>

      <section className="card">
        <h2>Time sheet template</h2>
        <p className="muted small">Choose the blank HHSL time sheet (.xlsx) from your office once. It is kept on this phone only, so your logo and layout stay exactly as HHSL made them.</p>
        <p>{template === undefined ? "Checking…" : template ? <>Loaded: <strong>{template.name}</strong></> : "No template yet."}</p>
        <input ref={fileInput} type="file" hidden accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setMessage((await save(f)) ? null : "Could not save the template on this phone.");
          }} />
        <div className="row">
          <button className="primary" onClick={() => fileInput.current?.click()}>{template ? "Replace template…" : "Choose template…"}</button>
          {template && <button className="danger" onClick={() => confirm("Remove the saved template?") && void clear()}>Remove</button>}
        </div>
        {message && <p className="bad" role="alert">{message}</p>}
        <p className="muted small">The template is not part of backups. Choose it again on a new phone.</p>
      </section>
    </>
  );
}
