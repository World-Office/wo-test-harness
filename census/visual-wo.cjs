#!/usr/bin/env node
/* visual-wo.cjs — capture the WO editor's render of a committed docx, for the
 * pixel gate (pixel-diff.py). Pure observation: load /editor/{doc}, wait for
 * the rendered flow (#editor), settle fonts, top of flow, screenshot #editor.
 * Env contract (same style as the other census scripts):
 *   VISUAL_BASE  - e.g. http://127.0.0.1:8891
 *   VISUAL_DOC   - doc id, e.g. visual-gate.docx
 *   VISUAL_OUT   - png path to write */
const fs = require('fs');
const path = require('path');

(async () => {
  const { chromium } = require('playwright');
  const base = process.env.VISUAL_BASE;
  const doc = process.env.VISUAL_DOC;
  const out = process.env.VISUAL_OUT;
  if (!base || !doc || !out) {
    console.error('visual-wo.cjs: VISUAL_BASE, VISUAL_DOC, VISUAL_OUT required');
    process.exit(2);
  }
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({
    viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1,
  })).newPage();
  await page.goto(`${base}/editor/${encodeURIComponent(doc)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#editor', { timeout: 30000 });
  // wait until the converted flow is actually populated (table row cell or text)
  await page.waitForFunction(
    () => document.querySelector('#editor') && document.querySelector('#editor').textContent.trim().length > 40,
    { timeout: 30000 },
  );
  await page.waitForTimeout(2000); // fonts settle
  await page.evaluate(() => window.scrollTo(0, 0));
  const el = await page.$('#editor');
  await el.screenshot({ path: out });
  await browser.close();
  console.log(`visual-wo: captured ${out} (${fs.statSync(out).size} bytes)`);
  process.exit(0);
})().catch((e) => { console.error('visual-wo FAILED:', e.message); process.exit(1); });
