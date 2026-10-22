import { useRef, useState } from "react";
import { useNav } from "../nav";
import { readKit } from "../kit";
import { useStore } from "../store";
import { userNameOf } from "../model";

/** First start. Step 1: your name (printed on payslips and timesheets). Step 2: get the starter kit with the pay rates. */
export function WelcomeScreen() {
  const { data, update, replace } = useStore();
  const { open } = useNav();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hasName = !!userNameOf(data);

  if (!hasName) {
    const ok = name.trim().length > 0;
    const save = () => ok && update((d) => ({ ...d, userName: name.trim() }));
    return (
      <div className="welcome">
        <p className="muted small">Step 1 of 2</p>
        <h1>Welcome</h1>
        <p className="muted">Everything stays on this phone. What is your name? It is printed on your payslips and timesheets, and you can change it later in Settings.</p>
        <form onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label>Your full name
            <input autoFocus autoComplete="name" aria-label="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className="primary" disabled={!ok}>Continue</button>
        </form>
        <button className="link" onClick={() => open({ page: "backup" })}>Restore a backup instead</button>
      </div>
    );
  }

  async function pick(file: File) {
    setMessage(null);
    setBusy(true);
    try {
      const r = await readKit(file, data);
      replace(r.data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="welcome">
      <p className="muted small">Step 2 of 2</p>
      <h1>Get your starter kit</h1>
      <p className="muted">The starter kit is a small file with the pay rates for each site, so you do not have to type them in. It has no pay or personal information in it.</p>
      <p className="muted small">Why a file? The rates belong to the company, so they are kept out of the app itself, which is public. Sharing them as a file between colleagues is how company rates stay out of public code.</p>
      <ol className="steps">
        <li>Ask the person who sent you the link to this app to send you the <strong>starter kit file</strong>. They find it in the app under Settings, Share this app.</li>
        <li>They send it to you on WhatsApp.</li>
        <li>In WhatsApp, tap the file to download it to your phone.</li>
        <li>Come back here, tap <strong>Choose starter kit file</strong>, and pick it from your Downloads.</li>
      </ol>
      <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Starter kit file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ""; }} />
      <button className="primary wide" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Reading…" : "Choose starter kit file…"}</button>
      {message && <p className="notice warn" role="alert">{message}</p>}
      <button className="link" onClick={() => open({ page: "backup" })}>I have a yearly spreadsheet instead</button>
      <button className="link" onClick={() => update((d) => ({ ...d, setupSkipped: true }))}>Skip for now, I will add sites myself</button>
    </div>
  );
}
