import { useRef, useState } from "react";
import { loadTemplate, saveTemplate } from "../storage";
import { applyKit, fromB64, ratesKitOf, BadBackup, PasswordRequired, backupFileName, deliver, isEncrypted, parse, serialize } from "../backup";
import { newData } from "../model";
import { useStore } from "../store";
import { AnnualImport } from "../components/AnnualImport";
import { TimesheetImport } from "../components/TimesheetImport";
import { PageHeader } from "../components/TopBar";

export function BackupScreen() {
  const { data, update, replace, persistent } = useStore();
  const [lock, setLock] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const fullInput = useRef<HTMLInputElement>(null);
  const ratesInput = useRef<HTMLInputElement>(null);

  const say = (text: string, ok = true) => setMessage({ text, ok });
  const pw = lock && password ? password : undefined;

  async function backUp(kind: "full" | "rates") {
    if (lock && !password) return say("Enter a password, or turn off the password lock.", false);
    try {
      const text = await serialize(kind, kind === "full" ? data : ratesKitOf(data, await loadTemplate()), pw);
      const how = await deliver(backupFileName(kind, !!pw), text);
      if (kind === "full") update((d) => ({ ...d, lastBackupAt: new Date().toISOString() }));
      say(how === "shared" ? "Backup shared. Keep that file somewhere safe." : "Backup saved to your Downloads. Keep that file somewhere safe.");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") say("Could not create the backup.", false);
    }
  }

  async function readFile(file: File, kind: "full" | "rates") {
    const text = await file.text();
    let pass: string | undefined;
    if (isEncrypted(text)) {
      pass = prompt("This backup is locked. Enter its password:") ?? undefined;
      if (!pass) return;
    }
    try {
      const parsed = await parse(text, pass);
      if (parsed.kind !== kind) return say(kind === "full" ? "That is a rates file, not a full backup." : "That is a full backup, not a rates file.", false);
      if (parsed.kind === "full" && parsed.data) {
        if (!confirm(`Replace everything on this phone with the backup (${parsed.data.entries.length} entries)?`)) return;
        replace({ ...parsed.data, lastBackupAt: new Date().toISOString() });
        say("Backup restored.");
      } else if (parsed.history) {
        if (!confirm("Replace your sites, rates and tax rules with the ones in this file? Your entries are kept.")) return;
        const kit = parsed.kit ?? { ...parsed.history };
        update((d) => applyKit(d, kit));
        let withForm = false;
        if (kit.timesheetTemplate?.data) {
          const bytes = fromB64(kit.timesheetTemplate.data);
          withForm = await saveTemplate({ name: kit.timesheetTemplate.name, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
        }
        say(withForm ? "Rates and the timesheet form imported." : "Rates imported.");
      }
    } catch (e) {
      say(e instanceof PasswordRequired ? "This backup needs a password." : e instanceof BadBackup ? e.message : "Could not read that file.", false);
    }
  }

  return (
    <>
      <PageHeader title="Backup & restore" />
      <p className="muted pad">Your entries are saved only on this phone. There is no account and no server, so a backup file is the only way to move to a new phone or recover from a lost one.</p>

      {message && <p className={`notice ${message.ok ? "" : "warn"}`} role="status">{message.text}</p>}

      <section className="card">
        <h2>Back up everything</h2>
        <p className="muted small">
          {data.lastBackupAt ? `Last backup: ${new Date(data.lastBackupAt).toLocaleString()}` : "Not backed up yet."} · {data.entries.length} entries
        </p>
        <label className="check"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> Lock the file with a password</label>
        {lock && (
          <label>Password
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="muted small">There is no way to recover a forgotten password.</span>
          </label>
        )}
        <button className="primary wide" onClick={() => backUp("full")}>Back up / share file</button>
      </section>

      <section className="card">
        <h2>Restore from a backup</h2>
        <p className="muted small">Use this on a new phone. It replaces everything currently in the app.</p>
        <input ref={fullInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f, "full"); e.target.value = ""; }} />
        <button className="wide" onClick={() => fullInput.current?.click()}>Choose backup file…</button>
      </section>

      <AnnualImport />

      <TimesheetImport />

      <section className="card">
        <h2>Share rates only</h2>
        <p className="muted small">A file with your sites, rates and tax rules (no entries), so others can start from the same setup or receive a raise. Imports replace their rates and keep their entries.</p>
        <div className="row">
          <button onClick={() => backUp("rates")}>Share rates file</button>
          <button onClick={() => ratesInput.current?.click()}>Import rates file…</button>
        </div>
        <input ref={ratesInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f, "rates"); e.target.value = ""; }} />
      </section>

      <section className="card">
        <h2>Storage</h2>
        <p className="muted small">
          {persistent
            ? "This browser has agreed to keep the app's data unless you clear it."
            : "The browser may remove this data if the phone runs low on space or the site is unused for a long time. Install the app to the Home Screen and back up regularly."}
        </p>
        <button className="danger" onClick={() => confirm("Erase ALL entries and settings from this phone? This cannot be undone.") && replace(newData())}>Erase everything on this phone</button>
      </section>
    </>
  );
}
