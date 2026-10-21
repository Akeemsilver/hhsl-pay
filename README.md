# hhsl-salary-tracker

Standalone, installable (PWA) shift-pay and tax tracker, rebuilt from the "Hhsl Annual" Google Sheet.
Data stays on each person's own device; no server or account is needed.

## Status

- [x] Calculation engine (`src/engine`): day pay with overtime tiers, flat daily pay, lead/holiday/weekend rules,
      PAYE / NIS / health surcharge per payer, year-end estimate
- [x] Effective-dated rates and tax rules, so a raise never changes earlier days and a backdated raise reprices the days it covers
- [ ] On-device storage, import/export
- [ ] Screens: daily entry, month view, annual summary and charts, rates and tax settings
- [ ] One-time import of the existing 2026 data

## Development

```
npm install
npm test
npm run typecheck
```

`tests/sheet-parity.test.ts` replays real spreadsheet data through the engine. It reads `private-fixtures/`
(gitignored, never committed) and is skipped when that folder is absent.
