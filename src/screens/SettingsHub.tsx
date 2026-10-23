import { loadTemplate } from "../storage";
import { ShareGuide } from "../components/ShareGuide";
import { InstallHelp } from "../components/InstallHelp";
import { appLink, siteCount } from "../kit";
import { backupFileName, deliver, download, ratesKitOf, serialize, SHARE_TYPES, shareFile, withTime } from "../backup";
import { useNav } from "../nav";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { newData, isCombined, userNameOf } from "../model";
import { OtherJobsPayer, TaxSegment } from "../components/TaxMode";
import { localDMY, todayISO } from "../format";
import { useStore } from "../store";
import { useTheme, type ThemePref } from "../theme";
import { PageHeader } from "../components/TopBar";
import { CalendarIcon, ChevronRight, FileIcon, MapPinIcon, SaveIcon, ShieldIcon, UsersIcon } from "../components/Icons";

/** The starter kit is saved as a .txt so the download and the share are the same file. */
const kitFileName = () => backupFileName("rates", false).replace(/\.json$/, ".txt");

/** The mobile guide (a PDF with no rates in it) is served with the app, so it can be shared from here. */
const GUIDE_FILE = "HHSL-pay-app-mobile-guide.pdf";

export function SettingsHub() {
  const { open, selectTab } = useNav();
  const { data, persistent, update, replace } = useStore();
  const [ask, setAsk] = useState<"settings" | "days" | "all" | null>(null);

  const [theme, setTheme] = useTheme();
  const thisMonth = todayISO().slice(0, 7);
  const combinedNow = isCombined(data);
  const link = appLink();
  const sitesCount = siteCount(data);
  const [copied, setCopied] = useState(false);
  const [askDownload, setAskDownload] = useState(false);
  const [askShare, setAskShare] = useState(false);
  // The guide is fetched ahead of time too, so one tap opens the share menu.
  const [guide, setGuide] = useState<Uint8Array | null>(null);
  const [guideMessage, setGuideMessage] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`${import.meta.env.BASE_URL}${GUIDE_FILE}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => live && setGuide(new Uint8Array(b))).catch(() => {});
    return () => { live = false; };
  }, []);
  const shareGuidePdf = async () => {
    if (!guide) { setGuideMessage("The guide is not ready yet. It needs a signal; try again in a moment."); return; }
    try {
      const how = await deliver(GUIDE_FILE, guide, "application/pdf");
      setGuideMessage(how === "shared" ? "Guide shared." : "Guide saved to your Downloads. Send that file on WhatsApp.");
    } catch { setGuideMessage(null); }
  };
  const [kitMessage, setKitMessage] = useState<string | null>(null);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); } catch {
      const el = document.querySelector<HTMLInputElement>('input[aria-label="App link"]');
      el?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const shareLink = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "HHSL pay app", text: "The pay app link:", url: link });
      else await copyLink();
    } catch { /* cancelled */ }
  };
  const kitText = async () => serialize("rates", ratesKitOf(data, await loadTemplate()));
  // The kit is built ahead of time so that tapping Share opens the share menu straight away (phones only allow
  // it right after a tap).
  const [kit, setKit] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (sitesCount > 0) void kitText().then((t) => live && setKit(t));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.history, data.payerNames, data.siteColors, data.timesheet, data.otherPayer, data.taxMode, data.combinedTax, data.holidays, sitesCount]);
  // Each tap makes one attempt (the phone allows one per tap); a refused attempt moves on to the next file type.
  const attempt = useRef(0);
  const savedKit = useRef(false);
  const shareKit = async (saveFirst = false) => {
    if (!kit) { setKitMessage("Getting the starter kit ready, try again in a moment."); return; }
    const tried = attempt.current;
    // Saved to Downloads first, in the same tap, so the file is safe even if the share menu is refused.
    if (saveFirst && !savedKit.current) { download(withTime(kitFileName()), kit, "text/plain"); savedKit.current = true; }
    const { result, error, type } = await shareFile(backupFileName("rates", false), kit, tried);
    if (result === "shared") { attempt.current = 0; savedKit.current = false; setKitMessage("Starter kit saved to your Downloads and shared."); }
    else if (result === "cancelled") { savedKit.current = false; setKitMessage("Starter kit saved to your Downloads."); }
    else if (result === "failed" && tried < SHARE_TYPES.length - 1) {
      attempt.current = tried + 1;
      setKitMessage(`The file is saved to your Downloads, but the share menu did not open (${error}). Tap “Share starter kit” again to try another way.`);
    } else if (result === "failed") {
      attempt.current = 0;
      setKitMessage(`The share menu would not open (${error}; tried ${SHARE_TYPES.length} ways, last as ${type}). Use “Download starter kit”, then send the file from your Downloads.`);
    } else setKitMessage("This browser cannot open the share menu. Use “Download starter kit” and send the file from your Downloads.");
  };
  const saveKit = async () => {
    download(withTime(kitFileName()), await kitText(), "text/plain");
    setKitMessage("Starter kit saved to your Downloads. Send that file on WhatsApp.");
  };
  const sites = new Set(data.history.sites.flatMap((v) => Object.keys(v.value))).size;
  return (
    <>
      <PageHeader title="Settings" />

      <h2 className="section-title">Install on your phone</h2>
      <section className="card">
        <InstallHelp />
      </section>

      <h2 className="section-title">Share this app</h2>
      <section className="card share-app">
        <p className="muted small">To give a colleague the app: send them the link, then send the starter kit file with your pay rates. On their first start the app asks for that file.</p>
        <label>App link
          <input readOnly aria-label="App link" value={link} onFocus={(e) => e.currentTarget.select()} />
        </label>
        <div className="row">
          <button onClick={copyLink}>{copied ? "Copied ✓" : "Copy link"}</button>
          <button onClick={() => void shareLink()}>Share link</button>
        </div>
        <p className="muted small">Starter kit: your sites, rates, tax rules and the timesheet form (no days, no pay, no name). It has to be sent as a file because this app's code is public, and company rates must never be put in public code. Only send it to colleagues.</p>
        <div className="row">
          <button className="primary" disabled={sitesCount === 0} onClick={() => setAskShare(true)}>Share starter kit</button>
          <button disabled={sitesCount === 0} onClick={() => setAskDownload(true)}>Download starter kit</button>
        </div>
        {kitMessage && <p className="notice" role="status">{kitMessage}</p>}
        <p className="muted small">Mobile guide: a step-by-step PDF with pictures that shows your colleague how to install the app and load the starter kit. Send it too.</p>
        <div className="row">
          <button onClick={() => void shareGuidePdf()}>Share guide (PDF)</button>
        </div>
        {guideMessage && <p className="notice" role="status">{guideMessage}</p>}
        {sitesCount === 0 && <p className="muted small">Add your sites first, then the starter kit is ready to share.</p>}
        <ShareGuide link={link} />
      </section>

      <h2 className="section-title">Your name</h2>
      <section className="card">
        <label>Name on payslips and timesheets
          <input aria-label="Your name" value={data.userName ?? userNameOf(data)} onChange={(e) => update((d) => ({ ...d, userName: e.target.value }))} />
        </label>
      </section>

      <h2 className="section-title">Appearance</h2>
      <section className="card">
        <div className="segmented three" role="group" aria-label="Theme">
          {([["system", "System"], ["light", "Light"], ["dark", "Dark"]] as Array<[ThemePref, string]>).map(([id, label]) => (
            <button key={id} aria-pressed={theme === id} className={theme === id ? "on" : ""} onClick={() => setTheme(id)}>{label}</button>
          ))}
        </div>
        <p className="muted small">System follows your phone's light or dark setting.</p>
      </section>

      <h2 className="section-title">How tax is worked out</h2>
      <section className="card">
        <TaxSegment />
        <p className="muted small">
          {combinedNow
            ? "Combined: one gross, one PAYE, one NIS and one health surcharge on everything."
            : "Split: Point Lisas / other and Atlantic each pay their own PAYE, NIS and health surcharge. The totals add them together, with each place shown in small print."}
          {" "}This applies to the whole app. <button className="link" onClick={() => open({ page: "payslips" })}>Open settings</button>
        </p>
        <OtherJobsPayer />
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
        <li>
          <button onClick={() => open({ page: "holidays" })}>
            <CalendarIcon />
            <span><strong>Public holidays</strong><small>Shown in red on the calendar</small></span>
            <ChevronRight />
          </button>
        </li>
      </ul>

      <h2 className="section-title">Your data</h2>
      <ul className="menu">
        <li>
          <button onClick={() => open({ page: "backup" })}>
            <SaveIcon />
            <span><strong>Backup &amp; restore</strong><small>{data.lastBackupAt ? `Last backup ${localDMY(new Date(data.lastBackupAt))}` : "Not backed up yet"}</small></span>
            <ChevronRight />
          </button>
        </li>
      </ul>
      <h2 className="section-title">Reset to default</h2>
      <section className="card">
        <p className="muted small">Put the app's settings back the way they were when you first installed it. Your logged days, site rates and name are kept.</p>
        <button className="wide" onClick={() => setAsk("settings")}>Reset settings to default</button>
        <p className="muted small">Clear the days and jobs you logged ({data.entries.length}, including other jobs and any payslip corrections) but keep your rates, settings and name. Good for starting a new year or testing.</p>
        <button className="wide" disabled={data.entries.length === 0} onClick={() => setAsk("days")}>Reset days and jobs</button>
        <p className="muted small">Or start completely fresh. This erases your days, rates, name and everything else on this phone.</p>
        <button className="danger wide" onClick={() => setAsk("all")}>Erase everything</button>
      </section>
      {ask && (
        <ConfirmDialog
          title={ask === "settings" ? "Reset settings?" : ask === "days" ? "Reset days and jobs?" : "Erase everything?"}
          message={ask === "days"
            ? `All ${data.entries.length} logged days and jobs, other jobs, and payslip corrections are deleted. Your rates, settings and name stay. This cannot be undone, so back up first if you need them.`
            : ask === "settings"
            ? "Appearance, tax tables, the Split / Combined choice, public holiday edits and timesheet job rules go back to default. Your days, site rates and name stay."
            : "All your days, rates, settings and your name are deleted from this phone. This cannot be undone. Back up first if you might need them."}
          confirmLabel={ask === "settings" ? "Reset" : ask === "days" ? "Delete all days" : "Erase everything"}
          cancelLabel="Keep"
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            if (ask === "days") {
              update((d) => ({ ...d, entries: [], corrections: undefined }));
            } else if (ask === "settings") {
              setTheme("light");
              update((d) => {
                const fresh = newData();
                return {
                  ...d,
                  history: { ...d.history, tax: fresh.history.tax },
                  taxMode: undefined, combinedTax: undefined, holidays: undefined,
                  timesheet: d.timesheet ? { ...d.timesheet, siteLabel: "ERT Offsite", rules: [] } : undefined,
                };
              });
            } else {
              replace(newData());
              setTheme("light");
              selectTab("home");
            }
            setAsk(null);
          }}
        />
      )}
      {askShare && (
        <ConfirmDialog
          title="Download and share the starter kit?"
          message="The file with your sites, pay rates, tax rules and the timesheet form is saved to this phone's Downloads, then the share menu opens so you can send it on WhatsApp or Gmail. It has your company rates, so only send it to colleagues."
          confirmLabel="Yes, download and share" cancelLabel="Cancel" safe
          onCancel={() => setAskShare(false)}
          onConfirm={() => { setAskShare(false); void shareKit(true); }}
        />
      )}
      {askDownload && (
        <ConfirmDialog
          title="Download the starter kit?"
          message="It saves a file with your sites, pay rates, tax rules and the timesheet form to this phone's Downloads. It has no days and no pay, but it does have your company rates. Only send it to colleagues."
          confirmLabel="Download" cancelLabel="Cancel" safe
          onCancel={() => setAskDownload(false)}
          onConfirm={() => { setAskDownload(false); void saveKit(); }}
        />
      )}
      <p className="muted small pad" aria-label="App version">Version {typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev"}</p>
      <p className="muted small pad">
        Everything is saved on this phone only. There is no account and no server. {persistent ? "The browser has agreed to keep your data." : "Back up regularly so a cleared browser or lost phone does not lose your entries."}
      </p>
    </>
  );
}
