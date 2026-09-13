#!/usr/bin/env node
/* geom-wo.cjs — geometry census: capture per-tab control rects + statusbar.
 * Pure observation (no clicks): for every ribbon tab, record the bounding
 * rect of every visible top-level control, grouped into rows by y; plus the
 * statusbar controls. The gate (geom-diff.py) checks drift against the
 * committed golden and structural invariants (overlaps, row alignment).
 * Env contract: CENSUS_WO_URL + CENSUS_OUT (same as census-wo.cjs / fx-wo.cjs). */
const fs = require('fs');
const path = require('path');
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');

(async () => {
  const { chromium } = require('playwright');
  const url = process.env.CENSUS_WO_URL;
  if (!url) { console.error('geom-wo: CENSUS_WO_URL required (spawn via reconcile.py)'); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#toolbar');
  await page.waitForTimeout(2500); // i18n + font settle

  const snapshotTab = () => page.evaluate(() => {
    const pg = document.querySelector('.ribbon-page.active');
    if (!pg) return null;
    const tabEl = [...document.querySelectorAll('.ribbon-tab')].find(t => t.classList.contains('active'));
    const all = [...pg.querySelectorAll('button, select')];
    return all.map((el, i) => {
      const top = !el.closest('.menu-list, .rb-menu, .insert-pop, [role="dialog"], .dropdown, .color-palette');
      const r = el.getBoundingClientRect();
      return {
        key: el.id || el.dataset.cmd || (el.textContent || '').trim().slice(0, 24),
        label: (el.getAttribute('title') || el.getAttribute('aria-label') || (el.textContent || '').trim()).slice(0, 32),
        top, i,
        rect: [Math.round(r.x * 2) / 2, Math.round(r.y * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2],
      };
    }).filter(m => m.top && m.rect[2] > 0 && m.rect[3] > 0)
      // unique keys: duplicate data-cmds (insertObject ×4) get a stable
      // DOM-order suffix so the golden join can't collide
      .map(m => {
        const same = all.filter(x => (x.id || x.dataset.cmd || (x.textContent || '').trim().slice(0, 24)) === m.key);
        return same.length > 1 ? { ...m, key: m.key + '#' + same.indexOf(all[m.i]) } : m;
      });
  });

  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('.ribbon-tab')].map(t => (t.textContent || '').trim()).filter(Boolean));
  const out = { engine: 'world-office', capturedAt: new Date().toISOString(), viewport: { width: 1440, height: 900 }, tabs: {}, statusbar: [] };
  for (const tab of tabs) {
    await page.evaluate(t => {
      const el = [...document.querySelectorAll('.ribbon-tab')].find(x => (x.textContent || '').trim() === t);
      if (el) { if (el.hidden) el.hidden = false; el.click(); }
    }, tab);
    await page.waitForTimeout(250);
    out.tabs[tab] = await snapshotTab();
  }
  // statusbar: every visible control-ish element (buttons, selects, sb spans with --sb-x)
  out.statusbar = await page.evaluate(() => {
    const sb = document.querySelector('.statusbar');
    if (!sb) return [];
    const cand = [...sb.querySelectorAll('button, select, span, input')]
      .filter(el => !el.getAttribute('aria-hidden'))
      .map(el => {
        const r = el.getBoundingClientRect();
        const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.split(' ').filter(Boolean).join('.') : '';
        return {
          key: el.id || (cls || el.tagName.toLowerCase()),
          rect: [Math.round(r.x * 2) / 2, Math.round(r.y * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2],
        };
      })
      .filter(m => m.rect[2] > 0 && m.rect[3] > 0);
    // leaf controls only: drop any element whose rect contains another
    // captured element — wrapper spans (.sb, doc-lang-label-right) own the
    // space, the leaves are the interactive truth
    return cand.filter(a => !cand.some(b => b !== a &&
      b.rect[0] >= a.rect[0] - 1 && b.rect[1] >= a.rect[1] - 1 &&
      b.rect[0] + b.rect[2] <= a.rect[0] + a.rect[2] + 1 &&
      b.rect[1] + b.rect[3] <= a.rect[1] + a.rect[3] + 1));
  });
  await browser.close();

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'geom-wo.json'), JSON.stringify(out, null, 1) + '\n');
  const n = Object.values(out.tabs).reduce((a, b) => a + b.length, 0) + out.statusbar.length;
  console.log(`geom-wo: ${Object.keys(out.tabs).length} tabs, ${n} controls captured`);
})().catch(e => { console.error('geom-wo FATAL', e.message); process.exit(1); });
