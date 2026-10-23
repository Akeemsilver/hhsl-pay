import { DEFAULT_PAYROLL_EMAIL } from "../timesheet";
import { timesheetSettingsOf } from "../model";
import { TaxSegment } from "./TaxMode";
import { useMemo, useState } from "react";
import { deliver } from "../backup";
import { MONTHS, hoursText, money } from "../format";
import { useTemplate } from "../hooks";
import { useNav } from "../nav";
import { adjustmentLines, buildPayslips, siteRateText, type Payslip } from "../payslip";
import { payslipFileName, payslipPdf } from "../pdf/payslipPdf";
import { timesheetPdf } from "../pdf/timesheetPdf";
import { useStore } from "../store";
import { buildTimesheet } from "../timesheet";
import { makeTimesheetXlsx, XLSX_MIME } from "../timesheetExport";
import { TemplateError, extractLogo, timesheetFileName } from "../timesheetFile";
import { BottomSheet } from "./BottomSheet";
import { PayrollDialog } from "./PayrollDialog";
import { MailIcon } from "./Icons";
import { download } from "../backup";
import { mailtoLink, payrollEmail } from "../payroll";


function SlipPreview({ slip }: { slip: Payslip }) {
  return (
    <section className="slip" aria-label={`Payslip for ${slip.payerName}`}>
      <div className="slip-head">
        <div><span className="muted small">PAYSLIP FOR</span><strong>{slip.payerName}</strong></div>
        <div className="right"><span className="muted small">{slip.days} days · {hoursText(slip.hours)} h</span></div>
      </div>
      <table className="slip-lines">
        <thead><tr><th>Site</th><th className="num">Days</th><th className="num">Hours</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {slip.sites.map((b) => (
            <tr key={b.label}>
              <td>{b.label}<small className="muted block">{siteRateText(b, money)}</small></td>
              <td className="num">{b.days}</td>
              <td className="num">{b.weighted ? `${hoursText(b.weighted)} h` : "-"}</td>
              <td className="num">{money(b.amount)}</td>
            </tr>
          ))}
          {adjustmentLines(slip).map((l) => (
            <tr key={l.description}><td>{l.description}</td><td /><td /><td className="num">{money(l.amount)}</td></tr>
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
  const { data, update } = useStore();
  const { back, open } = useNav();
  const { template } = useTemplate();
  const [tab, setTab] = useState<"timesheet" | "payslip">("timesheet");
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const settings = timesheetSettingsOf(data);
  const rules = settings.rules;
  const name = settings.name;
  const { rows, warnings } = useMemo(() => buildTimesheet(month, data.entries, data.history, rules, settings.includeOther !== false, settings.medicEverywhere !== false), [month, data, rules, settings.includeOther, settings.medicEverywhere]);
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
  const email = payrollEmail({
    to: settings.payrollEmail || DEFAULT_PAYROLL_EMAIL, name, monthName, siteLabel: settings.siteLabel || "ERT Offsite",
    days: rows.length, hours: total.t + total.t15 + total.t2 + total.t3, fileName: timesheetFileName(name, month),
  });
  // The share menu only opens straight from a tap, so the file is built as soon as the payroll step opens, not on Continue.
  const [payrollFile, setPayrollFile] = useState<{ fileName: string; bytes: Uint8Array } | null>(null);
  const openPayroll = async () => {
    setMessage(null);
    setPayrollFile(null);
    setPayrollError(null);
    setPayrollTry(0);
    setPayrollOpen(true);
    try {
      const made = await makeTimesheetXlsx(template!.bytes, settings, month, data.entries, data.history);
      setPayrollFile({ fileName: made.fileName, bytes: made.bytes });
    } catch (e) {
      setPayrollOpen(false);
      setMessage({ text: e instanceof TemplateError ? e.message : "Could not create the file.", ok: false });
    }
  };
  const [payrollError, setPayrollError] = useState<string | null>(null);
  // Android Chrome sometimes refuses a file type ("Permission denied"). Each tap tries the next way of labelling the same file.
  const SHARE_TYPES = [XLSX_MIME, "application/octet-stream", "application/zip"];
  const [payrollTry, setPayrollTry] = useState(0);
  // Secondary: share the file with any app (WhatsApp, ...).
  const shareToPayroll = async () => {
    if (!payrollFile) return;
    const { fileName, bytes } = payrollFile;
    setPayrollError(null);
    const type = SHARE_TYPES[payrollTry % SHARE_TYPES.length]!;
    const file = new File([bytes as BlobPart], fileName, { type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      try {
        // Only the file and its name: adding the email text made Android refuse the share.
        await nav.share({ files: [file], title: fileName });
        setPayrollOpen(false); setPayrollTry(0);
        setMessage({ text: "Time sheet shared.", ok: true });
      } catch (e) {
        // Closing the share menu is fine. Any other refusal is shown, and the next tap tries another file type.
        if ((e as DOMException)?.name !== "AbortError") {
          setPayrollError((e as Error)?.message || (e as DOMException)?.name || "Error");
          setPayrollTry((t) => t + 1);
        }
      }
      return;
    }
    setPayrollError("this phone cannot share files");
  };
  // Main way: save the file, then open the phone's mail app (Gmail, Outlook, ...) with the address, subject and message ready.
  const openMailApp = () => {
    if (!payrollFile) return;
    download(payrollFile.fileName, payrollFile.bytes, XLSX_MIME);
    setPayrollOpen(false); setPayrollTry(0);
    setMessage({ text: `${payrollFile.fileName} is in your Downloads. Attach it to the email that opens, then send.`, ok: true });
    setTimeout(() => { window.location.href = mailtoLink(email); }, 700);
  };
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
            <button className="payroll-btn" disabled={!!busy || !template} onClick={openPayroll}>
              <MailIcon /> Send to payroll
            </button>
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
          <div className="row tax-mode">
            <span className="muted small">Tax, for the whole app:</span>
            <TaxSegment />
          </div>
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
            <button disabled={!!busy || !template || rows.length === 0} onClick={() => open({ sub: "view" })}>View</button>
            <button className="primary" disabled={!!busy || !template || rows.length === 0} onClick={downloadExcel}>{busy === "xlsx" ? "Preparing…" : "Download timesheet"}</button>
          </>
        ) : (
          <>
            <button disabled={!!busy || slips.length === 0} onClick={() => open({ sub: "viewslip" })}>View</button>
            <button className="primary" disabled={!!busy || slips.length === 0} onClick={downloadSlip}>{busy === "slip" ? "Preparing…" : "Download payslip (PDF)"}</button>
          </>
        )}
      </div>
      {payrollOpen && <PayrollDialog email={email} fileName={timesheetFileName(name, month)} onCancel={() => setPayrollOpen(false)} onContinue={openMailApp} onShare={shareToPayroll} ready={!!payrollFile} error={payrollError} />}
    </BottomSheet>
  );
}
