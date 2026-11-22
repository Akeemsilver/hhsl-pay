// Pictures for: Check against your payslip, Hide money, the payroll pop-up, + Add and the colour picker, the backup line.
// Needs the preview server (BASE_PATH=/ build) and a made-up backup file, path in argv[3] (Example Site A/B/C, no real data).
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("/opt/node-tools/node_modules/playwright");
import fs from "fs";
const S = process.argv[2] + "/shots17"; fs.mkdirSync(S, { recursive: true });
const BACKUP = process.argv[3];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const boxes = {};
async function session(date, fn) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, colorScheme: "light" });
  const page = await ctx.newPage(); page.on("dialog", (d) => d.accept());
  await page.addInitScript(`localStorage.setItem("hhsl-salary-tracker:theme", "light")`);
  await page.clock.setFixedTime(new Date(`${date}T12:00:00`));
  await page.goto("http://localhost:4173/"); await page.getByLabel("Your full name").waitFor();
  await page.getByRole("button", { name: "Restore a backup instead" }).click();
  await page.locator("input[type=file]").first().setInputFiles(BACKUP); await page.waitForTimeout(700); await page.goBack(); await page.waitForTimeout(900);
  const snap = async (name, targets = {}) => {
    await page.waitForTimeout(500); boxes[name] = {};
    for (const [label, loc] of Object.entries(targets)) { const bb = await loc.first().boundingBox(); if (bb) boxes[name][label] = [bb.x * 2, bb.y * 2, bb.width * 2, bb.height * 2]; }
    await page.screenshot({ path: `${S}/${name}.png` });
  };
  await fn(page, snap); await ctx.close();
}
await session("2026-10-21", async (page, snap) => {
  // Hide money: the small eye beside the gross amount
  await page.getByRole("button", { name: "Hide money" }).first().tap(); await page.waitForTimeout(600);
  await snap("hide", { eye: page.locator(".hero-eye"), hero: page.locator(".hero") });
  await page.getByRole("button", { name: "Show money" }).first().tap(); await page.waitForTimeout(400);
  // Backup line at the bottom of Home
  await page.evaluate(() => { const el = document.querySelector(".backup-line"); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 330); }); await page.waitForTimeout(400);
  await snap("backup", { btn: page.locator(".backup-line button"), line: page.locator(".backup-line") });
  // Pay calculator at the bottom of Home
  const calc = page.locator(".pay-calc"); await calc.scrollIntoViewIfNeeded();
  await calc.getByRole("button", { name: "4 weeks" }).tap();
  const cnet = calc.getByLabel("Net (what the bank pays)"); await cnet.fill("10000"); await page.waitForTimeout(400);
  await page.evaluate(() => { const el = document.querySelector(".pay-calc"); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70); }); await page.waitForTimeout(300);
  await snap("calc", { net: cnet, card: calc, weeks: calc.locator(".segmented") });
  // Check against your payslip: at the bottom of the Month tab
  await page.getByLabel("Main").getByRole("button", { name: "Month" }).tap(); await page.waitForTimeout(600);
  const card = page.locator(".payslip-check").first(); await card.scrollIntoViewIfNeeded();
  // The card is open by default: nothing to tap.
  const net = card.getByLabel("Actual net (what the bank paid)").first();
  await net.fill(String(Math.round((Number(await net.getAttribute("placeholder")) - 120) * 100) / 100)); await page.waitForTimeout(400);
  await card.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -20));
  await snap("check", { net: net, card: card.locator("fieldset").first() });
  // + Add, then the colour picker
  await page.getByLabel("Settings", { exact: true }).tap(); await page.getByRole("button", { name: /^Site locations/ }).tap(); await page.waitForTimeout(500);
  await snap("add", { add: page.getByRole("button", { name: "＋ Add", exact: true }) });
  await page.getByRole("button", { name: "＋ Add", exact: true }).tap(); await page.waitForTimeout(500);
  await snap("color", { sw: page.locator(".swatches"), note: page.locator(".swatches + p") });
});
await session("2026-10-31", async (page, snap) => {
  await page.waitForTimeout(500);
  await snap("pay", { dlg: page.getByRole("alertdialog"), ok: page.getByRole("button", { name: "OK, send it now" }) });
});
fs.writeFileSync(`${S}/boxes.json`, JSON.stringify(boxes));
await b.close();
