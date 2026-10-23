import { useEffect, useState } from "react";
import { deliver } from "../backup";
import { GUIDE_FILE } from "../guideFile";
import { useNav } from "../nav";
import { PdfViewer } from "./PdfViewer";

/** The mobile guide, read inside the app. It is fetched from the app's own address, so it is always the latest one. */
export function GuideViewer() {
  const { back } = useNav();
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${import.meta.env.BASE_URL}${GUIDE_FILE}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => live && setPdf(new Uint8Array(b)))
      .catch(() => live && setError("The guide could not be loaded. It needs a signal the first time; try again in a moment."));
    return () => { live = false; };
  }, []);

  const share = async () => {
    if (!pdf) return;
    try {
      const how = await deliver(GUIDE_FILE, pdf, "application/pdf");
      setNote(how === "shared" ? "Guide shared." : "Guide saved to your Downloads.");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setNote("Could not create the file.");
    }
  };

  return (
    <PdfViewer
      pdf={pdf} error={error} busy="Loading the guide…" label="Guide" title="Guide" onClose={back}
      foot={<>
        {note && <span className="muted small">{note}</span>}
        <button className="primary" disabled={!pdf} onClick={share}>Share guide (PDF)</button>
      </>}
    />
  );
}
