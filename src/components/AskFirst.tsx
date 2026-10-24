import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export interface AskWhat { title: string; message: string; confirmLabel?: string }

/**
 * Every button that makes a file asks first: a pop-up that has to be answered, so nothing is ever one tap straight to a
 * download. Render `askDialog` in the screen; call `askFirst(what, run)` from the button, `run` happens on "Yes".
 */
export function useAskFirst(): { askFirst: (what: AskWhat, run: () => void) => void; askDialog: ReactNode } {
  const [pending, setPending] = useState<(AskWhat & { run: () => void }) | null>(null);
  const askDialog = pending && (
    <ConfirmDialog
      safe
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel ?? "Yes"}
      cancelLabel="Cancel"
      onCancel={() => setPending(null)}
      onConfirm={() => { const run = pending.run; setPending(null); run(); }}
    />
  );
  return { askFirst: (what, run) => setPending({ ...what, run }), askDialog };
}
