import { useState } from "react";
import { useNav } from "../nav";
import { useStore } from "../store";

/** Shown on first start: the name goes on every payslip and timesheet. */
export function WelcomeScreen() {
  const { update } = useStore();
  const { open } = useNav();
  const [name, setName] = useState("");
  const ok = name.trim().length > 0;
  const save = () => ok && update((d) => ({ ...d, userName: name.trim() }));
  return (
    <div className="welcome">
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
