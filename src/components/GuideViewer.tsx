import { useEffect, useState } from "react";
import { deliver, download, withTime } from "../backup";
import { GUIDE_FILE, isGuideKept, loadGuide } from "../guideFile";
import { ConfirmDialog } from "./ConfirmDialog";
import { useNav } from "../nav";
import { PdfViewer } from "./PdfViewer";
import { useAskFirst } from "./AskFirst";

/**
 * The mobile guide, read inside the app. It is never downloaded on its own: if it is not on the phone yet, a pop-up says so
 * (about 2.7 MB) and asks first. Once kept, it opens without downloading until the app itself updates.
 */
export function GuideViewer() {
  const { back } = useNav();
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [step, setStep] = useState<"check" | "ask" | "go">("check");
  const { askFirst, askDialog } = useAskFirst();

  useEffect(() => {
    let live = true;
    void isGuideKept().then((kept) => live && setStep(kept ? "go" : "ask"));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (step !== "go") return;
    let live = true;
    loadGuide()
      .then((b) => live && setPdf(b))
      .catch(() => live && setError("The guide could not be loaded. It needs a signal the first time; try again in a moment."));
    return () => { live = false; };
  }, [step]);

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
    {step === "ask" && (
      <ConfirmDialog
        safe
        title="Open the guide?"
        message="The guide is about 2.7 MB. It downloads now and is kept on your phone, so next time it opens without downloading again (until the app updates)."
        confirmLabel="Yes, open it" cancelLabel="Cancel"
        onCancel={back}
        onConfirm={() => setStep("go")}
      />
    )}
    <PdfViewer
      pdf={pdf} error={error} busy={step === "go" ? "Loading the guide…" : "Waiting for your answer…"} label="Guide" title="Guide" onClose={back}
      foot={<>
        {note && <span className="muted small">{note}</span>}
        <button disabled={!pdf} onClick={() => askFirst({ title: "Share the guide?", message: "Your phone's share menu opens with the guide (PDF), so you can send it to a colleague.", confirmLabel: "Yes, share" }, () => void share())}>Share</button>
        <button className="primary" disabled={!pdf} onClick={() => askFirst({ title: "Download the guide?", message: "The guide (PDF) is saved to your Downloads.", confirmLabel: "Yes, download" }, save)}>Download guide (PDF)</button>
      </>}
    />
    </>
  );
}
