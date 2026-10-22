# Re-taking the guide pictures

The PDF itself is built by `guide/build_guide.py` (rebuilt automatically on every deploy).
These scripts only make the **pictures** in `guide/assets/`. Run them when a screen the guide
shows has changed.

1. `npm run build` (with `BASE_PATH=/`) and `npx vite preview --port 4173`.
2. Install `playwright-core` somewhere and point the `import` at the top of `shots2.mjs`,
   `shots3.mjs` and `shots4.mjs` to it. They drive headless Chromium at phone size (390 x 800, 2x).
   They need a starter kit file at `/tmp/kit-test.txt` (download one from Settings, Share this app).
3. Run each script with an output folder, then `annot.py`, `annot3.py` and `annot4.py` draw the
   red rings and labels. Copy the finished `a-*`, `b-*` and `c-*` images into `guide/assets/shots/`.
4. `ill.py` redraws the picture mock-ups (Chrome and Safari menus, Google Sheets menus, WhatsApp)
   into `guide/assets/ill/`.
5. Use made-up data only (for example "Example Site"). Never show real rates or pay.
