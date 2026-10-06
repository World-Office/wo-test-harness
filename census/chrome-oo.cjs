#!/usr/bin/env node
/* chrome-oo.cjs — screenshot the OnlyOffice ribbon chrome for the chrome pixel gate.
 * Requires the OO rig (census/rig/rig-server.py + DS). Pure observation.
 * Env: CHROME_OO_URL (default rig-editor.html), CHROME_OO_OUT (png path). */
const fs = require('fs');
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const url = process.env.CHROME_OO_URL || 'http://127.0.0.1:8735/rig-editor.html';
  const out = process.env.CHROME_OO_OUT;
  if (!out) { console.error('chrome-oo.cjs: CHROME_OO_OUT required'); process.exit(2); }
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
  let f = null;
  for (let i = 0; i < 40 && !f; i++) { f = p.frames().find((x) => x.url().includes('/web-apps/')); if (!f) await sleep(500); }
  if (!f) { console.error('chrome-oo.cjs: OO editor frame never appeared'); process.exit(1); }
  await f.waitForSelector('#toolbar, .asc-toolbar', { timeout: 30000 });
  await sleep(2500);
  const el = (await f.$('#toolbar')) || (await f.$('.asc-toolbar'));
  if (!el) { console.error('chrome-oo.cjs: toolbar not found'); process.exit(1); }
  const box = await el.boundingBox();
  await el.screenshot({ path: out });
  fs.writeFileSync(out.replace(/\.png$/, '.box.json'), JSON.stringify(box));
  console.log(`chrome-oo: ${out} box=${JSON.stringify(box)}`);
  await b.close();
})().catch((e) => { console.error('chrome-oo.cjs fail:', e.message); process.exit(1); });
