import { useState } from "react";
import { solvePay, type Known, type TaxRules } from "../engine";
import { money } from "../format";

const cents = (n: number) => String(Math.round(n * 100) / 100);

const BOXES: Array<{ key: Known; label: string }> = [
  { key: "net", label: "Net (what the bank pays)" },
  { key: "gross", label: "Gross" },
  { key: "paye", label: "PAYE" },
];

/**
 * A small calculator at the bottom of Home. Type a net, a gross or a PAYE and the other boxes are filled in with the same formulas the
 * app uses for your pay (NIS by the Mondays in the month, PAYE, the health surcharge). The box you typed in is the one that is kept.
 */
export function PayCalculator({ rules, fiveByDefault }: { rules: TaxRules; fiveByDefault: boolean }) {
  const [five, setFive] = useState(fiveByDefault);
  const [source, setSource] = useState<Known | null>(null);
  const [text, setText] = useState("");
  const mondays = five ? 5 : 4;
  const n = text.trim() === "" ? NaN : Number(text);
  const solved = source && Number.isFinite(n) ? solvePay(source, n, mondays, rules) : null;
  const typed = source !== null && text.trim() !== "";
  const label = BOXES.find((b) => b.key === source)?.label.split(" (")[0] ?? "";

  return (
    <section className="card pay-calc" aria-label="Pay calculator">
      <h2>Pay calculator</h2>
      <p className="muted small">Type a net, a gross or a PAYE and the rest is worked out with the same NIS, PAYE and health surcharge rules the app uses for your pay.</p>
      <div className="segmented" role="group" aria-label="Weeks in the month">
        <button className={!five ? "on" : ""} aria-pressed={!five} onClick={() => setFive(false)}>4 weeks</button>
        <button className={five ? "on" : ""} aria-pressed={five} onClick={() => setFive(true)}>5 weeks</button>
      </div>
      <p className="muted small">Weeks means the Mondays in the month: NIS is paid for each one, and a 5 week month has a bigger health surcharge.</p>
      {BOXES.map(({ key, label: l }) => (
        <label key={key} className={source === key ? "calc-src" : ""}>{l}{source === key && <small className="muted"> · you typed this</small>}
          <input data-money="" type="number" inputMode="decimal" step="any" min="0" aria-label={l}
            placeholder="0.00"
            value={source === key ? text : solved ? cents(solved.tax[key]) : ""}
            onChange={(e) => { setSource(key); setText(e.target.value); }} />
        </label>
      ))}
      {solved && (
        <ul className="calc-lines" aria-label="Breakdown">
          <li><span>NIS</span><strong>{money(solved.tax.nis)}</strong></li>
          <li><span>Health surcharge</span><strong>{money(solved.tax.surcharge)}</strong></li>
          <li><span>PAYE</span><strong>{money(solved.tax.paye)}</strong></li>
          <li className="total"><span>All taken off the gross</span><strong>{money(solved.tax.nis + solved.tax.surcharge + solved.tax.paye)}</strong></li>
        </ul>
      )}
      {solved?.zeroPaye && <p className="notice" role="status">No PAYE is paid up to a gross of {money(solved.tax.gross)} in a {mondays} week month.</p>}
      {solved && solved.others.length > 0 && (
        <p className="notice" role="status">The same {label.toLowerCase()} can also be reached with a gross of {solved.others.map(money).join(" or ")}, because the NIS and surcharge step up at that point. The lowest gross is shown.</p>
      )}
      {typed && !solved && <p className="notice warn" role="alert">No gross gives exactly that {label.toLowerCase()} with the current NIS and surcharge steps. Try a slightly different figure.</p>}
      {typed && <button onClick={() => { setSource(null); setText(""); }}>Clear</button>}
    </section>
  );
}
