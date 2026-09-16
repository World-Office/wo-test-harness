#!/usr/bin/env node
// census-react.cjs — census of the REACT editor (what production ships via
// the Rust wo-docserver at /editors/{word|sheet|slide|pdf|diagram}/), the
// surface the vanilla census-wo.cjs cannot see.
//
// The React editor is a different app than the vanilla web/editor.js the
// Python docserver serves: FileTab ([data-tab="file"]) toggles a full-screen
// FileMenu inside .de-file-menu-panel, driven by mobx store state. A plain
// React component reading the store without `observer` re-renders nothing
// (the de-file-menu-panel stayed display:none forever — the "WO File menu
// does nothing" bug), so this census ASSERTS the panel opens and exits 1 if
// it does not.
//
// Usage (point at an already-running React editor page; e.g. served by
// run-react-census.py from a built dist):
//     CENSUS_REACT_URL=http://127.0.0.1:PORT/word/ node census-react.cjs
// Output: CENSUS_OUT/census-react.json (default: census/ next to this file).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL_BASE = process.env.CENSUS_REACT_URL;
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!URL_BASE) throw new Error('CENSUS_REACT_URL is required');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.error('pageerror:', String(e.message).slice(0, 160)));
  await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1200);

  const fileTab = await page.waitForSelector('[data-tab="file"]', { timeout: 20000 })
    .then(() => true).catch(() => false);

  const before = await page.evaluate(() => {
    const p = document.querySelector('.de-file-menu-panel');
    return p ? getComputedStyle(p).display : 'absent';
  });
  if (fileTab) {
    await page.click('[data-tab="file"]');
    await sleep(600);
  }
  const after = await page.evaluate(() => {
    const p = document.querySelector('.de-file-menu-panel');
    return p ? getComputedStyle(p).display : 'absent';
  });
  const menu = await page.evaluate(() => ({
    panel: !!document.querySelector('.de-file-menu-panel'),
    buttons: [...document.querySelectorAll('.de-file-menu-panel button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({
        id: b.id || null,
        label: (b.getAttribute('aria-label') || b.textContent || '').trim() || null,
        enabled: !b.disabled,
      })),
  }));

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/census-react.json`, JSON.stringify({
    engine: 'worldoffice-react',
    capturedAt: new Date().toISOString(),
    viewport: { width: 1440, height: 900 },
    fileTab,
    panelDisplay: { before, after },
    menu: { buttons: menu.buttons },
  }, null, 1));

  const opened = fileTab && before !== after && after === 'block';
  console.log(`census-react: fileTab=${fileTab} panel ${before}->${after} rows=${menu.buttons.length}`);
  for (const b of menu.buttons) console.log('  -', b.label, b.enabled ? '' : '(disabled)');
  await browser.close();

  if (!fileTab) { console.error('FAIL: File tab never rendered'); process.exit(1); }
  if (!opened) {
    console.error('FAIL: File menu panel did not open (store flipped but the panel never');
    console.error('      re-rendered — missing mobx observer on the component reading');
    console.error('      isFileMenuOpen). This is the documented WO File-menu bug.');
    process.exit(1);
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
