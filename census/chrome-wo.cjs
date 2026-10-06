#!/usr/bin/env node
/* chrome-wo.cjs — screenshot the WO ribbon chrome (`#toolbar`) for the chrome
 * pixel gate. Pure observation, no clicks.
 * Env: CENSUS_WO_URL (WO editor URL, same contract as geom-wo.cjs),
 *      CHROME_WO_OUT (png path to write). */
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const url = process.env.CENSUS_WO_URL;
  const out = process.env.CHROME_WO_OUT;
  if (!url || !out) {
    console.error('chrome-wo.cjs: CENSUS_WO_URL and CHROME_WO_OUT required');
    process.exit(2);
  }
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#toolbar', { timeout: 30000 });
  await p.waitForTimeout(2500); // fonts/icons settle
  const el = await p.$('#toolbar');
  if (!el) { console.error('chrome-wo.cjs: #toolbar not found'); process.exit(1); }
  const box = await el.boundingBox();
  await el.screenshot({ path: out });
  fs.writeFileSync(out.replace(/\.png$/, '.box.json'), JSON.stringify(box));
  console.log(`chrome-wo: ${out} box=${JSON.stringify(box)}`);
  await b.close();
})().catch((e) => { console.error('chrome-wo.cjs fail:', e.message); process.exit(1); });
