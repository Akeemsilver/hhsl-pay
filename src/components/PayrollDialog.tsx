import { createPortal } from "react-dom";
import { useLayer } from "./layers";
import type { PayrollEmail } from "../payroll";
import { AppleMailIcon, GmailIcon, OutlookIcon } from "./MailIcons";

/**
 * Send your time sheet to payroll, in two steps on every phone: 1. save the time sheet, 2. open an email app with the address, subject
 * and message filled in, then attach the file. iPhone saves through the share menu (Save to Files) and has Mail, Gmail and Outlook
 * buttons; Android saves to Downloads and opens its own chooser (Gmail, Outlook, ...).
 */
export function PayrollDialog({ email, fileName, onCancel, onShare, ready = true, error = null, ios = false, onSave, saved = false, savedName = null, onOpenEmail, onShareMail }: {
  email: PayrollEmail; fileName: string; onCancel: () => void; onShare?: () => void; ready?: boolean; error?: string | null;
  ios?: boolean; onSave?: () => void; saved?: boolean; /** Android: the name saved in Downloads. */ savedName?: string | null;
  onOpenEmail?: (app: "mail" | "gmail" | "outlook") => void; onShareMail?: () => void;
}) {
  useLayer(onCancel);
  return createPortal(
    <div className="confirm-backdrop">
      <div className="confirm payroll" role="dialog" aria-modal="true" aria-label="Send time sheet to payroll">
        <p className="muted small">Send by email</p>
        <h2>Send your time sheet to payroll</h2>
        <p className="muted small">This takes two steps. The email below is filled in for you; you attach the time sheet (<strong>{fileName}</strong>).</p>
        <div className="mail-preview" aria-label="Email preview">
          <div><span>To</span><b>{email.to}</b></div>
          <div><span>Subject</span><b>{email.subject}</b></div>
          <pre>{email.body}</pre>
        </div>
        <p className="muted small">This is your official submission. Payroll checks the hours; the pay shown in the app is only an estimate.</p>
        {error && <p className="notice" role="alert">{ios ? `Share did not open (${error}). Tap it again, or try the other way.` : `Share did not open (${error}). Tap it again to try another way.`}</p>}
        <div className="ios-steps">
          <div>
            <strong>1. Save the time sheet</strong>
            <button className={saved ? "" : "primary"} disabled={!ready || (!ios && saved)} onClick={onSave}>
              {!ready ? "Preparing…" : saved ? (ios ? "Saved ✓ Save again" : "Saved ✓") : "Save time sheet"}
            </button>
            <span className="muted small">{ios ? <>In the menu that opens, tap <strong>Save to Files</strong>.</> : saved && savedName ? <>Saved in your Downloads as <strong>{savedName}</strong>.</> : "It is saved to your Downloads."}</span>
          </div>
          <div>
            <strong>2. Open your email app</strong>
            {ios ? (
              <div className="mail-apps">
                <button onClick={() => onOpenEmail?.("mail")}><AppleMailIcon /><span>Open email</span></button>
                <button onClick={() => onOpenEmail?.("gmail")}><GmailIcon /><span>Open Gmail</span></button>
                <button onClick={() => onOpenEmail?.("outlook")}><OutlookIcon /><span>Open Outlook</span></button>
              </div>
            ) : (
              <button className="primary" disabled={!ready} onClick={() => onOpenEmail?.("mail")}>Open email</button>
            )}
            <span className="muted small">{ios ? "It opens with the address, subject and message filled in. Tap the paperclip and pick the time sheet from Files, then send." : "Pick Gmail or Outlook. It opens with the address, subject and message filled in. Tap the paperclip and attach the time sheet from Downloads, then send."}</span>
          </div>
        </div>
        {ios
          ? <button className="link" onClick={onShareMail} disabled={!ready}>Or share the file straight to an email app (you paste the address)</button>
          : onShare && <button className="link" onClick={onShare} disabled={!ready}>Or share the file with another app instead</button>}
        <div className="row one">
          <button onClick={onCancel}>Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
