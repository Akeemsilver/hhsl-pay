// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AppData } from "../src/model";
import { newData } from "../src/model";
import { computeMonth } from "../src/engine";
import { demoHistory } from "./support";

// A small stand-in for the store, so a screen can be drawn with made-up data and its changes read back.
let current: AppData;
let rerender: () => void = () => {};
vi.mock("../src/store", () => ({
  useStore: () => ({ data: current, update: (fn: (d: AppData) => AppData) => { current = fn(current); rerender(); }, replace: (d: AppData) => { current = d; rerender(); }, persistent: true }),
}));

import { PayslipCheck } from "../src/components/MonthParts";
import { PayrollReminderPopup } from "../src/components/PayrollReminder";
import { NavProvider } from "../src/nav";
import { useState } from "react";

const entries = [
  { id: "a", date: "2026-10-05", site: "Alpha", hours: 12 },
  { id: "b", date: "2026-10-06", site: "Alpha", hours: 12 },
];

function fresh(): AppData {
  const d = newData();
  return { ...d, history: demoHistory, entries, payerNames: { alpha: "Example Group", main: "Other group" } } as AppData;
}

// The host draws its screen again after every change to the data, as the real store does.
function Host({ screen }: { screen: () => React.ReactNode }) {
  const [, setN] = useState(0);
  rerender = () => setN((n) => n + 1);
  return <>{screen()}</>;
}

beforeEach(() => { current = fresh(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Check against your payslip", () => {
  const draw = () => {
    const result = () => computeMonth("2026-10", current.entries, current.history, { ...(current.corrections ? Object.fromEntries(Object.entries(current.corrections).map(([k, v]) => [k.split("|")[1]!, v])) : {}) });
    return render(<Host screen={() => <PayslipCheck month="2026-10" result={result() as never} open />} />);
  };

  it("is there, with a clear title, and asks for the net the bank paid", () => {
    draw();
    expect(screen.getByText("Check against your payslip")).toBeTruthy();
    expect(screen.getByLabelText("Actual net (what the bank paid)")).toBeTruthy();
  });

  it("typing the net shows the PAYE that was taken and how far the net is from the estimate", () => {
    draw();
    const input = screen.getByLabelText("Actual net (what the bank paid)") as HTMLInputElement;
    const estimate = Number(input.placeholder);
    act(() => { fireEvent.change(input, { target: { value: String(estimate - 100) } }); });
    expect(screen.getByRole("status").textContent).toContain("PAYE taken");
    expect(screen.getByRole("status").textContent).toContain("$100.00 lower than the app worked out");
    expect(current.corrections?.["2026-10|alpha"]?.net).toBeCloseTo(estimate - 100, 2);
  });

  it("shows the net, the gross and the PAYE boxes right away, with no extra tap", () => {
    draw();
    for (const l of ["Actual net (what the bank paid)", "Actual gross", "Actual PAYE"]) expect(screen.getByLabelText(l)).toBeTruthy();
  });

  it("typing the net locks the PAYE (it is worked out), and the gross stays free", () => {
    draw();
    const net = screen.getByLabelText("Actual net (what the bank paid)") as HTMLInputElement;
    act(() => { fireEvent.change(net, { target: { value: String(Number(net.placeholder) - 50) } }); });
    const paye = screen.getByLabelText("Actual PAYE") as HTMLInputElement;
    expect(paye.disabled).toBe(true);
    expect(Number(paye.value)).toBeCloseTo(50, 2);
    expect((screen.getByLabelText("Actual gross") as HTMLInputElement).disabled).toBe(false);
  });

  it("typing the PAYE locks the net (it is worked out)", () => {
    draw();
    act(() => { fireEvent.change(screen.getByLabelText("Actual PAYE"), { target: { value: "120" } }); });
    const net = screen.getByLabelText("Actual net (what the bank paid)") as HTMLInputElement;
    expect(net.disabled).toBe(true);
    expect(net.value).not.toBe("");
    expect(screen.getByRole("status").textContent).toContain("Net pay");
  });

  it("a gross with a net locks the PAYE; a gross with a PAYE locks the net", () => {
    draw();
    act(() => { fireEvent.change(screen.getByLabelText("Actual gross"), { target: { value: "5000" } }); });
    act(() => { fireEvent.change(screen.getByLabelText("Actual net (what the bank paid)"), { target: { value: "4000" } }); });
    expect((screen.getByLabelText("Actual PAYE") as HTMLInputElement).disabled).toBe(true);
    act(() => { fireEvent.change(screen.getByLabelText("Actual net (what the bank paid)"), { target: { value: "" } }); });
    act(() => { fireEvent.change(screen.getByLabelText("Actual PAYE"), { target: { value: "300" } }); });
    expect((screen.getByLabelText("Actual net (what the bank paid)") as HTMLInputElement).disabled).toBe(true);
  });

  it("warns when the figures cannot add up (a net far above the gross)", () => {
    draw();
    act(() => { fireEvent.change(screen.getByLabelText("Actual net (what the bank paid)"), { target: { value: "99999" } }); });
    expect(screen.getByRole("alert").textContent).toContain("do not add up");
  });

  it("clearing the net goes back to the calculated figures", () => {
    draw();
    const input = screen.getByLabelText("Actual net (what the bank paid)") as HTMLInputElement;
    act(() => { fireEvent.change(input, { target: { value: "500" } }); });
    act(() => { fireEvent.change(input, { target: { value: "" } }); });
    expect(current.corrections?.["2026-10|alpha"]).toBeUndefined();
  });
});

describe("Payroll reminder pop-up", () => {
  const open = (iso: string) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(`${iso}T12:00:00`));
    return render(<NavProvider><Host screen={() => <PayrollReminderPopup />} /></NavProvider>);
  };

  it("shows on the last day of the month, with the closing date and the three answers", () => {
    open("2026-10-31");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/Payroll closes on/).textContent).toContain("2 November");
    for (const name of ["OK, send it now", "Nothing to send", "Later"]) expect(screen.getByRole("button", { name })).toBeTruthy();
  });

  it("shows again on the 1st and 2nd for the month before, but not on other days", () => {
    open("2026-11-01"); expect(screen.getByRole("alertdialog").textContent).toContain("October 2026"); cleanup();
    open("2026-11-02"); expect(screen.getByRole("alertdialog")).toBeTruthy(); cleanup();
    open("2026-10-30"); expect(screen.queryByRole("alertdialog")).toBeNull(); cleanup();
    open("2026-11-03"); expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Nothing to send stops it for that month", () => {
    open("2026-10-31");
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Nothing to send" })); });
    expect(current.payrollStatus?.["2026-10"]).toBe("none");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("stays quiet when nothing is logged yet", () => {
    current = { ...fresh(), entries: [] };
    open("2026-10-31");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
