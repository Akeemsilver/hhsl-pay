import { chromium } from "/tmp/claude-0/-home-user-hhsl-salary-tracker/9686a773-84c2-5a35-bb6d-72418f620b9d/scratchpad/pw/node_modules/playwright-core/index.mjs";
import fs from "fs";
const S = process.argv[2] + "/shots15"; fs.mkdirSync(S, { recursive: true });
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
await page.setViewportSize({ width: 390, height: 900 });
await page.getByRole("button", { name: "View timesheet or payslip" }).tap(); await page.waitForTimeout(500);
await snap("eye", { guide: page.getByRole("button", { name: "Guide (PDF)" }) });
await page.getByRole("button", { name: "Guide (PDF)" }).tap(); await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(3000);
await snap("viewer", { dl: page.getByRole("button", { name: "Download guide (PDF)" }), zoom: page.getByRole("button", { name: "Zoom in" }) });
fs.writeFileSync(`${S}/boxes.json`, JSON.stringify(boxes));
await b.close();
