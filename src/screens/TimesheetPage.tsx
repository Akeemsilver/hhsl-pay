import { useRef, useState } from "react";
import { TimesheetJobs } from "../components/TimesheetJobs";
import { DEFAULT_PAYROLL_EMAIL, emptyTimesheetSettings } from "../timesheet";
import { useTemplate } from "../hooks";
import { userNameOf } from "../model";
import { useStore } from "../store";
import { PageHeader } from "../components/TopBar";

export function TimesheetPage() {
  const { data, update } = useStore();
  const settings = data.timesheet ?? emptyTimesheetSettings();
  const setSettings = (patch: Partial<typeof settings>) => update((d) => ({ ...d, timesheet: { ...(d.timesheet ?? emptyTimesheetSettings()), ...patch } }));
  const { template, save, clear } = useTemplate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

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

      <TimesheetJobs />

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
