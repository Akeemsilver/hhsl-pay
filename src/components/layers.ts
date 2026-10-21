import { useEffect, useRef } from "react";

const stack: number[] = [];
let nextId = 1;

/** Registers an overlay so that Escape only closes the topmost one. */
export function useLayer(onEscape: () => void): void {
  const id = useRef(nextId++);
  const cb = useRef(onEscape);
  cb.current = onEscape;
  useEffect(() => {
    const mine = id.current;
    stack.push(mine);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === mine) {
        e.stopPropagation();
        cb.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      stack.splice(stack.indexOf(mine), 1);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
