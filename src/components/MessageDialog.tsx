import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLayer } from "./layers";

/** A warning with one button. Escape or the button closes it; tapping outside does nothing. */
export function MessageDialog({ title, message, okLabel = "OK", onClose }: { title: string; message: string; okLabel?: string; onClose: () => void }) {
  const ok = useRef<HTMLButtonElement>(null);
  useLayer(onClose);
  useEffect(() => ok.current?.focus(), []);
  return createPortal(
    <div className="confirm-backdrop">
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={title} aria-describedby="message-msg">
        <h2>{title}</h2>
        <p id="message-msg" className="muted">{message}</p>
        <div className="row one">
          <button ref={ok} className="primary" onClick={onClose}>{okLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
