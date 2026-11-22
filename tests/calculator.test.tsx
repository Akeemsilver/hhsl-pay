// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PayCalculator } from "../src/components/PayCalculator";
import { monthTax } from "../src/engine";
import { demoTax } from "./support";

afterEach(cleanup);

const draw = (five = false) => render(<PayCalculator rules={demoTax} fiveByDefault={five} />);
const summary = () => within(screen.getByLabelText("Summary")).getAllByRole("listitem").map((li) => li.textContent);

describe("pay calculator", () => {
  it("shows the boxes as gross, net, PAYE and an empty summary to begin with", () => {
    draw();
    const labels = ["Gross", "Net (what the bank pays)", "PAYE"].map((l) => screen.getByLabelText(l));
    expect(labels.length).toBe(3);
    expect(summary()[0]).toBe("Gross–");
    expect(summary().length).toBe(6);
  });

  it("a net fills in the gross, PAYE and the summary, using the app's own formulas", () => {
    draw();
    act(() => { fireEvent.change(screen.getByLabelText("Net (what the bank pays)"), { target: { value: "10000" } }); });
    const gross = Number((screen.getByLabelText("Gross") as HTMLInputElement).value);
    const t = monthTax(gross, 4, demoTax);
    expect(Math.abs(t.net - 10000)).toBeLessThan(0.02);
    expect(Number((screen.getByLabelText("PAYE") as HTMLInputElement).value)).toBeCloseTo(t.paye, 1);
    expect(summary()[3]).toContain("NIS");
    expect(summary()[1]).toContain("$10,000.00");
  });

  it("the 5 week switch changes the answer", () => {
    draw();
    act(() => { fireEvent.change(screen.getByLabelText("Net (what the bank pays)"), { target: { value: "10000" } }); });
    const four = Number((screen.getByLabelText("Gross") as HTMLInputElement).value);
    act(() => { fireEvent.click(screen.getByRole("button", { name: "5 weeks" })); });
    expect(Number((screen.getByLabelText("Gross") as HTMLInputElement).value)).toBeGreaterThan(four);
  });

  it("a gross fills in the net, and Clear empties it all", () => {
    draw();
    act(() => { fireEvent.change(screen.getByLabelText("Gross"), { target: { value: "5000" } }); });
    expect(Number((screen.getByLabelText("Net (what the bank pays)") as HTMLInputElement).value)).toBeCloseTo(monthTax(5000, 4, demoTax).net, 1);
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Clear" })); });
    expect((screen.getByLabelText("Gross") as HTMLInputElement).value).toBe("");
    expect(summary()[0]).toBe("Gross–");
  });

  it("says so when no gross gives the figure", () => {
    draw();
    act(() => { fireEvent.change(screen.getByLabelText("Net (what the bank pays)"), { target: { value: "-5" } }); });
    expect(screen.getByRole("alert").textContent).toContain("No gross gives exactly that net");
  });
});
