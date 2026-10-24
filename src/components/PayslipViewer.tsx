import { useEffect, useState } from "react";
import { deliver } from "../backup";
import { MONTHS } from "../format";
import { useNav } from "../nav";
import { buildPayslips } from "../payslip";
import { payslipFileName, payslipPdf } from "../pdf/payslipPdf";
import { timesheetSettingsOf } from "../model";
import { useStore } from "../store";
import { PdfViewer } from "./PdfViewer";
import { useAskFirst } from "./AskFirst";

/** The payslip PDF drawn page by page, with zoom. Nothing is downloaded until you press Download. */
export function PayslipViewer({ month }: { month: string }) {
  const { data } = useStore();
  const { back } = useNav();
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { askFirst, askDialog } = useAskFirst();

  const name = timesheetSettingsOf(data).name;
  const monthName = `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  const slips = buildPayslips(month, data, name);
  const key = JSON.stringify(slips);

  useEffect(() => {
    let cancelled = false;
    if (slips.length === 0) { setError(`No pay is logged in ${monthName}, so there is no payslip yet.`); return; }
    payslipPdf(slips)
      .then((bytes) => !cancelled && (setPdf(bytes), setError(null)))
      .catch(() => !cancelled && setError("Could not prepare the payslip."));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const download = async () => {
    if (!pdf) return;
    try {
      const how = await deliver(payslipFileName(name, month), pdf, "application/pdf");
      setNote(how === "shared" ? "Payslip shared." : "Payslip saved to your Downloads.");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setNote("Could not create the file.");
    }
  };

  return (
    <>
    {askDialog}
    <PdfViewer
      pdf={pdf} error={error} busy="Preparing the payslip…" label="Payslip" onClose={back}
      title={`Payslip – ${monthName.slice(0, 3)} ${month.slice(0, 4)}`}
      foot={<>
        {note ? <span className="muted small">{note}</span> : <span className="muted small">Preview only. Nothing is downloaded.</span>}
        <button className="primary" disabled={!pdf} onClick={() => askFirst({ title: "Download the payslip?", message: `The ${monthName} payslip (PDF) is saved to your Downloads, or your phone's share menu opens.`, confirmLabel: "Yes, download" }, () => void download())}>Download payslip (PDF)</button>
      </>}
    />
    </>
  );
}
