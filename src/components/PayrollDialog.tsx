import { createPortal } from "react-dom";
import { useLayer } from "./layers";
import type { PayrollEmail } from "../payroll";

/** Share your time sheet: shows the email that will open, then saves the time sheet and opens the mail app. */
export function PayrollDialog({ email, fileName, onCancel, onContinue, onShare, ready = true, error = null, ios = false, onSaveToFiles, saved = false, onOpenEmail, onShareMail }: {
  email: PayrollEmail; fileName: string; onCancel: () => void; onContinue: () => void; onShare?: () => void; ready?: boolean; error?: string | null;
  /** iPhone: a downloaded file opens in a viewer that hides the mail app, so: save the file through the share menu, then open an email app. */
  ios?: boolean; onSaveToFiles?: () => void; saved?: boolean; onOpenEmail?: (app: "mail" | "gmail" | "outlook") => void; onShareMail?: () => void;
}) {
  useLayer(onCancel);
  return createPortal(
    <div className="confirm-backdrop">
      <div className="confirm payroll" role="dialog" aria-modal="true" aria-label="Send time sheet to payroll">
        <p className="muted small">Send by email</p>
        <h2>Send your time sheet to payroll</h2>
        {ios
          ? <p className="muted small">On iPhone this takes two steps. The email below is filled in for you; you attach the time sheet (<strong>{fileName}</strong>).</p>
          : <p className="muted small">Your time sheet (<strong>{fileName}</strong>, with the time added) is saved to your Downloads and your email app (Gmail, Outlook, …) opens with this message ready. Attach the file, then send:</p>}
        <div className="mail-preview" aria-label="Email preview">
          <div><span>To</span><b>{email.to}</b></div>
          <div><span>Subject</span><b>{email.subject}</b></div>
          <pre>{email.body}</pre>
        </div>
        <p className="muted small">This is your official submission. Payroll checks the hours; the pay shown in the app is only an estimate.</p>
        {error && <p className="notice" role="alert">{ios ? `Share did not open (${error}). Tap it again, or try the other way.` : `Share did not open (${error}). Tap it again to try another way, or use Open email.`}</p>}
        {ios && (
          <div className="ios-steps">
            <div>
              <strong>1. Save the time sheet</strong>
              <button className={saved ? "" : "primary"} disabled={!ready} onClick={onSaveToFiles}>{saved ? "Saved ✓ Save again" : "Save time sheet"}</button>
              <span className="muted small">In the menu that opens, tap <strong>Save to Files</strong>.</span>
            </div>
            <div>
              <strong>2. Open your email app</strong>
              <div className="row">
                <button onClick={() => onOpenEmail?.("mail")}>Mail</button>
                <button onClick={() => onOpenEmail?.("gmail")}>Gmail</button>
                <button onClick={() => onOpenEmail?.("outlook")}>Outlook</button>
              </div>
              <span className="muted small">It opens with the address, subject and message filled in. Tap the paperclip and pick the time sheet from Files, then send.</span>
            </div>
          </div>
        )}
        {ios && <button className="link" onClick={onShareMail} disabled={!ready}>Or share the file straight to an email app (you paste the address)</button>}
        {!ios && onShare && <button className="link" onClick={onShare} disabled={!ready}>Share the file with another app instead</button>}
        <div className="row">
          <button onClick={onCancel}>{ios ? "Close" : "Cancel"}</button>
          {!ios && <button className="primary" disabled={!ready} onClick={onContinue}>{!ready ? "Preparing…" : "Open email"}</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
