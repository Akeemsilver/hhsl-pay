/**
 * The keyboard's action key. On a phone it shows "next" (an arrow) whenever another box follows, which does not close the keyboard.
 * Every box that is typed in gets enterkeyhint="done", so the key is a tick, and pressing Enter (the tick) closes the keyboard and
 * leaves the box. Boxes that are not typed in (ticks, dates, files) are left alone.
 */
const TYPED = new Set(["text", "number", "search", "tel", "email", "password", "url"]);

const isTyped = (el: unknown): el is HTMLInputElement => el instanceof HTMLInputElement && TYPED.has(el.type);

function mark(root: Element): void {
  if (isTyped(root) && !root.hasAttribute("enterkeyhint")) root.setAttribute("enterkeyhint", "done");
  root.querySelectorAll("input").forEach((el) => { if (isTyped(el) && !el.hasAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", "done"); });
}

export function initInputKeys(): void {
  if (typeof document === "undefined") return;
  mark(document.documentElement);
  // New boxes appear all the time (sheets, pages); they are marked as soon as they are on the page, before anyone can tap them.
  new MutationObserver((changes) => {
    for (const c of changes) c.addedNodes.forEach((n) => { if (n instanceof Element) mark(n); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !isTyped(e.target)) return;
    const el = e.target;
    // After the key has done its normal job (for example sending a form), so nothing that listens for Enter is cut off.
    window.setTimeout(() => el.blur(), 0);
  });
}
