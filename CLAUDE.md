# HHSL pay app: notes for whoever changes this code

## Keep the mobile guide up to date (required)

The app ships a step-by-step PDF, the **Mobile guide**, that people send to colleagues
(Settings, Share this app, Share guide (PDF)). It is built from `guide/build_guide.py` and is
**rebuilt on every deploy** (see `.github/workflows/deploy.yml`), so the live guide always matches
the deployed app and has its real web address and the deploy date.

Rebuilding does not write new text for you. So **every change to what a user sees or does must
update the guide in the same change**:

- New or changed feature, screen, button or setting: edit the steps in `guide/build_guide.py`
  (use the exact button and menu names from the app).
- New Settings menu item: add it to the "How to" part. `tests/guide.test.ts` fails if a Settings
  menu title or a main tab is missing from the guide.
- Changed look of a screen the guide shows: re-take its screenshots (see `guide/capture/README.md`)
  and replace the images in `guide/assets/shots/`.
- Never put real pay rates, names or money figures in the guide. Use the made-up "Example Site" data.
- Preview locally: `npm run guide` (needs `pip install reportlab pillow`).
