import type { ReactNode } from "react";
import { useNav } from "../nav";
import { BackIcon, GearIcon } from "./Icons";

/** Header for the main tabs: title on the left, settings gear on the right. */
export function TopBar({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  const { open } = useNav();
  return (
    <header className="bar top">
      <div className="titles">
        <h1>{title}</h1>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
      <div className="top-actions">
        {action}
        <button className="icon gear" aria-label="Settings" onClick={() => open({ page: "settings" })}>
          <GearIcon />
        </button>
      </div>
    </header>
  );
}

/** Header for pushed pages: back arrow plus title. */
export function PageHeader({ title }: { title: string }) {
  const { back } = useNav();
  return (
    <header className="bar page">
      <button className="icon" aria-label="Back" onClick={back}><BackIcon /></button>
      <h1>{title}</h1>
      <span className="spacer" />
    </header>
  );
}
