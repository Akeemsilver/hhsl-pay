import { useNav } from "../nav";
import { useStore } from "../store";
import { useTheme, type ThemePref } from "../theme";
import { PageHeader } from "../components/TopBar";
import { ChevronRight, SaveIcon, SlidersIcon } from "../components/Icons";

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

      <h2 className="section-title">Your data</h2>
      <ul className="menu">
        <li>
          <button onClick={() => open({ page: "rates" })}>
            <SlidersIcon />
            <span><strong>Rates &amp; tax</strong><small>{sites} site{sites === 1 ? "" : "s"}, payslips, raises and tax rules</small></span>
            <ChevronRight />
          </button>
        </li>
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
