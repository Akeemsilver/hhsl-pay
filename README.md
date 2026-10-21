# hhsl-salary-tracker

Standalone, installable (PWA) shift-pay and tax tracker, rebuilt from the "Hhsl Annual" Google Sheet.
Data stays on each person's own device; no server or account is needed.

## What it is

A standalone, installable web app (PWA). Each person's entries, rates and settings are stored on their own
phone (IndexedDB), with no account and no server. Backup and moving to a new phone use a file
(optionally password-locked) that the person shares or downloads themselves.

- Daily entry with overtime tiers, flat daily pay, lead / holiday / weekend rules and a second job in one day
- PAYE, NIS and health surcharge per payslip, plus a year-end estimate and charts
- Effective-dated rates and tax rules: a raise applies from its start date only, and a backdated raise reprices the days it covers
- Payslip corrections (actual gross / PAYE) per month and payslip
- Dashboard home, calendar grid, and a Charts tab (year to date by site, gross vs net, PAYE vs NIS, split by payslip)
- Light, dark or system theme from the settings gear
- Roles per site (for example client medic) with their own rates, and other jobs (pickups, deliveries) logged without pay
- Start/end times with automatic paid hours (unpaid lunch comes off)
- Payroll timesheet: fills the company's .xlsx template for the month you are viewing (kept on the phone, not in this repo)
- Separate settings pages for site locations, NIS & tax (with start dates for changes), payslips and the timesheet
- Backup, restore, and a rates-only file for sharing a setup

## Development

```
npm install
npm run dev        # local dev server
npm test           # engine, backup and (if present) spreadsheet-parity tests
npm run build      # typecheck + production build into dist/
```

`tests/sheet-parity.test.ts` replays real spreadsheet data through the engine. It reads `private-fixtures/`
(gitignored, never committed) and is skipped when that folder is absent.

## Deploying to GitHub Pages

1. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions** (one time).
2. Merge to `main`. `.github/workflows/deploy.yml` tests, builds and publishes the site.
3. The app is served at `https://<user>.github.io/hhsl-salary-tracker/`.

Saved data is tied to the web address. Pick the final address before sharing the app widely. To use a custom
domain, set the repository variable `BASE_PATH` to `/`.
