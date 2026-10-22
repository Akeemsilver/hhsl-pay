import { money } from "../format";
import { averageThrough, throughLabel } from "../averages";

/** A small line: average gross and average net a month, from January up to the given month. */
export function AverageLine({ gross, net, index }: { gross: number[]; net: number[]; index: number }) {
  return (
    <p className="avg-line" aria-label={`Average a month, ${throughLabel(index)}`}>
      <span>Monthly avg, {throughLabel(index)}:</span>{" "}
      <span className="c-gross">Gross {money(averageThrough(gross, index))}</span>
      {" · "}
      <span className="c-net">Net {money(averageThrough(net, index))}</span>
    </p>
  );
}
