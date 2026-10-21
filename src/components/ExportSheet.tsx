import { useMemo, useState } from "react";
import { deliver } from "../backup";
import { MONTHS, hoursText, money } from "../format";
import { useTemplate } from "../hooks";
import { useNav } from "../nav";
import { buildPayslips, type Payslip } from "../payslip";
import { payslipFileName, payslipPdf } from "../pdf/payslipPdf";
import { timesheetPdf } from "../pdf/timesheetPdf";
import { useStore } from "../store";
import { buildTimesheet } from "../timesheet";
import { makeTimesheetXlsx, XLSX_MIME } from "../timesheetExport";
import { TemplateError, extractLogo, timesheetFileName } from "../timesheetFile";
import { BottomSheet } from "./BottomSheet";


function SlipPreview({ slip }: { slip: Payslip }) {
  return (
    <section className="slip" aria-label={`Payslip for ${slip.payerName}`}>
      <div className="slip-head">
        <div><span className="muted small">PAYSLIP FOR</span><strong>{slip.payerName}</strong></div>
        <div className="right"><span className="muted small">{slip.days} days · {hoursText(slip.hours)} h</span></div>
      </div>
      <table className="slip-lines">
        <tbody>
          {slip.lines.map((l) => (
            <tr key={l.description + l.rate}>
              <td>{l.description}</td>
              <td className="num">{l.unit ? `${hoursText(l.qty)} ${l.unit}` : ""}</td>
              <td className="num">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="slip-row total"><span><i className="dot dot-gross" />Gross pay</span><strong className="c-gross">{money(slip.gross)}</strong></div>
      <div className="slip-row"><span><i className="dot dot-paye" />PAYE{slip.corrected ? " *" : ""}</span><span className="c-paye">-{money(slip.paye)}</span></div>
      <div className="slip-row"><span><i className="dot dot-nis" />NIS</span><span className="c-nis">-{money(slip.nis)}</span></div>
      <div className="slip-row"><span><i className="dot dot-sur" />Health surcharge</span><span className="c-sur">-{money(slip.surcharge)}</span></div>
      <div className="slip-net"><span>NET PAY</span><strong>{money(slip.net)}</strong></div>
    </section>
  );
}

/** Download sheet for the month in view: the payroll timesheet (Excel or PDF) and the payslip (PDF). */
export function ExportSheet({ month }: { month: string }) {
  const { data } = useStore();
  const { back, open } = useNav();
  const { template } = useTemplate();
  const [tab, setTab] = useState<"timesheet" | "payslip">("timesheet");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const settings = data.timesheet;
  const rules = settings?.rules ?? [];
  const name = settings?.name ?? "";
  const { rows, warnings } = useMemo(() => buildTimesheet(month, data.entries, data.history, rules), [month, data, rules]);
  const slips = useMemo(() => buildPayslips(month, data, name), [month, data, name]);
  const total = rows.reduce((s, r) => ({ t: s.t + r.hours.t, t15: s.t15 + r.hours.t15, t2: s.t2 + r.hours.t2, t3: s.t3 + r.hours.t3 }), { t: 0, t15: 0, t2: 0, t3: 0 });
  const monthName = `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;

  const run = async (id: string, work: () => Promise<"shared" | "downloaded">, done: string) => {
    setBusy(id);
    setMessage(null);
    try {
      const how = await work();
      setMessage({ text: how === "shared" ? `${done} shared.` : `${done} saved to your Downloads.`, ok: true });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") {
        setMessage({ text: e instanceof TemplateError ? e.message : "Could not create the file.", ok: false });
      }
    } finally {
      setBusy(null);
    }
  };

  const sheetInput = { name, siteLabel: settings?.siteLabel || "ERT Offsite", month, rows };
  const downloadExcel = () => run("xlsx", async () => {
    const made = await makeTimesheetXlsx(template!.bytes, settings, month, data.entries, data.history);
    return deliver(made.fileName, made.bytes, XLSX_MIME);
  }, "Timesheet");
  const downloadSheetPdf = () => run("sheet-pdf", async () => {
    const logo = template ? await extractLogo(template.bytes) : null;
    const bytes = await timesheetPdf({ ...sheetInput, logo });
    return deliver(timesheetFileName(name, month).replace(/\.xlsx$/, ".pdf"), bytes, "application/pdf");
  }, "Timesheet PDF");
  const downloadSlip = () => run("slip", async () => {
    const bytes = await payslipPdf(slips);
    return deliver(payslipFileName(name, month), bytes, "application/pdf");
  }, "Payslip");

  return (
    <BottomSheet label={`Download for ${monthName}`} onRequestClose={back}>
      <header className="bar">
        <h2>Download · {monthName}</h2>
        <button className="icon" onClick={back} aria-label="Close">✕</button>
      </header>

      <div className="segmented" role="group" aria-label="What to download">
        <button aria-pressed={tab === "timesheet"} className={tab === "timesheet" ? "on" : ""} onClick={() => setTab("timesheet")}>Timesheet</button>
        <button aria-pressed={tab === "payslip"} className={tab === "payslip" ? "on" : ""} onClick={() => setTab("payslip")}>Payslip</button>
      </div>

      {tab === "timesheet" ? (
        <>
          {rules.length === 0 ? (
            <p className="muted">Choose which jobs go on the timesheet first.</p>
          ) : rows.length === 0 ? (
            <p className="muted">No timesheet jobs logged in {monthName}.</p>
          ) : (
            <>
              <div className="ts-summary">
                <div><strong>{rows.length}</strong><span className="muted small">{rows.length === 1 ? "day" : "days"}</span></div>
                <div><strong>{hoursText(total.t + total.t15 + total.t2 + total.t3)} h</strong><span className="muted small">on the form</span></div>
                <div><strong>{[...new Set(rows.map((r) => r.client))].length}</strong><span className="muted small">clients</span></div>
              </div>
              <p className="muted small">It fills your HHSL time sheet form for {monthName}. View it first, then download.</p>
              {warnings.length > 0 && <ul className="ts-warn">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            </>
          )}
          {rows.length > 0 && (
            <button className="link small" disabled={!!busy} onClick={downloadSheetPdf}>{busy === "sheet-pdf" ? "Preparing…" : "Also download as PDF"}</button>
          )}
          {(!name || rules.length === 0 || template === null) && (
            <div className="notice warn">
              <strong>Finish the timesheet setup</strong>
              <ul className="ts-warn">
                {!name && <li>Add your name.</li>}
                {rules.length === 0 && <li>Choose which jobs go on it.</li>}
                {template === null && <li>Choose the HHSL time sheet template for the Excel file and the logo on the PDF.</li>}
              </ul>
              <button onClick={() => open({ page: "timesheet" })}>Open timesheet settings</button>
            </div>
          )}
        </>
      ) : (
        <>
          {slips.length === 0 ? (
            <p className="muted">No pay logged in {monthName}, so there is no payslip yet.</p>
          ) : (
            slips.map((s) => <SlipPreview key={s.payer} slip={s} />)
          )}
          {slips.some((s) => s.corrected) && <p className="muted small">* PAYE or gross was entered from your own payslip.</p>}
          {!name && slips.length > 0 && (
            <div className="notice warn">
              <strong>Add your name</strong>
              <p>It is printed on the payslip. You set it once in Settings, Timesheet.</p>
              <button onClick={() => open({ page: "timesheet" })}>Open timesheet settings</button>
            </div>
          )}
        </>
      )}

      {message && <p className={`notice ${message.ok ? "" : "warn"}`} role="status">{message.text}</p>}

      <div className="sheet-footer">
        {tab === "timesheet" ? (
          <>
            <button disabled={!!busy || !template || rows.length === 0} onClick={() => open({ sub: "view" })}>View timesheet</button>
            <button className="primary" disabled={!!busy || !template || rows.length === 0} onClick={downloadExcel}>{busy === "xlsx" ? "Preparing…" : "Download timesheet"}</button>
          </>
        ) : (
          <>
            <button onClick={back}>Close</button>
            <button className="primary" disabled={!!busy || slips.length === 0} onClick={downloadSlip}>{busy === "slip" ? "Preparing…" : "Download payslip (PDF)"}</button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
