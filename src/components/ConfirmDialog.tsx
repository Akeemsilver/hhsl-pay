import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLayer } from "./layers";

/** A small "are you sure?" box. Escape or tapping outside keeps the user where they were. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  useLayer(onCancel);
  useEffect(() => keep.current?.focus(), []);
  return createPortal(
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label={title} aria-describedby="confirm-msg" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p id="confirm-msg" className="muted">{message}</p>
        <div className="row">
          <button ref={keep} className="primary" onClick={onCancel}>{cancelLabel}</button>
          <button className="danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
