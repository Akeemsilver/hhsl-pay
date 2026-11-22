import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  value: number | string | undefined;
  /** The cleaned text typed so far ("" when empty). */
  onText: (text: string) => void;
};

const str = (v: number | string | undefined) => (v === undefined ? "" : String(v));
const same = (text: string, value: number | string | undefined) =>
  value === undefined || value === "" ? text === "" || text === "." : Number(text) === Number(value);

/**
 * A box for a plain number. It is a text box with the number keypad, because the number type makes the phone keyboard show a "next"
 * arrow, and every box here must show a tick that closes the keyboard. It keeps what is being typed (a "12." stays a "12.") and only
 * lets digits and one dot through (a comma counts as the dot).
 */
export function DecimalInput({ value, onText, ...rest }: Props) {
  const [text, setText] = useState(str(value));
  const shown = same(text, value) ? text : str(value);
  return (
    <input {...rest} type="text" inputMode="decimal" enterKeyHint="done" autoComplete="off" value={shown}
      onChange={(e) => {
        let t = e.target.value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
        const dot = t.indexOf(".");
        if (dot >= 0) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, "");
        setText(t);
        onText(t === "." ? "" : t);
      }} />
  );
}
