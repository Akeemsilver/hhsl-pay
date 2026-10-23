import { chromium } from "/tmp/claude-0/-home-user-hhsl-salary-tracker/9686a773-84c2-5a35-bb6d-72418f620b9d/scratchpad/pw/node_modules/playwright-core/index.mjs";
import fs from "fs";
const S = process.argv[2] + "/shots10"; fs.mkdirSync(S, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, colorScheme: "light" });
const page = await ctx.newPage(); page.on("dialog", (d) => d.accept());
await page.addInitScript(`localStorage.setItem("hhsl-salary-tracker:theme", "light")`);
await page.clock.setFixedTime(new Date("2026-10-21T12:00:00"));
const boxes = {};
const snap = async (name, targets = {}) => {
  await page.waitForTimeout(500); boxes[name] = {};
  for (const [label, loc] of Object.entries(targets)) { const bb = await loc.first().boundingBox(); if (bb) boxes[name][label] = [bb.x * 2, bb.y * 2, bb.width * 2, bb.height * 2]; }
  await page.screenshot({ path: `${S}/${name}.png` });
};
await page.goto("http://localhost:4173/"); await page.getByLabel("Your full name").waitFor();
await page.getByLabel("Your full name").fill("Your Name"); await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(400);
await page.locator("input[aria-label='Starter kit file']").setInputFiles("/tmp/kit-test.txt"); await page.waitForTimeout(900);
// made-up fixed-rate site with a typed location, so no real rates show
await page.getByRole("button", { name: "Settings" }).click(); await page.getByRole("button", { name: /Site locations/ }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: /Add new location/ }).click(); await page.waitForTimeout(400);
await page.getByLabel("New site name").fill("Example Platform");
await page.locator(".seg-sm button", { hasText: "Type in a location" }).click();
await page.locator(".seg-sm button", { hasText: "Fixed day rate" }).click(); await page.waitForTimeout(200);
await page.locator(".page-form").getByLabel("Fixed day rate", { exact: true }).last().fill("900");
await page.locator(".page-form").getByLabel("Hourly rate after the fixed hours").fill("55");
await page.getByRole("button", { name: "Add site" }).click(); await page.waitForTimeout(500);
await page.goBack(); await page.goBack(); await page.waitForTimeout(300);
await page.getByRole("button", { name: "Calendar", exact: true }).last().click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: /^Wed 21,/ }).click(); await page.waitForTimeout(400);
await snap("day-panel", { add: page.getByRole("button", { name: /Add job/ }) });
await page.getByRole("button", { name: /Add job/ }).first().click(); await page.waitForTimeout(500);
// site picker
await page.locator(".entry button").first().click(); await page.waitForTimeout(500);
await snap("picker", { search: page.getByPlaceholder(/search/i) });
await page.getByPlaceholder(/search/i).fill("Example"); await page.waitForTimeout(300);
await page.getByRole("button", { name: /Example Platform/ }).last().click(); await page.waitForTimeout(500);
await page.getByPlaceholder("Dolphin platform").fill("Dolphin platform");
await snap("loc", { loc: page.getByPlaceholder("Dolphin platform"), lead: page.getByLabel(/Team lead/), hol: page.getByLabel(/Holiday/) });
await page.getByRole("button", { name: /Detailed/ }).click(); await page.waitForTimeout(400);
const setTime = async (label, t) => {
  await page.getByRole("button", { name: new RegExp(`^${label}`) }).click(); await page.waitForTimeout(600);
  await page.locator(".time-sheet").getByPlaceholder("1930 or 19:30").fill(t.replace(":", ""));
  await page.locator(".time-sheet").getByRole("button", { name: "Set", exact: true }).click(); await page.waitForTimeout(600);
};
await setTime("Start time", "07:00"); await setTime("End time", "19:00");
await page.locator(".entry .hours-tile").scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -120));
await snap("hours", { tile: page.locator(".entry .hours-tile"), start: page.getByRole("button", { name: /^Start time/ }), end: page.getByRole("button", { name: /^End time/ }) });
await page.locator(".entry .preview").scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 120));
await snap("pay", { pay: page.locator(".entry .preview"), another: page.getByRole("button", { name: /Add another job/ }), other: page.getByRole("button", { name: /Other job/ }), save: page.getByRole("button", { name: "Save", exact: true }) });
await page.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(700);
await page.getByRole("button", { name: /^Wed 21,/ }).click(); await page.waitForTimeout(500);
await snap("saved", { edit: page.getByRole("button", { name: /^Edit/ }), del: page.getByRole("button", { name: /^Delete/ }) });
fs.writeFileSync(`${S}/boxes.json`, JSON.stringify(boxes));
await b.close();
