import { createPortal } from "react-dom";
import { useLayer } from "./layers";
import type { PayrollEmail } from "../payroll";

/** Share your time sheet: shows the email that will open, then saves the time sheet and opens the mail app. */
export function PayrollDialog({ email, fileName, onCancel, onContinue, onShare, ready = true, error = null, ios = false, onShareMail, onCopyAddress, copied = false, onSaveOnly }: {
  email: PayrollEmail; fileName: string; onCancel: () => void; onContinue: () => void; onShare?: () => void; ready?: boolean; error?: string | null;
  /** iPhone: the time sheet goes to Mail through the share menu, because a downloaded file opens in a viewer that hides the mail app. */
  ios?: boolean; onShareMail?: () => void; onCopyAddress?: () => void; copied?: boolean; onSaveOnly?: () => void;
}) {
  useLayer(onCancel);
  return createPortal(
    <div className="confirm-backdrop">
      <div className="confirm payroll" role="dialog" aria-modal="true" aria-label="Send time sheet to payroll">
        <p className="muted small">Send by email</p>
        <h2>Send your time sheet to payroll</h2>
        {ios
          ? <p className="muted small">Tap <strong>Share to Mail</strong>. The share menu opens: pick <strong>Mail</strong> and your time sheet (<strong>{fileName}</strong>) is already attached, with the subject and message below. Mail does not know the address, so tap <strong>Copy address</strong> first and paste it in the To box.</p>
          : <p className="muted small">Your time sheet (<strong>{fileName}</strong>, with the time added) is saved to your Downloads and your email app (Gmail, Outlook, …) opens with this message ready. Attach the file, then send:</p>}
        <div className="mail-preview" aria-label="Email preview">
          <div><span>To</span><b>{email.to}</b></div>
          <div><span>Subject</span><b>{email.subject}</b></div>
          <pre>{email.body}</pre>
        </div>
        <p className="muted small">This is your official submission. Payroll checks the hours; the pay shown in the app is only an estimate.</p>
        {error && <p className="notice" role="alert">{ios ? `Share did not open (${error}). Tap Share to Mail again, or use “Only save the file instead”.` : `Share did not open (${error}). Tap it again to try another way, or use Open email.`}</p>}
        {ios && <button className="wide" onClick={onCopyAddress}>{copied ? "Address copied ✓" : "Copy address"}</button>}
        {ios && onSaveOnly && <button className="link" onClick={onSaveOnly} disabled={!ready}>Only save the file instead</button>}
        {!ios && onShare && <button className="link" onClick={onShare} disabled={!ready}>Share the file with another app instead</button>}
        <div className="row">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!ready} onClick={ios ? onShareMail : onContinue}>{!ready ? "Preparing…" : ios ? "Share to Mail" : "Open email"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
