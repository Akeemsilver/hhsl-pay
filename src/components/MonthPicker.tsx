import { MONTHS } from "../format";

/**
 * The month and year as one tap target ("October 2026"). Tapping opens the phone's own month and year picker, so
 * there is no choosing a month and then a year separately. `month` is "YYYY-MM".
 */
export function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const label = `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
  return (
    <div className="monthname month-field">
      <span aria-hidden="true">{label}<i className="mf-caret">▾</i></span>
      <input
        type="month" aria-label={`Month and year, ${label}. Tap to change.`} value={month} min="2000-01" max="2100-12"
        onChange={(e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) onChange(e.target.value); }}
      />
    </div>
  );
}
