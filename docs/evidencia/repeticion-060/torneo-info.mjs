import { chromium } from "/home/calusaca/cronista/node_modules/@playwright/test/index.mjs";
const [base, id, n, lang] = process.argv.slice(2);
const nav = await chromium.launch(); const page = await nav.newPage();
await page.goto(`${base}/arena?torneo=${id}&encuentro=${n}${lang === "es" ? "&lang=es" : ""}`);
try { await page.getByTestId("arena-torneo-origen").waitFor({ timeout: 30000 }); } catch (e) { console.log("sin origen", await page.locator("[role=alert]").allTextContents()); }
console.log(JSON.stringify({ origen: await page.getByTestId("arena-torneo-origen").allTextContents(), asign: await page.getByTestId("arena-live-assignment").allTextContents(), ctl: await page.locator(".arena-controller").allTextContents(), reloj: await page.getByTestId("arena-clock").textContent(), voz: await page.getByTestId("arena-play-voice").count() }));
await nav.close();
