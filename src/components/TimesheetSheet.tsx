import { useMemo, useState } from "react";
import { deliver } from "../backup";
import { MONTHS, hoursText } from "../format";
import { useTemplate } from "../hooks";
import { useNav } from "../nav";
import { useStore } from "../store";
import { buildTimesheet } from "../timesheet";
import { TemplateError, fillTimesheet, timesheetFileName } from "../timesheetFile";
import { BottomSheet } from "./BottomSheet";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const dayShort = (iso: string) => String(Number(iso.slice(8)));

/** Preview of the payroll timesheet for one month, with the download button. */
export function TimesheetSheet({ month }: { month: string }) {
  const { data } = useStore();
  const { back, open } = useNav();
  const { template } = useTemplate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const settings = data.timesheet;
  const rules = settings?.rules ?? [];
  const { rows, warnings } = useMemo(() => buildTimesheet(month, data.entries, data.history, rules), [month, data, rules]);
  const total = rows.reduce((s, r) => ({ t: s.t + r.hours.t, t15: s.t15 + r.hours.t15, t2: s.t2 + r.hours.t2, t3: s.t3 + r.hours.t3 }), { t: 0, t15: 0, t2: 0, t3: 0 });
  const monthName = `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;

  const download = async () => {
    if (!template) return;
    setBusy(true);
    setMessage(null);
    try {
      const bytes = await fillTimesheet(template.bytes, { name: settings?.name ?? "", siteLabel: settings?.siteLabel || "ERT Offsite", month, rows });
      const how = await deliver(timesheetFileName(settings?.name ?? "", month), bytes, XLSX);
      setMessage({ text: how === "shared" ? "Timesheet shared." : "Timesheet saved to your Downloads.", ok: true });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") {
        setMessage({ text: e instanceof TemplateError ? e.message : "Could not create the timesheet.", ok: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const setup = !settings?.name || rules.length === 0 || template === null;

  return (
    <BottomSheet label={`Timesheet for ${monthName}`} onRequestClose={back}>
      <header className="bar">
        <h2>Timesheet · {monthName}</h2>
        <button className="icon" onClick={back} aria-label="Close">✕</button>
      </header>

      {rules.length === 0 ? (
        <p className="muted">Choose which jobs go on the timesheet first.</p>
      ) : rows.length === 0 ? (
        <p className="muted">No timesheet jobs logged in {monthName}.</p>
      ) : (
        <>
          <table className="ts-table">
            <thead><tr><th>Day</th><th>On–off</th><th>T</th><th>×1.5</th><th>×2</th><th>×3</th><th>Client</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td>{dayShort(r.date)}</td>
                  <td>{r.onDuty ?? "–"}–{r.offDuty ?? "–"}</td>
                  <td>{hoursText(r.hours.t)}</td><td>{r.hours.t15 ? hoursText(r.hours.t15) : ""}</td>
                  <td>{r.hours.t2 ? hoursText(r.hours.t2) : ""}</td><td>{r.hours.t3 ? hoursText(r.hours.t3) : ""}</td>
                  <td>{r.client}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>Total</td><td>{hoursText(total.t)}</td><td>{hoursText(total.t15)}</td><td>{hoursText(total.t2)}</td><td>{hoursText(total.t3)}</td><td /></tr>
            </tfoot>
          </table>
          {warnings.length > 0 && <ul className="ts-warn">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </>
      )}

      {message && <p className={`notice ${message.ok ? "" : "warn"}`} role="status">{message.text}</p>}

      {setup && (
        <div className="notice warn">
          <strong>Finish the timesheet setup</strong>
          <ul className="ts-warn">
            {!settings?.name && <li>Add your name.</li>}
            {rules.length === 0 && <li>Choose which jobs go on it.</li>}
            {template === null && <li>Choose the HHSL time sheet template.</li>}
          </ul>
          <button onClick={() => open({ page: "timesheet" })}>Open timesheet settings</button>
        </div>
      )}

      <div className="sheet-footer">
        <button onClick={back}>Close</button>
        <button className="primary" disabled={busy || !template || rows.length === 0} onClick={download}>{busy ? "Preparing…" : "Download timesheet (.xlsx)"}</button>
      </div>
    </BottomSheet>
  );
}
