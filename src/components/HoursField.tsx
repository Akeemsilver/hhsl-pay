import { useState } from "react";
import { hoursText, parseHoursInput } from "../format";

/**
 * The hours-paid box. It is a text box so you can type 11.5, 10.5, 9.5 (or 9,5) freely, delete everything,
 * and start again. While you are typing it shows exactly what you typed; the rest of the time it shows the
 * real value, so the + and - buttons next to it are always reflected straight away.
 */
export function HoursField({ value, onChange }: { value: number; onChange: (hours: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  return (
    <input
      type="text" inputMode="decimal" autoComplete="off" aria-label="Hours paid" placeholder="0"
      value={focused ? text : hoursText(value)}
      onFocus={(e) => {
        const input = e.target;
        setText(hoursText(value));
        setFocused(true);
        setTimeout(() => input.select(), 0);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const hours = parseHoursInput(raw);
        if (hours === null) return; // ignore a key that would make it not a number
        setText(raw.replace(",", ".").replace(/^0+(?=\d)/, ""));
        onChange(hours);
      }}
      onBlur={() => setFocused(false)}
    />
  );
}
