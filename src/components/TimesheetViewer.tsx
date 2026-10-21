import { useEffect, useRef, useState } from "react";
import { deliver } from "../backup";
import { MONTHS } from "../format";
import { useTemplate } from "../hooks";
import { useNav } from "../nav";
import { useStore } from "../store";
import { makeTimesheetXlsx, XLSX_MIME } from "../timesheetExport";
import { TemplateError } from "../timesheetFile";
import { parseSheet, type SheetView } from "../xlsxView";
import { useLayer } from "./layers";

const HEAD_W = 30;
const HEAD_H = 20;

function colLetter(i: number): string {
  return String.fromCharCode(65 + i);
}

/** The filled timesheet drawn like the Excel file, with zoom. Nothing is downloaded until you press Download. */
export function TimesheetViewer({ month }: { month: string }) {
  const { data } = useStore();
  const { back } = useNav();
  const { template } = useTemplate();
  const [sheet, setSheet] = useState<SheetView | null>(null);
  const [file, setFile] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [note, setNote] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  useLayer(back);

  const name = data.timesheet?.name || "Employee";
  const monthName = `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;

  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    makeTimesheetXlsx(template.bytes, data.timesheet, month, data.entries, data.history)
      .then(async (made) => {
        const view = await parseSheet(made.bytes);
        if (!cancelled) { setSheet(view); setFile({ bytes: made.bytes, fileName: made.fileName }); }
      })
      .catch((e) => !cancelled && setError(e instanceof TemplateError ? e.message : "Could not prepare the timesheet."));
    return () => { cancelled = true; };
  }, [template, data.timesheet, data.entries, data.history, month]);

  const totalW = sheet ? HEAD_W + sheet.cols.reduce((s, w) => s + w, 0) : 0;
  const totalH = sheet ? HEAD_H + sheet.rows.reduce((s, h) => s + h, 0) : 0;

  // Start zoomed out so the whole width of the form fits on the screen.
  useEffect(() => {
    if (!sheet || fitted.current || !scroller.current) return;
    fitted.current = true;
    setZoom(Math.min(1, Math.max(0.3, (scroller.current.clientWidth - 8) / totalW)));
  }, [sheet, totalW]);

  const download = async () => {
    if (!file) return;
    try {
      const how = await deliver(file.fileName, file.bytes, XLSX_MIME);
      setNote(how === "shared" ? "Timesheet shared." : "Timesheet saved to your Downloads.");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setNote("Could not create the file.");
    }
  };

  const step = (delta: number) => setZoom((z) => Math.min(2.5, Math.max(0.3, Math.round((z + delta) * 100) / 100)));

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Timesheet preview">
      <header className="viewer-bar">
        <button onClick={back}>Close</button>
        <h2 title={`Time sheet – ${name} – ${monthName}`}>Time sheet – {name} – {monthName}</h2>
        <button className="zoom" aria-label="Zoom out" onClick={() => step(-0.15)}>−</button>
        <button className="zoom" aria-label="Zoom in" onClick={() => step(0.15)}>+</button>
      </header>
      <p className="viewer-note">Preview only – this is how the Excel file looks. Nothing is downloaded.</p>

      <div className="viewer-scroll" ref={scroller}>
        {error && <p className="notice warn">{error}</p>}
        {!error && !template && template !== undefined && <p className="notice warn">Choose the HHSL time sheet template in Settings, Timesheet, to preview it.</p>}
        {!error && template && !sheet && <p className="muted pad">Preparing the timesheet…</p>}
        {sheet && (
          <div style={{ width: totalW * zoom, height: totalH * zoom }}>
            <div className="paper" style={{ width: totalW, transform: `scale(${zoom})` }} aria-label="Timesheet">
              <table>
                <colgroup>
                  <col style={{ width: HEAD_W }} />
                  {sheet.cols.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr style={{ height: HEAD_H }}>
                    <th className="corner" />
                    {sheet.cols.map((_, i) => <th key={i} className="colhead">{colLetter(i)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sheet.grid.map((row, r) => (
                    <tr key={r} style={{ height: sheet.rows[r] }}>
                      <th className="rowhead">{r + 1}</th>
                      {row.map((cell, c) => cell && (
                        <td
                          key={c} rowSpan={cell.rowSpan} colSpan={cell.colSpan}
                          style={{
                            fontSize: `${(cell.style.size ?? 11) * 1.3333}px`,
                            fontWeight: cell.style.bold ? 700 : 400,
                            fontStyle: cell.style.italic ? "italic" : "normal",
                            color: cell.style.color ?? "#000000",
                            background: cell.style.fill,
                            textAlign: cell.style.h ?? "left",
                            verticalAlign: cell.style.v === "center" ? "middle" : cell.style.v ?? "bottom",
                            whiteSpace: cell.style.wrap ? "normal" : "nowrap",
                            borderTop: cell.style.borders.top, borderRight: cell.style.borders.right,
                            borderBottom: cell.style.borders.bottom, borderLeft: cell.style.borders.left,
                          }}
                        >{cell.text}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sheet.image && (
                <img src={sheet.image.src} alt="Company logo" style={{ left: HEAD_W + sheet.image.x, top: HEAD_H + sheet.image.y, width: sheet.image.w, height: sheet.image.h }} />
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="viewer-foot">
        {note && <span className="muted small">{note}</span>}
        <button className="primary" disabled={!file} onClick={download}>Download timesheet</button>
      </footer>
    </div>
  );
}
