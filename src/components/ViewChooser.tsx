import { MONTHS } from "../format";
import { useNav } from "../nav";
import { BottomSheet } from "./BottomSheet";

/** What the eye button offers: look at the timesheet or at the payslip PDF for the month. */
export function ViewChooser({ month }: { month: string }) {
  const { back, open } = useNav();
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
      </div>
    </BottomSheet>
  );
}
