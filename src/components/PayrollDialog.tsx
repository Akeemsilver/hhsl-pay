import { createPortal } from "react-dom";
import { useLayer } from "./layers";
import type { PayrollEmail } from "../payroll";

/** Step 1 of 2: shows the email that will open, then saves the time sheet and opens the mail app. */
export function PayrollDialog({ email, fileName, onCancel, onContinue }: { email: PayrollEmail; fileName: string; onCancel: () => void; onContinue: () => void }) {
  useLayer(onCancel);
  return createPortal(
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm payroll" role="dialog" aria-modal="true" aria-label="Send time sheet to payroll" onClick={(e) => e.stopPropagation()}>
        <p className="muted small">Step 1 of 2</p>
        <h2>Send your time sheet to payroll</h2>
        <p className="muted small">The time sheet is saved to your Downloads and your email app opens with this message ready. Attach <strong>{fileName}</strong> and send it.</p>
        <div className="mail-preview" aria-label="Email preview">
          <div><span>To</span><b>{email.to}</b></div>
          <div><span>Subject</span><b>{email.subject}</b></div>
          <pre>{email.body}</pre>
        </div>
        <p className="muted small">This is your official submission. Payroll checks the hours; the pay shown in the app is only an estimate.</p>
        <div className="row">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={onContinue}>Continue</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
