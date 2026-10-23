import { describe, expect, it } from "vitest";

describe("payroll email", () => {
  it("is addressed with the subject and message written", async () => {
    const { payrollEmail, mailtoLink } = await import("../src/payroll");
    const e = payrollEmail({ to: "payrollassistant@hhslsafety.com", name: "AKEEM SILVERTON", monthName: "October 2026", siteLabel: "ERT Offsite", days: 1, hours: 8, fileName: "HHSL-Time-Sheet.xlsx" });
    expect(e.subject).toBe("Time Sheet - AKEEM SILVERTON - October 2026");
    expect(e.body).toContain("October 2026");
    expect(e.body).toBe("Good day,\n\nAttached is my October 2026 time sheet.\n\nThanks,\nAKEEM SILVERTON");
    const link = mailtoLink(e);
    expect(link.startsWith("mailto:payrollassistant@hhslsafety.com?subject=Time%20Sheet")).toBe(true);
    expect(decodeURIComponent(link.split("body=")[1]!)).toBe(e.body);
  });
  it("builds links that open Mail, Gmail and Outlook with the address, subject and message filled in", async () => {
    const { payrollEmail, mailtoLink, gmailLink, outlookLink } = await import("../src/payroll");
    const e = payrollEmail({ to: "a@b.test", name: "TEST PERSON", monthName: "October 2026", siteLabel: "x", days: 1, hours: 8, fileName: "f.xlsx" });
    expect(mailtoLink(e)).toMatch(/^mailto:a@b\.test\?subject=/);
    expect(gmailLink(e)).toMatch(/^googlegmail:\/\/\/co\?to=a%40b\.test&subject=Time%20Sheet/);
    expect(outlookLink(e)).toMatch(/^ms-outlook:\/\/compose\?to=a%40b\.test&subject=Time%20Sheet/);
    expect(decodeURIComponent(gmailLink(e).split("body=")[1]!)).toBe(e.body);
  });
});
