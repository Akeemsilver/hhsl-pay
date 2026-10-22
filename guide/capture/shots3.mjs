import { chromium } from "/tmp/claude-0/-home-user-hhsl-salary-tracker/9686a773-84c2-5a35-bb6d-72418f620b9d/scratchpad/pw/node_modules/playwright-core/index.mjs";
import fs from "fs";
const S = process.argv[2] + "/shots3"; fs.mkdirSync(S, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, colorScheme: "light", acceptDownloads: true });
const page = await ctx.newPage(); page.on("dialog", (d) => d.accept());
await page.addInitScript(() => {
  localStorage.setItem("hhsl-salary-tracker:theme", "light");
  navigator.canShare = () => true; navigator.share = async () => {};
});
await page.clock.setFixedTime(new Date("2026-10-21T12:00:00"));
const boxes = {};
const snap = async (name, targets = {}) => {
  boxes[name] = {};
  for (const [label, loc] of Object.entries(targets)) { const bb = await loc.first().boundingBox(); if (bb) boxes[name][label] = [bb.x * 2, bb.y * 2, bb.width * 2, bb.height * 2]; }
  await page.screenshot({ path: `${S}/${name}.png` });
};
await page.goto("http://localhost:4173/"); await page.getByLabel("Your full name").waitFor();
await page.getByLabel("Your full name").fill("Your Name"); await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(400);
await page.locator("input[aria-label='Starter kit file']").setInputFiles("/tmp/kit-test.txt"); await page.waitForTimeout(900);
await page.getByRole("button", { name: "Settings" }).click(); await page.waitForTimeout(600);
// share starter kit: ask + after
const sh = page.getByRole("button", { name: "Share starter kit" }); await sh.scrollIntoViewIfNeeded(); await sh.tap(); await page.waitForTimeout(500);
await snap("share-ask", { yes: page.getByRole("button", { name: "Yes, download and share" }) });
await page.getByRole("button", { name: "Yes, download and share" }).tap(); await page.waitForTimeout(800);
await sh.scrollIntoViewIfNeeded(); await page.locator("input[aria-label='App link']").evaluate((el) => { el.value = "https://akeemsilver.github.io/hhsl-pay/"; }); await page.waitForTimeout(300);
await snap("share-after", { msg: page.locator(".notice[role=status]") });
// site settings: colours + lunch
await page.evaluate(() => window.scrollTo(0, 0));
await page.getByRole("button", { name: /Site locations/ }).click(); await page.waitForTimeout(400);
await page.locator("summary", { hasText: /^HHSL Compound/ }).first().click(); await page.waitForTimeout(300);
const site = page.locator("details.site[open]");
await site.locator(".swatches").scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 120)); await page.waitForTimeout(200);
await snap("site-settings", { colours: site.locator(".swatches"), lunch: site.locator(".lunch-choice") });
await page.goBack(); await page.waitForTimeout(300);
// timesheet jobs card
await page.evaluate(() => window.scrollTo(0, 0));
await page.getByRole("button", { name: /^Timesheet/ }).first().tap(); await page.waitForTimeout(500);
const card = page.locator(".tj"); await card.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -20)); await page.waitForTimeout(200);
await snap("ts-jobs", { summary: page.locator(".tj-summary") });
await page.goBack(); await page.goBack(); await page.waitForTimeout(300);
// time picker
await page.getByRole("button", { name: "Calendar", exact: true }).last().click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: /^Wed 21,/ }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: /Add job/ }).first().click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: /Detailed/ }).click(); await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Start time/ }).click(); await page.waitForTimeout(500);
await snap("time-picker", {});
fs.writeFileSync(`${S}/boxes.json`, JSON.stringify(boxes, null, 1));
await b.close();
