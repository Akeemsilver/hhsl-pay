import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { todayISO } from "../format";
import { useNav } from "../nav";
import { monthTitle, payrollReminderFor, type PayrollStatus } from "../payrollReminder";
import { useStore } from "../store";
import { useLayer } from "./layers";

/** Records the answer for a month in the app's data. */
export function useMarkPayroll(): (month: string, status: PayrollStatus) => void {
  const { update } = useStore();
  return (month, status) => update((d) => ({ ...d, payrollStatus: { ...d.payrollStatus, [month]: status } }));
}

/**
 * The payroll pop-up. It shows when the app is opened on the last day of the month and on the 1st and 2nd of the next, until the
 * email is confirmed sent. While the app stays open it shows again at 8 a.m. on the 1st and 2nd. Each time slot shows once, so
 * tapping OK, or coming back from the email app, does not bring it straight back.
 */
export function PayrollReminderPopup() {
  const { data } = useStore();
  const { open } = useNav();
  const mark = useMarkPayroll();
  const [shown, setShown] = useState(false);
  const seen = useRef(new Set<string>());
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const today = todayISO();
      const r = payrollReminderFor(latest.current, today);
      if (!r || r.stage !== "due") return;
      // On the 1st and 2nd there is one more slot, from 8 a.m.
      const slot = `${today}|${today.slice(8) === "01" || today.slice(8) === "02" ? (now.getHours() >= 8 ? "8" : "0") : "0"}`;
      if (seen.current.has(slot)) return;
      seen.current.add(slot);
      setShown(true);
    };
    check();
    const timer = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);

  const r = payrollReminderFor(data, todayISO());
  if (!shown || !r || r.stage !== "due") return null;
  const close = () => setShown(false);
  return <PayrollDialogBox month={r.month} closes={r.closes}
    onOk={() => { close(); open({ sub: `export:${r.month}` }); }}
    onNone={() => { mark(r.month, "none"); close(); }}
    onLater={close} />;
}

function PayrollDialogBox({ month, closes, onOk, onNone, onLater }: { month: string; closes: string; onOk: () => void; onNone: () => void; onLater: () => void }) {
  useLayer(onLater);
  return createPortal(
    <div className="confirm-backdrop">
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label="Send your time sheet to payroll">
        <h2>Send {monthTitle(month)} to payroll</h2>
        <p className="muted">Payroll closes on <strong>{closes}</strong>. A time sheet that is not sent in time is not paid. Tap OK to send it now.</p>
        <p className="muted small">If none of your jobs need to be submitted this month, you can ignore this message.</p>
        <div className="row one"><button className="primary" onClick={onOk}>OK, send it now</button></div>
        <div className="row">
          <button onClick={onNone}>Nothing to send</button>
          <button onClick={onLater}>Later</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
