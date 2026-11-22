// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { initInputKeys } from "../src/inputKeys";

beforeAll(() => initInputKeys());
afterEach(() => { document.body.innerHTML = ""; });

const later = () => new Promise((r) => setTimeout(r, 5));

describe("keyboard tick instead of next", () => {
  it("marks every typed box as done, including ones that appear later, and leaves ticks, dates and files alone", async () => {
    document.body.innerHTML = `<div><input id="a" type="text"><input id="n" type="number"><input id="s" type="search"><input id="c" type="checkbox"><input id="d" type="date"><input id="f" type="file"></div>`;
    await later();
    for (const id of ["a", "n", "s"]) expect(document.getElementById(id)!.getAttribute("enterkeyhint")).toBe("done");
    for (const id of ["c", "d", "f"]) expect(document.getElementById(id)!.hasAttribute("enterkeyhint")).toBe(false);
    const late = document.createElement("section"); late.innerHTML = `<label><input id="late" type="number"></label>`; document.body.append(late);
    await later();
    expect(document.getElementById("late")!.getAttribute("enterkeyhint")).toBe("done");
  });

  it("Enter closes the keyboard and leaves the box", async () => {
    document.body.innerHTML = `<input id="a" type="number">`;
    const el = document.getElementById("a") as HTMLInputElement; el.focus();
    expect(document.activeElement).toBe(el);
    const blur = vi.spyOn(el, "blur");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await later();
    expect(blur).toHaveBeenCalled();
    expect(document.activeElement).not.toBe(el);
  });

  it("other keys leave the box focused", async () => {
    document.body.innerHTML = `<input id="a" type="text">`;
    const el = document.getElementById("a") as HTMLInputElement; el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    await later();
    expect(document.activeElement).toBe(el);
  });
});
