#!/usr/bin/env node
/* chrome-struct.cjs — dump the toolbar's child structure for both GUIs, used
 * to explain the WO-vs-OO chrome height gap. Pure observation.
 * Env: STRUCT_URL, STRUCT_OO=1 (OO rig, waits for the /web-apps/ frame). */
const { chromium } = require('playwright');

(async () => {
  const url = process.env.STRUCT_URL;
  const isOO = process.env.STRUCT_OO === '1';
  if (!url) { console.error('chrome-struct.cjs: STRUCT_URL required'); process.exit(2); }
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let f = p;
  if (isOO) {
    for (let i = 0; i < 40 && (!f || !f.url().includes('/web-apps/')); i++) {
      f = p.frames().find((x) => x.url().includes('/web-apps/'));
      if (!f) await sleep(500);
    }
    if (!f) { console.error('chrome-struct.cjs: OO frame never appeared'); process.exit(1); }
    await f.waitForSelector('#toolbar, .asc-toolbar', { timeout: 30000 });
  } else {
    await p.waitForSelector('#toolbar', { timeout: 30000 });
  }
  await sleep(2000);
  const info = await f.evaluate(() => {
    const tb = document.querySelector('#toolbar') || document.querySelector('.asc-toolbar');
    if (!tb) return null;
    const r = tb.getBoundingClientRect();
    const kids = [...tb.children].map((c, i) => {
      const q = c.getBoundingClientRect();
      return { i, tag: c.tagName, cls: String(c.className || '').slice(0, 60),
               y: Math.round(q.top - r.top), h: Math.round(q.height) };
    });
    return { top: Math.round(r.top), h: Math.round(r.height), kids };
  });
  console.log(`${isOO ? 'OO' : 'WO'}:`, JSON.stringify(info));
  await b.close();
})().catch((e) => { console.error('chrome-struct.cjs fail:', e.message); process.exit(1); });