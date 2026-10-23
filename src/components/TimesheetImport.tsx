import { useRef, useState } from "react";
import { MONTHS, dmy } from "../format";
import { useStore } from "../store";
import { ImportError, applyTimesheet, guessAssignment, parseTimesheet, type Assignment, type ImportedTimesheet } from "../timesheetImport";

/** Backup screen card: read a filled-in HHSL time sheet and add its days to the app, after a preview. */
export function TimesheetImport() {
  const { data, replace } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<ImportedTimesheet | null>(null);
  const [assign, setAssign] = useState<Record<string, Assignment | undefined>>({});
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const siteNames = [...new Set(data.history.sites.flatMap((v) => Object.keys(v.value)))];
  const clients = sheet ? [...new Set(sheet.rows.map((r) => r.client))] : [];

  async function read(file: File) {
    setMessage(null);
    try {
      const parsed = await parseTimesheet(await file.arrayBuffer());
      const guessed: Record<string, Assignment | undefined> = {};
      for (const c of new Set(parsed.rows.map((r) => r.client))) guessed[c] = guessAssignment(c, data);
      setAssign(guessed);
      setSheet(parsed);
    } catch (e) {
      setSheet(null);
      setMessage({ text: e instanceof ImportError ? e.message : "Could not read that file.", ok: false });
    }
  }

  const ready = !!sheet && sheet.rows.some((r) => assign[r.client]?.site);
  const monthName = sheet ? `${MONTHS[Number(sheet.month.slice(5)) - 1]} ${sheet.month.slice(0, 4)}` : "";

  function run() {
    if (!sheet) return;
    const result = applyTimesheet(data, sheet, assign, mode);
    replace(result.data);
    setMessage({
      text: `Added ${result.added} day${result.added === 1 ? "" : "s"} for ${monthName}${result.removed ? `, replaced ${result.removed} existing` : ""}${result.skipped ? `, skipped ${result.skipped}` : ""}.`,
      ok: true,
    });
    setSheet(null);
  }

  return (
    <section className="card">
      <h2>Import from a time sheet</h2>
      <p className="muted small">Bring in the days from a filled-in HHSL time sheet (.xlsx). You see a preview first and nothing changes until you confirm.</p>
      <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
      <button className="wide" onClick={() => input.current?.click()}>Choose time sheet…</button>
      {message && <p className={`notice ${message.ok ? "" : "warn"}`} role="status">{message.text}</p>}

      {sheet && (
        <div className="import-preview" aria-label="Import preview">
          <p><strong>{sheet.name || "Name not on the sheet"}</strong> · {monthName} · {sheet.rows.length} day{sheet.rows.length === 1 ? "" : "s"}</p>
          {clients.map((c) => (
            <label key={c || "(blank)"}>“{c || "no client"}” is
              <select aria-label={`Site for ${c || "no client"}`} value={assign[c]?.site ?? ""} onChange={(e) => setAssign((a) => ({ ...a, [c]: e.target.value ? { site: e.target.value, role: a[c]?.role } : undefined }))}>
                <option value="">Skip these days</option>
                {siteNames.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          ))}
          <ul className="plain small">
            {sheet.rows.slice(0, 40).map((r) => {
              const total = r.hours.t + r.hours.t15 + r.hours.t2 + r.hours.t3;
              return (
                <li key={r.date} className="row">
                  <span>{dmy(r.date)} · {r.client || "-"}{assign[r.client]?.role ? ` (${assign[r.client]!.role})` : ""}</span>
                  <span>{r.onDuty && r.offDuty ? `${r.onDuty}-${r.offDuty} · ` : ""}{total} h</span>
                </li>
              );
            })}
          </ul>
          <div className="segmented" role="group" aria-label="How to import">
            <button aria-pressed={mode === "add"} className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Add</button>
            <button aria-pressed={mode === "replace"} className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}>Replace {monthName}</button>
          </div>
          <p className="muted small">{mode === "add" ? "Adds these days and leaves what you already have. Days already logged at the same site are skipped." : `Removes your logged jobs for ${monthName} first, then adds these. Other months and other jobs are kept.`}</p>
          <div className="row">
            <button onClick={() => setSheet(null)}>Cancel</button>
            <button className="primary" disabled={!ready} onClick={run}>Import</button>
          </div>
        </div>
      )}
    </section>
  );
}
