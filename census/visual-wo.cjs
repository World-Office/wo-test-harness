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
  const zoom = process.env.VISUAL_ZOOM; // e.g. 2.25: scale the 8px base text up to LO/Word 12pt-ish
  const font = process.env.VISUAL_FONT; // e.g. 'Liberation Serif': match LO's serif engine metric
  if (!base || !doc || !out) {
    console.error('visual-wo.cjs: VISUAL_BASE, VISUAL_DOC, VISUAL_OUT required');
    process.exit(2);
  }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1,
  });
  if (zoom) {
    // the editor reads wo-zoom from localStorage at init; seed it before the
    // page loads so pagination and the sheet render at the given scale
    await ctx.addInitScript((z) => localStorage.setItem('wo-zoom', z), zoom);
  }
  const page = await ctx.newPage();
  await page.goto(`${base}/editor/${encodeURIComponent(doc)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#editor', { timeout: 30000 });
  if (font) {
    // the editor body currently uses a system-ui sans stack; a Word/LO doc
    // is serif. Force serif BEFORE the async html fetch drives pagination,
    // so sheet metrics are measured on the same face the golden uses.
    await page.addStyleTag({ content: `#editor, #editor .wo-page { font-family: ${font} !important; }` });
  }
  // wait until the converted flow is actually populated (table row cell or text)
  await page.waitForFunction(
    () => document.querySelector('#editor') && document.querySelector('#editor').textContent.trim().length > 40,
    { timeout: 30000 },
  );
  await page.waitForTimeout(2000); // fonts settle
  await page.evaluate(() => window.scrollTo(0, 0));
  // the editor paginates (#editor is now a page stack); capture the first
  // sheet itself so the grey backdrop never pollutes ink/diff measurements.
  // NB: a comma selector list would match #editor first (parent precedes its
  // child in document order), so try the sheet explicitly, then fall back.
  let el = await page.$('#editor > .wo-page');
  if (!el) el = await page.$('#editor');
  await el.screenshot({ path: out });
  await browser.close();
  console.log(`visual-wo: captured ${out} (${fs.statSync(out).size} bytes)`);
  process.exit(0);
})().catch((e) => { console.error('visual-wo FAILED:', e.message); process.exit(1); });
