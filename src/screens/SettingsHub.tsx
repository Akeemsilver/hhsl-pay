import { useNav } from "../nav";
import { useStore } from "../store";
import { useTheme, type ThemePref } from "../theme";
import { PageHeader } from "../components/TopBar";
import { ChevronRight, FileIcon, MapPinIcon, SaveIcon, ShieldIcon, UsersIcon } from "../components/Icons";

export function SettingsHub() {
  const { open } = useNav();
  const { data, persistent } = useStore();
  const [theme, setTheme] = useTheme();
  const sites = new Set(data.history.sites.flatMap((v) => Object.keys(v.value))).size;
  return (
    <>
      <PageHeader title="Settings" />

      <h2 className="section-title">Appearance</h2>
      <section className="card">
        <div className="segmented three" role="group" aria-label="Theme">
          {([["system", "System"], ["light", "Light"], ["dark", "Dark"]] as Array<[ThemePref, string]>).map(([id, label]) => (
            <button key={id} aria-pressed={theme === id} className={theme === id ? "on" : ""} onClick={() => setTheme(id)}>{label}</button>
          ))}
        </div>
        <p className="muted small">System follows your phone's light or dark setting.</p>
      </section>

      <h2 className="section-title">Your work</h2>
      <ul className="menu">
        <li>
          <button onClick={() => open({ page: "sites" })}>
            <MapPinIcon />
            <span><strong>Site locations &amp; rates</strong><small>{sites} site{sites === 1 ? "" : "s"}, roles and pay rates</small></span>
            <ChevronRight />
          </button>
        </li>
        <li>
          <button onClick={() => open({ page: "tax" })}>
            <ShieldIcon />
            <span><strong>NIS &amp; tax</strong><small>NIS table, PAYE, and when the rules change</small></span>
            <ChevronRight />
          </button>
        </li>
        <li>
          <button onClick={() => open({ page: "payslips" })}>
            <UsersIcon />
            <span><strong>Payslips</strong><small>{Object.keys(data.payerNames).length} payslip{Object.keys(data.payerNames).length === 1 ? "" : "s"}</small></span>
            <ChevronRight />
          </button>
        </li>
        <li>
          <button onClick={() => open({ page: "timesheet" })}>
            <FileIcon />
            <span><strong>Timesheet</strong><small>{data.timesheet?.rules.length ? `${data.timesheet.rules.length} job rule${data.timesheet.rules.length === 1 ? "" : "s"}` : "Name, jobs to include, template"}</small></span>
            <ChevronRight />
          </button>
        </li>
      </ul>

      <h2 className="section-title">Your data</h2>
      <ul className="menu">
        <li>
          <button onClick={() => open({ page: "backup" })}>
            <SaveIcon />
            <span><strong>Backup &amp; restore</strong><small>{data.lastBackupAt ? `Last backup ${new Date(data.lastBackupAt).toLocaleDateString()}` : "Not backed up yet"}</small></span>
            <ChevronRight />
          </button>
        </li>
      </ul>
      <p className="muted small pad">
        Everything is saved on this phone only. There is no account and no server. {persistent ? "The browser has agreed to keep your data." : "Back up regularly so a cleared browser or lost phone does not lose your entries."}
      </p>
    </>
  );
}
