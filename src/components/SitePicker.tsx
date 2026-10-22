import { useEffect, useState } from "react";
import { useStore } from "../store";
import { SITE_COLORS, siteColorIndex } from "../siteColor";
import { BottomSheet } from "./BottomSheet";

/** A site field: tap it to open a search box and the sites in alphabetical order. */
export function SitePicker({ value, names, onPick, label = "Site", unknownNote }: {
  value: string; names: string[]; onPick: (name: string) => void; label?: string; unknownNote?: string;
}) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const shown = sorted.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  const known = names.some((n) => n.toLowerCase() === value.trim().toLowerCase());
  // Keep the list within what is left of the screen above the keyboard.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    const set = () => document.documentElement.style.setProperty("--vvh", `${vv?.height ?? window.innerHeight}px`);
    set();
    vv?.addEventListener("resize", set);
    return () => { vv?.removeEventListener("resize", set); document.documentElement.style.removeProperty("--vvh"); };
  }, [open]);
  const close = () => { setOpen(false); setQ(""); };
  const pick = (n: string) => { onPick(n); close(); };
  const dot = (n: string) => <i className="sw" style={{ background: SITE_COLORS[siteColorIndex(data, n)]!.hex }} />;
  return (
    <>
      <div className="site-field">
        <span className="lbl">{label}</span>
        <button type="button" className="site-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <span>{value ? <>{known && dot(value)}{value}{!known && (unknownNote ?? " (not in rates)")}</> : "Choose a site…"}</span>
          <span aria-hidden="true">▾</span>
        </button>
      </div>
      {open && (
        <BottomSheet label="Choose a site" top fromTop onRequestClose={close}>
          <div className="pick-head">
            <h3 className="sheet-title">Choose a site</h3>
            <button type="button" className="icon" aria-label="Close" onClick={close}>✕</button>
          </div>
          <input
            className="pick-search" type="search" autoFocus placeholder="Search sites" aria-label="Search sites"
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && shown[0]) pick(shown[0]); }}
          />
          <ul className="pick-list">
            {shown.map((n) => (
              <li key={n}>
                <button type="button" className={n.toLowerCase() === value.toLowerCase() ? "on" : ""} onClick={() => pick(n)}>
                  <span>{dot(n)}{n}</span>
                  {n.toLowerCase() === value.toLowerCase() && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="muted pad">No site matches “{q}”.</li>}
          </ul>
        </BottomSheet>
      )}
    </>
  );
}
