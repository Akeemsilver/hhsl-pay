import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLayer } from "./layers";

/** A small "are you sure?" box. It must be answered with a button (or Escape); tapping outside does nothing. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, safe }: {
  title: string; message: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void;
  /** The confirm button is the normal, expected action (not a destructive one). */
  safe?: boolean;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  useLayer(onCancel);
  useEffect(() => keep.current?.focus(), []);
  return createPortal(
    <div className="confirm-backdrop">
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={title} aria-describedby="confirm-msg" >
        <h2>{title}</h2>
        <p id="confirm-msg" className="muted">{message}</p>
        <div className="row">
          <button ref={keep} className={safe ? "" : "primary"} onClick={onCancel}>{cancelLabel}</button>
          <button className={safe ? "primary" : "danger"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
