import { useEffect, useState } from "react";
import { deliver, download, withTime } from "../backup";
import { GUIDE_FILE } from "../guideFile";
import { useNav } from "../nav";
import { PdfViewer } from "./PdfViewer";
import { useAskFirst } from "./AskFirst";

/** The mobile guide, read inside the app. It is fetched from the app's own address, so it is always the latest one. */
export function GuideViewer() {
  const { back } = useNav();
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { askFirst, askDialog } = useAskFirst();

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

  const save = () => {
    if (!pdf) return;
    download(withTime(GUIDE_FILE), pdf, "application/pdf");
    setNote("Guide saved to your Downloads.");
  };

  return (
    <>
    {askDialog}
    <PdfViewer
      pdf={pdf} error={error} busy="Loading the guide…" label="Guide" title="Guide" onClose={back}
      foot={<>
        {note && <span className="muted small">{note}</span>}
        <button disabled={!pdf} onClick={() => askFirst({ title: "Share the guide?", message: "Your phone's share menu opens with the guide (PDF), so you can send it to a colleague.", confirmLabel: "Yes, share" }, () => void share())}>Share</button>
        <button className="primary" disabled={!pdf} onClick={() => askFirst({ title: "Download the guide?", message: "The guide (PDF) is saved to your Downloads.", confirmLabel: "Yes, download" }, save)}>Download guide (PDF)</button>
      </>}
    />
    </>
  );
}
