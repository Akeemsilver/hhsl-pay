import { MONTHS } from "../format";
import { useStore } from "../store";

/** The month and the year as two pickers, so either can be changed. `month` is "YYYY-MM". */
export function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const { data } = useStore();
  const year = Number(month.slice(0, 4));
  const thisYear = new Date().getFullYear();
  const first = data.entries.reduce((min, e) => Math.min(min, Number(e.date.slice(0, 4))), thisYear);
  const from = Math.min(first, year, thisYear - 5);
  const to = Math.max(thisYear + 2, year);
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <div className="monthname">
      <select aria-label="Month" value={month.slice(5)} onChange={(e) => onChange(`${year}-${e.target.value}`)}>
        {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
      </select>{" "}
      <select aria-label="Year" value={year} onChange={(e) => onChange(`${e.target.value}-${month.slice(5)}`)}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
