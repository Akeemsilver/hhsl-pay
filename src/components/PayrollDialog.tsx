import { createPortal } from "react-dom";
import { useLayer } from "./layers";
import type { PayrollEmail } from "../payroll";

/** Share your time sheet: shows the email that will open, then saves the time sheet and opens the mail app. */
export function PayrollDialog({ email, fileName, onCancel, onContinue, ready = true, saved = false }: { email: PayrollEmail; fileName: string; onCancel: () => void; onContinue: () => void; ready?: boolean; saved?: boolean }) {
  useLayer(onCancel);
  return createPortal(
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm payroll" role="dialog" aria-modal="true" aria-label="Send time sheet to payroll" onClick={(e) => e.stopPropagation()}>
        <p className="muted small">Send by share menu</p>
        <h2>Send your time sheet to payroll</h2>
        <p className="muted small">{saved ? <>Saved to your Downloads. Tap Share to open the share menu with <strong>{fileName}</strong> attached.</> : <>Press Download and share: <strong>{fileName}</strong> is saved to your Downloads, then the share menu opens so you can pick Gmail or WhatsApp. This is the message that goes with it:</>}</p>
        <div className="mail-preview" aria-label="Email preview">
          <div><span>To</span><b>{email.to}</b></div>
          <div><span>Subject</span><b>{email.subject}</b></div>
          <pre>{email.body}</pre>
        </div>
        <p className="muted small">This is your official submission. Payroll checks the hours; the pay shown in the app is only an estimate.</p>
        <div className="row">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!ready} onClick={onContinue}>{!ready ? "Preparing…" : saved ? "Share" : "Download and share"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
