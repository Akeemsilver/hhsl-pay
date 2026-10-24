import { useState } from "react";
import { BottomSheet } from "./BottomSheet";

/** What the "Choose yearly / monthly spreadsheet" button offers: where the spreadsheet comes from. */
export function SpreadsheetSource({ onClose, onPhone, onDrive }: { onClose: () => void; onPhone: () => void; onDrive: () => void }) {
  const [steps, setSteps] = useState(false);
  return (
    <BottomSheet label="Choose your spreadsheet" onRequestClose={onClose}>
      <header className="bar">
        <h2>Choose your spreadsheet</h2>
        <button className="icon" onClick={onClose} aria-label="Close">✕</button>
      </header>
      <div className="source-choices">
        <button className="primary" onClick={onPhone}>
          <strong>Excel file on this phone</strong>
          <span>From Downloads, Files or WhatsApp. The usual way.</span>
        </button>
        <button className="primary" onClick={onDrive}>
          <strong>Excel file in Google Drive</strong>
          <span>Opens your phone's files: tap the menu at the top left, then Drive, and pick an Excel (.xlsx) file.</span>
        </button>
        <button aria-expanded={steps} onClick={() => setSteps((v) => !v)}>
          <strong>Share from Sheets or Drive (Android)</strong>
          <span>Send the sheet to this app from the Google Sheets or Drive app.</span>
        </button>
        {steps && (
          <ol className="steps small">
            <li>Open your sheet in the <strong>Google Sheets</strong> app (or the file in <strong>Drive</strong>).</li>
            <li>Tap the three dots, then <strong>Share &amp; export</strong>, then <strong>Send a copy</strong>.</li>
            <li>Choose <strong>Excel (.xlsx)</strong>.</li>
            <li>In the list of apps, tap <strong>HHSL pay</strong>. The import preview opens.</li>
            <li>HHSL pay is not in the list? Save the sheet as Excel and use one of the two buttons above.</li>
          </ol>
        )}
      </div>
    </BottomSheet>
  );
}
