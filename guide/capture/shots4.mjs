import { chromium } from "/tmp/claude-0/-home-user-hhsl-salary-tracker/9686a773-84c2-5a35-bb6d-72418f620b9d/scratchpad/pw/node_modules/playwright-core/index.mjs";
import fs from "fs";
const S = process.argv[2] + "/shots4"; fs.mkdirSync(S, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, colorScheme: "light" });
const page = await ctx.newPage(); page.on("dialog", (d) => d.accept());
await page.addInitScript(`localStorage.setItem("hhsl-salary-tracker:theme", "light")`);
await page.clock.setFixedTime(new Date("2026-10-21T12:00:00"));
const boxes = {};
const snap = async (name, targets = {}) => {
  await page.waitForTimeout(600);
  boxes[name] = {};
  for (const [label, loc] of Object.entries(targets)) { const bb = await loc.first().boundingBox(); if (bb) boxes[name][label] = [bb.x * 2, bb.y * 2, bb.width * 2, bb.height * 2]; }
  await page.screenshot({ path: `${S}/${name}.png` });
};
await page.goto("http://localhost:4173/"); await page.getByLabel("Your full name").waitFor();
await page.getByLabel("Your full name").fill("Your Name"); await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(400);
await page.locator("input[aria-label='Starter kit file']").setInputFiles("/tmp/kit-test.txt"); await page.waitForTimeout(900);
await page.getByRole("button", { name: "Settings" }).click(); await page.waitForTimeout(600);
const sl = page.getByRole("button", { name: /Site locations/ }); await sl.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await snap("hub", { sites: sl, tax: page.getByRole("button", { name: /NIS & tax/ }), hol: page.getByRole("button", { name: /Public holidays/ }) });
await sl.click(); await page.waitForTimeout(500);
// add a site (made-up example)
const form = page.locator(".add-site"); await form.scrollIntoViewIfNeeded();
await page.getByLabel("Group for the new site").selectOption("__new"); await page.waitForTimeout(200);
await page.getByLabel("New site name").fill("Example Site");
await page.getByLabel("New group name").fill("Example group");
await page.getByLabel("New group standard rate").fill("50"); await page.waitForTimeout(200);
await form.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -60)); await page.waitForTimeout(200);
await snap("add-site", { name: page.getByLabel("New site name"), group: page.getByLabel("Group for the new site"), rate: page.getByLabel("New group standard rate"), add: page.getByRole("button", { name: "Add site" }) });
await page.getByRole("button", { name: "Add site" }).click(); await page.waitForTimeout(500);
// open it and change the rate
await page.locator("summary", { hasText: /^Example Site/ }).first().click(); await page.waitForTimeout(300);
const site = page.locator("details.site[open]");
const stdBox = site.getByLabel("Hourly rate", { exact: true }).first();
await stdBox.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
await snap("rate", { std: stdBox, lead: site.getByLabel("Lead rate", { exact: true }).first() });
await stdBox.fill("52"); await page.waitForTimeout(400);
const eff = site.getByLabel("Example Site take effect from"); await eff.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await snap("effect", { from: eff, save: site.getByRole("button", { name: "Save", exact: true }) });
await site.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(500);
const role = page.getByLabel("New role for Example Site"); await role.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
await snap("roles", { input: role, add: page.getByRole("button", { name: "Add role" }) });
const tpl = page.getByLabel("Example Site hours template"); await tpl.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
await snap("hours", { tpl });
fs.writeFileSync(`${S}/boxes.json`, JSON.stringify(boxes, null, 1));
await b.close();
