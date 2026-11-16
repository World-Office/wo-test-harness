#!/usr/bin/env node
// census-react-deep.cjs — deep census of the REACT word editor (the
// deployed /word since 2026-11-16): tabs, per-tab ribbon controls,
// File menu, left-panel/statusbar buttons. Capture-only (no gating);
// output census-react-deep.json for diffing against census-oo-deep.json.
//
// Usage:
//   CENSUS_REACT_URL=https://editor.cloud.graphwiz.ai/word/ node census-react-deep.cjs
//   (local: bash run-react-rig.sh first)
// Output: CENSUS_OUT/census-react-deep.json (default: census/census/)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL_BASE = process.env.CENSUS_REACT_URL;
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fui-Tab renders the label twice ("HomeHome") — halve when duplicated.
function dedupeTabText(t) {
  t = t.trim();
  if (t.length >= 2 && t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) {
    return t.slice(0, t.length / 2);
  }
  return t;
}

(async () => {
  if (!URL_BASE) throw new Error('CENSUS_REACT_URL is required');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(9000); // wasm boot + demo load

  const tabEls = await page.$$('[role=tab]');
  const tabs = [];
  for (const el of tabEls) {
    const vis = await el.evaluate((e) => e.offsetParent !== null);
    if (vis) tabs.push(await el.evaluate((e) => (e.textContent || '').trim()));
  }
  const tabLabels = tabs.map(dedupeTabText).filter(Boolean);

  const perTab = {};
  for (const label of tabLabels) {
    if (/^(file)$/i.test(label)) continue; // file = menu, captured below
    try {
      await page.click(`[role=tab]:has-text("${label}")`, { timeout: 5000 });
    } catch { continue; }
    await sleep(700);
    perTab[label] = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, [role=menuitem], select')]
        .filter((e) => e.offsetParent !== null)
        .map((e) => ({
          label: (e.getAttribute('aria-label') || e.title || e.textContent || '').trim().slice(0, 60),
          disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
          kind: e.tagName === 'SELECT' ? 'select' : 'button',
        }))
        .filter((b) => b.label && !/^(Back|Save|Download As|Print|Protect|Info|Advanced Settings|Help|Suggest a Feature)$/i.test(b.label));
      return btns;
    });
  }

  // File menu (same probe as census-react.cjs)
  let fileMenu = [];
  try {
    await page.click('[data-tab="file"], [role=tab]:has-text("File")', { timeout: 5000 });
    await sleep(800);
    fileMenu = await page.evaluate(() =>
      [...document.querySelectorAll('.de-file-menu-panel button')]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({ label: (b.getAttribute('aria-label') || b.textContent || '').trim(), enabled: !(b.disabled === true) })));
  } catch {}

  const out = {
    engine: 'worldoffice-react',
    capturedAt: new Date().toISOString(),
    viewport: { width: 1440, height: 900 },
    tabs: tabLabels,
    ribbon: perTab,
    fileMenu,
    pageErrors: errs,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'census-react-deep.json'), JSON.stringify(out, null, 1));
  const total = Object.values(perTab).reduce((n, l) => n + l.length, 0);
  console.log(`tabs: ${tabLabels.length} | ribbon controls: ${total} | fileMenu: ${fileMenu.length} | pageErrors: ${errs.length}`);
  for (const [t, l] of Object.entries(perTab)) console.log(`  ${t}: ${l.length}`);
  await browser.close();
})();
