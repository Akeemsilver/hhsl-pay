import { useState } from "react";
import { backupFileName } from "../backup";

/** The starter kit is shared as a PDF (a .json is refused by the phone, a .txt opens as text in WhatsApp), so that is the name people see. */
const kitName = () => backupFileName("rates", false).replace(/\.json$/, ".pdf");
import { shareMessage } from "../shareGuide";

/** A written guide to giving a colleague the app, and a ready-made message to send with it. */
export function ShareGuide({ link }: { link: string }) {
  const message = shareMessage(link, kitName());
  const [note, setNote] = useState<string | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setNote("Message copied. Paste it into WhatsApp or an email."); }
    catch { setNote("Press and hold the message above to copy it."); }
  };
  const send = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: "HHSL pay app", text: message }); setNote(null); }
      else await copy();
    } catch { /* cancelled */ }
  };
  return (
    <details className="share-guide">
      <summary className="guide-toggle"><span>Sharing guide</span><span aria-hidden="true">▾</span></summary>
      <h3 className="section-title">Message to send</h3>
      <p className="muted small">Send this first. It has the link and tells your colleague what to do. Then send the starter kit file and the guide (PDF) with the buttons above.</p>
      <textarea readOnly aria-label="Message to send" rows={17} value={message} onFocus={(e) => e.currentTarget.select()} />
      <div className="row">
        <button onClick={() => void copy()}>Copy message</button>
        <button className="primary" onClick={() => void send()}>Share message</button>
      </div>
      {note && <p className="notice" role="status">{note}</p>}

      <details>
        <summary>Step by step: what you do</summary>
        <ol className="steps">
          <li>Tap <strong>Share message</strong> and pick <strong>WhatsApp</strong> (or Gmail), then the person. The link is inside the message.</li>
          <li>Tap <strong>Share starter kit</strong> above, pick <strong>WhatsApp</strong> and the same person. This sends the file with your sites, rates and tax rules. It has no days and no pay.</li>
          <li>Tap <strong>Share guide (PDF)</strong> above and send it to the same person. It has the steps, with pictures, for doing everything on their phone.</li>
          <li>Wait for them to say it works. If they get stuck, see the problems list below.</li>
          <li>Keep your own app up to date. If you change rates later, send a new starter kit. They apply it from Settings, Backup &amp; restore, and their days stay as they are.</li>
        </ol>
      </details>

      <details>
        <summary>Step by step: what your colleague does</summary>
        <ol className="steps">
          <li>Open the link <strong>in Chrome</strong> (Android) or <strong>Safari</strong> (iPhone). If it opens inside WhatsApp, tap the three dots, then <strong>Open in browser</strong>.</li>
          <li>Install it: Android, tap <strong>Install app</strong>. iPhone, tap Share, then <strong>Add to Home Screen</strong>. (The install guide is on the first screen too.)</li>
          <li>In WhatsApp, tap the file <strong>{kitName()}</strong> and save it to the phone. Android: tap the download arrow. iPhone: tap the file, tap the Share icon, then <strong>Save to Files</strong>.</li>
          <li>Open the app from its icon. Type their full name, tap <strong>Continue</strong>.</li>
          <li>Tap <strong>Choose starter kit file</strong> and pick the file from Downloads. The sites and rates fill in.</li>
          <li>Start logging days. They can back up from Settings, Backup &amp; restore.</li>
        </ol>
      </details>

      <details>
        <summary>If something goes wrong</summary>
        <ul className="steps">
          <li><strong>The link opens but nothing installs.</strong> Use Chrome on Android or Safari on iPhone, not a browser inside another app, and not a private tab.</li>
          <li><strong>The file will not pick.</strong> Make sure it is saved on the phone, not just in the chat. Open the file picker, tap the menu, choose <strong>Downloads</strong>.</li>
          <li><strong>An error about the file.</strong> They picked a different file, for example a backup. It must be the one named {kitName()}.</li>
          <li><strong>They already entered sites by hand.</strong> Applying the starter kit later, in Settings, Backup &amp; restore, replaces the rates but keeps their days.</li>
        </ul>
      </details>

      <p className="muted small">Why a file? The app's code is public, and company rates must never be put in public code. Only send the starter kit to colleagues who should have these rates.</p>
    </details>
  );
}
