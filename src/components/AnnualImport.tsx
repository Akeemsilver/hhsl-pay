import { useRef, useState } from "react";
import { applyAnnual, guessAnnualAssignment, parseAnnual, withSheetSites, type AnnualSheet } from "../annualImport";
import { MONTHS } from "../format";
import { useStore } from "../store";
import { ImportError, type Assignment } from "../timesheetImport";


/** Backup screen card: read the yearly salary spreadsheet and add its days to the app, after a preview. */
export function AnnualImport() {
  const { data, replace } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<AnnualSheet | null>(null);
  const [assign, setAssign] = useState<Record<string, Assignment | undefined>>({});
  const [mode, setMode] = useState<"add" | "replace">("add");
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

  function run() {
    if (!sheet) return;
    const r = applyAnnual(base, sheet, assign, mode);
    replace(r.data);
    setMessage({ text: `${plan.added.length ? `Added ${plan.added.length} site${plan.added.length === 1 ? "" : "s"} with their rates. ` : ""}Added ${r.added} day${r.added === 1 ? "" : "s"} across ${r.months.length} month${r.months.length === 1 ? "" : "s"}${r.removed ? `, replaced ${r.removed} existing` : ""}${r.skipped ? `, skipped ${r.skipped}` : ""}.`, ok: true });
    setSheet(null);
  }

  return (
    <section className="card">
      <h2>Import from your yearly spreadsheet</h2>
      <p className="muted small">Bring in the days worked from the yearly salary spreadsheet (a tab for each month) or a monthly one (a single calendar), saved as .xlsx. Months you already have are kept unless you choose Replace. Only days, hours, team lead and holiday flags are read. You see a preview first and nothing changes until you confirm.</p>
      <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
      <button className="wide" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Reading…" : "Choose yearly spreadsheet…"}</button>
      {message && <p className={`notice ${message.ok ? "" : "warn"}`} role="status">{message.text}</p>}

      {sheet && (
        <div className="import-preview" aria-label="Yearly import preview">
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
          <div className="segmented" role="group" aria-label="How to import the yearly sheet">
            <button aria-pressed={mode === "add"} className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Add</button>
            <button aria-pressed={mode === "replace"} className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}>Replace these months</button>
          </div>
          <p className="muted small">{mode === "add" ? "Adds these days and leaves what you already have. Days already logged at the same site are skipped." : "Removes your logged jobs for every month in this file first, then adds these. Other months and other jobs are kept."}</p>
          <div className="row">
            <button onClick={() => setSheet(null)}>Cancel</button>
            <button className="primary" disabled={usable === 0} onClick={run}>Import {usable} day{usable === 1 ? "" : "s"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
