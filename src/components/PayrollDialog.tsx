import { createPortal } from "react-dom";
import { useLayer } from "./layers";
import type { PayrollEmail } from "../payroll";

/** Share your time sheet: shows the email that will open, then saves the time sheet and opens the mail app. */
export function PayrollDialog({ email, fileName, onCancel, onContinue, ready = true, saved = false, error = null, onSave }: { email: PayrollEmail; fileName: string; onCancel: () => void; onContinue: () => void; ready?: boolean; saved?: boolean; error?: string | null; onSave?: () => void }) {
  useLayer(onCancel);
  return createPortal(
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm payroll" role="dialog" aria-modal="true" aria-label="Send time sheet to payroll" onClick={(e) => e.stopPropagation()}>
        <p className="muted small">Send by share menu</p>
        <h2>Send your time sheet to payroll</h2>
        <p className="muted small">Press Share to open your phone's share menu (Gmail, WhatsApp, …) with <strong>{fileName}</strong> attached. This is the message that goes with it:</p>
        <div className="mail-preview" aria-label="Email preview">
          <div><span>To</span><b>{email.to}</b></div>
          <div><span>Subject</span><b>{email.subject}</b></div>
          <pre>{email.body}</pre>
        </div>
        <p className="muted small">This is your official submission. Payroll checks the hours; the pay shown in the app is only an estimate.</p>
        {error && <p className="notice" role="alert">The share menu did not open ({error}). Save a copy and send it from your Downloads.</p>}
        {onSave && <button className="link" onClick={onSave}>{saved ? "Saved to your Downloads" : "Save a copy to Downloads"}</button>}
        <div className="row">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!ready} onClick={onContinue}>{!ready ? "Preparing…" : "Share"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
