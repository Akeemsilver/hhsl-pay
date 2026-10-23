import { useMemo, useRef, useState } from "react";
import { applyAnnual, guessAnnualAssignment, parseAnnual, planAnnual, withSheetSites, type AnnualSheet, type ImportMode } from "../annualImport";
import { dayDMY, MONTHS } from "../format";
import type { AppData } from "../model";
import { ConfirmDialog } from "./ConfirmDialog";
import { useStore } from "../store";
import { ImportError, type Assignment } from "../timesheetImport";


/** Backup screen card: read the yearly or monthly salary spreadsheet and add its days to the app, after a preview. */
export function AnnualImport() {
  const { data, replace } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<AnnualSheet | null>(null);
  const [assign, setAssign] = useState<Record<string, Assignment | undefined>>({});
  const [mode, setMode] = useState<ImportMode>("update");
  const [confirmReplace, setConfirmReplace] = useState(false);
  // The app as it was just before the last import, so it can be put back.
  const [undo, setUndo] = useState<AppData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [useSheetSites, setUseSheetSites] = useState(true);
  const plan = sheet && useSheetSites ? withSheetSites(data, sheet) : { data, added: [] as string[] };
  const base = plan.data;
  const siteNames = [...new Set(base.history.sites.flatMap((v) => Object.keys(v.value)))];
  const clients = sheet ? [...new Set(sheet.days.map((d) => d.client))] : [];
  const perMonth = sheet ? Object.entries(sheet.days.reduce<Record<string, number>>((m, d) => ({ ...m, [d.date.slice(0, 7)]: (m[d.date.slice(0, 7)] ?? 0) + 1 }), {})).sort() : [];

  async function read(file: File) {
    setMessage(null);
    setBusy(true);
    try {
      const parsed = await parseAnnual(await file.arrayBuffer());
      const planned = withSheetSites(data, parsed);
      const guessed: Record<string, Assignment | undefined> = {};
      for (const c of new Set(parsed.days.map((d) => d.client))) guessed[c] = guessAnnualAssignment(c, planned.data);
      setAssign(guessed);
      setUseSheetSites(true);
      setSheet(parsed);
    } catch (e) {
      setSheet(null);
      setMessage({ text: e instanceof ImportError ? e.message : "Could not read that file.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const usable = sheet ? sheet.days.filter((d) => assign[d.client]?.site).length : 0;

  const changes = useMemo(() => (sheet ? planAnnual(base, sheet, assign) : null), [sheet, base, assign]);

  function run() {
    if (!sheet) return;
    const r = applyAnnual(base, sheet, assign, mode);
    setUndo(data);
    replace(r.data);
    const parts = [
      plan.added.length ? `Added ${plan.added.length} site${plan.added.length === 1 ? "" : "s"} with their rates.` : "",
      `Added ${r.added} day${r.added === 1 ? "" : "s"}`,
      r.updated ? `updated ${r.updated}` : "",
      r.removed ? `removed ${r.removed} that were replaced` : "",
      r.skipped ? `left ${r.skipped} as they were` : "",
    ].filter(Boolean);
    setMessage({ text: `${parts[0]!.endsWith(".") ? `${parts[0]} ${parts.slice(1).join(", ")}` : parts.join(", ")} (${r.months.map((m) => `${MONTHS[Number(m.slice(5)) - 1]!.slice(0, 3)} ${m.slice(0, 4)}`).join(", ")}).`, ok: true });
    setSheet(null);
  }

  const importLabel = !changes ? "Import" : mode === "update" ? `Import (${changes.counts.new} new, ${changes.counts.changed} updated)` : mode === "add" ? `Import ${changes.counts.new} new day${changes.counts.new === 1 ? "" : "s"}` : `Replace with ${usable} day${usable === 1 ? "" : "s"}`;
  const modeText: Record<ImportMode, string> = {
    update: "Adds days you have not logged and brings days you already logged (same site and date) in line with the file. Days that are only in the app are never touched.",
    add: "Adds only days you have not logged yet. Everything already logged stays exactly as it is, even if the file differs.",
    replace: "Clears your logged jobs in the months in this file, then adds the file's days. Days in those months that are not in the file are removed. Other months and Other jobs are kept.",
  };

  return (
    <section className="card">
      <h2>Import from your yearly / monthly spreadsheet</h2>
      <p className="muted small">Bring in the days worked from the yearly salary spreadsheet (a tab for each month) or a monthly one (a single calendar), saved as .xlsx. Months you already have are kept unless you choose Replace. Only days, hours, team lead and holiday flags are read. You see a preview first and nothing changes until you confirm.</p>
      <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
      <button className="wide" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Reading…" : "Choose yearly / monthly spreadsheet…"}</button>
      {message && <p className={`notice ${message.ok ? "" : "warn"}`} role="status">{message.text}</p>}
      {undo && !sheet && <button className="wide" onClick={() => { replace(undo); setUndo(null); setMessage({ text: "The last import was undone. Your days are back as they were.", ok: true }); }}>Undo the last import</button>}

      {sheet && (
        <div className="import-preview" aria-label="Spreadsheet import preview">
          <p><strong>{sheet.name || "Name not on the sheet"}</strong> · {sheet.year} · {sheet.days.length} day{sheet.days.length === 1 ? "" : "s"}</p>
          <ul className="plain small">
            {perMonth.map(([m, n]) => <li key={m} className="row"><span>{MONTHS[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</span><span>{n} day{n === 1 ? "" : "s"}</span></li>)}
          </ul>
          {sheet.sites.length > 0 && (() => {
            const missing = withSheetSites(data, sheet).added;
            return missing.length > 0 ? (
              <label className="check">
                <input type="checkbox" aria-label="Also add the sites and rates from the sheet" checked={useSheetSites} onChange={(e) => {
                  setUseSheetSites(e.target.checked);
                  const planned = e.target.checked ? withSheetSites(data, sheet).data : data;
                  setAssign(Object.fromEntries(clients.map((c) => [c, guessAnnualAssignment(c, planned)])));
                }} />
                {" "}Also add the {missing.length} site{missing.length === 1 ? "" : "s"} and rates from the sheet's Settings tab: {missing.join(", ")}
              </label>
            ) : null;
          })()}
          {clients.map((c) => (
            <label key={c}>“{c}” is
              <select aria-label={`Site for ${c}`} value={assign[c]?.site ?? ""} onChange={(e) => setAssign((a) => ({ ...a, [c]: e.target.value ? { site: e.target.value, role: a[c]?.role } : undefined }))}>
                <option value="">Skip these days</option>
                {siteNames.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          ))}
          {changes && (
            <div className="import-changes" aria-label="What will change">
              <p className="ic-counts"><span><strong>{changes.counts.new}</strong> new</span><span><strong>{changes.counts.same}</strong> the same</span><span><strong>{changes.counts.changed}</strong> changed</span><span><strong>{changes.counts.onlyInApp}</strong> only in the app</span></p>
              {changes.counts.changed > 0 && (
                <details>
                  <summary>Changed days ({changes.counts.changed})</summary>
                  <ul className="plain small">{changes.rows.filter((r) => r.kind === "changed").map((r) => <li key={r.date + r.site} className="row"><span>{dayDMY(r.date)} · {r.site}</span><span>{r.detail}</span></li>)}</ul>
                </details>
              )}
              {changes.counts.new > 0 && (
                <details>
                  <summary>New days ({changes.counts.new})</summary>
                  <ul className="plain small">{changes.rows.filter((r) => r.kind === "new").map((r) => <li key={r.date + r.site} className="row"><span>{dayDMY(r.date)}</span><span>{r.site}</span></li>)}</ul>
                </details>
              )}
              {changes.counts.onlyInApp > 0 && (
                <details>
                  <summary>Only in the app ({changes.counts.onlyInApp}){mode === "replace" ? ", will be removed" : ", kept"}</summary>
                  <ul className="plain small">{changes.onlyInApp.map((e) => <li key={e.id} className="row"><span>{dayDMY(e.date)}</span><span>{e.site}</span></li>)}</ul>
                </details>
              )}
            </div>
          )}
          <div className="segmented three" role="group" aria-label="How to import the spreadsheet">
            <button aria-pressed={mode === "update"} className={mode === "update" ? "on" : ""} onClick={() => setMode("update")}>Update</button>
            <button aria-pressed={mode === "add"} className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Add only</button>
            <button aria-pressed={mode === "replace"} className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}>Replace</button>
          </div>
          <p className="muted small">{modeText[mode]}</p>
          {mode === "replace" && changes && changes.removeCount > 0 && <p className="notice warn" role="status">Replace removes {changes.removeCount} logged day{changes.removeCount === 1 ? "" : "s"} first{changes.counts.onlyInApp > 0 ? `, including ${changes.counts.onlyInApp} that ${changes.counts.onlyInApp === 1 ? "is" : "are"} not in the file` : ""}.</p>}
          <div className="row">
            <button onClick={() => setSheet(null)}>Cancel</button>
            <button className="primary" disabled={usable === 0} onClick={() => (mode === "replace" && changes && changes.removeCount > 0 ? setConfirmReplace(true) : run())}>{importLabel}</button>
          </div>
        </div>
      )}
      {confirmReplace && changes && (
        <ConfirmDialog
          title="Replace these months?"
          message={`${changes.removeCount} logged day${changes.removeCount === 1 ? "" : "s"} in ${changes.months.length === 1 ? "this month" : "these months"} will be removed and replaced by the ${usable} from the file. You can undo it right after.`}
          confirmLabel="Yes, replace" cancelLabel="Cancel"
          onCancel={() => setConfirmReplace(false)}
          onConfirm={() => { setConfirmReplace(false); run(); }}
        />
      )}
    </section>
  );
}
