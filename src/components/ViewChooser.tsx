import { MONTHS } from "../format";
import { useNav } from "../nav";
import { BottomSheet } from "./BottomSheet";
import { hideMoneySupported, useHideMoney } from "../hideMoney";
import { EyeIcon, EyeOffIcon } from "./Icons";

/** What the eye button offers: look at the timesheet or at the payslip PDF for the month. */
export function ViewChooser({ month }: { month: string }) {
  const { back, open } = useNav();
  const [hidden, toggle] = useHideMoney();
  const monthName = `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  return (
    <BottomSheet label={`View for ${monthName}`} onRequestClose={back}>
      <header className="bar">
        <h2>View · {monthName}</h2>
        <button className="icon" onClick={back} aria-label="Close">✕</button>
      </header>
      <div className="view-choices">
        <button className="primary" onClick={() => open({ sub: "view" })}>View timesheet</button>
        <button className="primary" onClick={() => open({ sub: "viewslip" })}>View payslip (PDF)</button>
        <button className="primary" onClick={() => open({ sub: "viewguide" })}>Guide (PDF)</button>
        <button className="hide-money-btn" disabled={!hideMoneySupported()} aria-pressed={hidden} onClick={() => { toggle(); back(); }}>
          {hidden ? <EyeIcon /> : <EyeOffIcon />} {hidden ? "Show money" : "Hide money"}
        </button>
      </div>
      {!hideMoneySupported() && <p className="muted small">This phone's browser is too old to blur the money. Updating it will turn this on.</p>}
      <p className="muted small">Hide money blurs every dollar figure on the screen, on every page. Files you download still have the real figures.</p>
    </BottomSheet>
  );
}
