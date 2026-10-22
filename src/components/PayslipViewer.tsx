import { useEffect, useRef, useState } from "react";
import { deliver } from "../backup";
import { MONTHS } from "../format";
import { useNav } from "../nav";
import { buildPayslips } from "../payslip";
import { payslipFileName, payslipPdf } from "../pdf/payslipPdf";
import { timesheetSettingsOf } from "../model";
import { useStore } from "../store";
import { useLayer } from "./layers";

/** The payslip PDF drawn page by page, with zoom. Nothing is downloaded until you press Download. */
export function PayslipViewer({ month }: { month: string }) {
  const { data } = useStore();
  const { back } = useNav();
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useLayer(back);

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

  // Draw each page of the PDF onto a canvas as wide as the screen (times the zoom).
  useEffect(() => {
    if (!pdf || !holder.current || !scroller.current) return;
    let cancelled = false;
    const box = holder.current;
    const width = (scroller.current.clientWidth - 8) * zoom;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = (await import("pdfjs-dist/build/pdf.worker.min.js?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = worker;
      const doc = await pdfjs.getDocument({ data: pdf.slice() }).promise;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const canvases: HTMLCanvasElement[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${viewport.height / ratio}px`;
        canvas.className = "pdf-page";
        canvas.setAttribute("aria-label", `Payslip page ${n}`);
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        canvases.push(canvas);
      }
      if (!cancelled) box.replaceChildren(...canvases);
    })().catch(() => !cancelled && setError("Could not show the payslip."));
    return () => { cancelled = true; };
  }, [pdf, zoom]);

  const download = async () => {
    if (!pdf) return;
    try {
      const how = await deliver(payslipFileName(name, month), pdf, "application/pdf");
      setNote(how === "shared" ? "Payslip shared." : "Payslip saved to your Downloads.");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setNote("Could not create the file.");
    }
  };
  const step = (delta: number) => setZoom((z) => Math.min(3, Math.max(0.6, Math.round((z + delta) * 100) / 100)));

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Payslip preview">
      <header className="viewer-bar">
        <button onClick={back}>Close</button>
        <h2>Payslip – {monthName.slice(0, 3)} {month.slice(0, 4)}</h2>
        <button className="zoom" aria-label="Zoom out" onClick={() => step(-0.25)}>−</button>
        <button className="zoom" aria-label="Zoom in" onClick={() => step(0.25)}>+</button>
      </header>
      <p className="viewer-note">Preview only – this is how the PDF looks. Nothing is downloaded.</p>
      <div className="viewer-scroll" ref={scroller}>
        {error && <p className="notice warn">{error}</p>}
        {!error && !pdf && <p className="muted pad">Preparing the payslip…</p>}
        <div ref={holder} className="pdf-pages" />
      </div>
      <footer className="viewer-foot">
        {note && <span className="muted small">{note}</span>}
        <button className="primary" disabled={!pdf} onClick={download}>Download payslip (PDF)</button>
      </footer>
    </div>
  );
}
