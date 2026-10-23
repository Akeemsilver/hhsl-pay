import { createPortal } from "react-dom";
import { useLayer } from "./layers";
import type { PayrollEmail } from "../payroll";

/** Share your time sheet: shows the email that will open, then saves the time sheet and opens the mail app. */
export function PayrollDialog({ email, fileName, onCancel, onContinue, onShare, ready = true, error = null }: { email: PayrollEmail; fileName: string; onCancel: () => void; onContinue: () => void; onShare?: () => void; ready?: boolean; error?: string | null }) {
  useLayer(onCancel);
  return createPortal(
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm payroll" role="dialog" aria-modal="true" aria-label="Send time sheet to payroll" onClick={(e) => e.stopPropagation()}>
        <p className="muted small">Send by email</p>
        <h2>Send your time sheet to payroll</h2>
        <p className="muted small"><strong>{fileName}</strong> is saved to your Downloads and your email app (Gmail, Outlook, …) opens with this message ready. Attach the file, then send:</p>
        <div className="mail-preview" aria-label="Email preview">
          <div><span>To</span><b>{email.to}</b></div>
          <div><span>Subject</span><b>{email.subject}</b></div>
          <pre>{email.body}</pre>
        </div>
        <p className="muted small">This is your official submission. Payroll checks the hours; the pay shown in the app is only an estimate.</p>
        {error && <p className="notice" role="alert">Share did not open ({error}). Tap it again to try another way, or use Open email.</p>}
        {onShare && <button className="link" onClick={onShare} disabled={!ready}>Share the file with another app instead</button>}
        <div className="row">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!ready} onClick={onContinue}>{!ready ? "Preparing…" : "Open email"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
