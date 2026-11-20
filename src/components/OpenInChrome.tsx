import { useState } from "react";
import { chromeIntentUrl } from "../install";

/** Shown on an Android phone whose browser cannot install the app: one tap opens this page in Chrome, or the link can be copied. */
export function OpenInChrome() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { /* the address is in the browser's address bar */ }
  };
  return (
    <div className="notice warn" role="status">
      <strong>Open this in Chrome to install the app</strong>
      <p>This browser cannot put the app on your home screen. Chrome can. Tap the button, or copy the link and paste it into Chrome.</p>
      <div className="row">
        <button className="primary" onClick={() => { window.location.href = chromeIntentUrl(window.location.href); }}>Open in Chrome</button>
        <button onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy link"}</button>
      </div>
    </div>
  );
}
