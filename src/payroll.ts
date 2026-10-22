/** The email that "Send to payroll" opens: addressed, with the subject and message already written. */
export interface PayrollEmail {
  to: string;
  subject: string;
  body: string;
}

export function payrollEmail(input: { to: string; name: string; monthName: string; siteLabel: string; days: number; hours: number; fileName: string }): PayrollEmail {
  const name = input.name.trim() || "Employee";
  return {
    to: input.to,
    subject: `Time Sheet - ${name} - ${input.monthName}`,
    body: [
      "Good day,",
      "",
      `Attached is my ${input.monthName} time sheet.`,
      "",
      "Thanks,",
      name,
    ].join("\n"),
  };
}

/** A mailto link; on Android it opens the phone's mail app (Gmail) with everything filled in except the attachment. */
export function mailtoLink(e: PayrollEmail): string {
  return `mailto:${e.to}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;
}
