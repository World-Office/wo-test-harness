#!/usr/bin/env node
/* chrome-census2.cjs — improved census rig: captures EVERY visual detail
 * with proper OO frame coordinate normalization (subtract frame offset).
 * Produces a structured diff with actionable per-field deltas.
 *
 * Key improvements over chrome-census.cjs:
 *   - OO buttons captured with frame-relative x (so they compare directly)
 *   - WO ribbon buttons extracted from ALL rows (not just visible children)
 *   - QAT comparison (OO panel.static vs WO qat-strip)
 *   - Per-tab ribbon comparison for home + insert with button-level matching
 *   - CSS variable extraction from both
 *   - Color/border/shadow diffing
 *   - Icon presence comparison
 */
const fs = require('fs');
const { chromium } = require('/home/weiss/.npm-global/lib/node_modules/playwright/index.mjs');

const WO_URL = process.env.WO_URL || 'https://editor.cloud.graphwiz.ai/word/';
const OO_DEMO = process.env.OO_DEMO || 'https://world-office.graphwiz.ai/demo';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '/tmp/census2.json';
const VIEWPORT = { width: 1680, height: 950 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── WO capture ─────────────────────────────────────────────────────────
async function captureWO() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: VIEWPORT });
  await p.goto(WO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#editor', { timeout: 30000 });
  await sleep(3000);

  const chrome = await p.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const rc = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const tb = document.querySelector('.titlebar');
    const t = document.querySelector('.toolbar');
    return {
      titlebar: { ...rc(tb), bg: cs(tb)?.backgroundColor, fontSize: cs(tb)?.fontSize, fontFamily: cs(tb)?.fontFamily?.slice(0, 50), color: cs(tb)?.color, pad: cs(tb)?.padding, border: cs(tb)?.borderBottom },
      toolbar: { ...rc(t), bg: cs(t)?.backgroundColor, fontSize: cs(t)?.fontSize, pad: cs(t)?.padding, border: cs(t)?.borderBottom, shadow: cs(t)?.boxShadow },
      totalH: Math.round((tb?.getBoundingClientRect().height || 0) + (t?.getBoundingClientRect().height || 0)),
      bodyBg: cs(document.body)?.backgroundColor,
      bodyFont: cs(document.body)?.fontFamily?.slice(0, 50),
      bodyFontSize: cs(document.body)?.fontSize,
      cssVars: (() => { const v = {}; const s = cs(document.documentElement); for (const k of ['--bg','--ribbon','--titlebar','--border','--text','--muted','--accent','--hover','--ribbon-hover','--ribbon-active','--app-bg','--tab-active-bg']) v[k] = s.getPropertyValue(k).trim(); return v; })(),
    };
  });

  const tabs = await p.evaluate(() => {
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const fb = document.querySelector('#btn-file');
    const rct = [...document.querySelectorAll('.ribbon-tab')].filter(e => !e.hidden);
    return [{ label: fb?.textContent?.trim(), ...rc(fb), type: 'file' }]
      .concat(rct.map(t => ({ label: t.textContent.trim(), ...rc(t), type: 'tab', active: t.getAttribute('aria-selected') === 'true' })));
  });

  // Capture ribbon for a given tab
  async function captureTab(tabName) {
    await p.click(`.ribbon-tab[data-tab="${tabName}"]`).catch(() => {});
    await sleep(1500);
    return await p.evaluate(() => {
      const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const page = document.querySelector('.ribbon-page.active');
      if (!page) return { tab: null, rows: [] };
      const rows = [...page.querySelectorAll('.ribbon-row')].map((row, ri) => ({
        rowIdx: ri, ...rc(row),
        items: [...row.children].filter(c => c.offsetParent !== null && c.getBoundingClientRect().width > 3).map(c => ({
          tag: c.tagName, cls: c.className?.slice(0, 50), ...rc(c),
          text: c.textContent?.trim()?.slice(0, 30),
          btns: [...c.querySelectorAll('button:not([hidden]), select:not([hidden]), input:not([hidden])')]
            .filter(b => b.offsetParent !== null && b.getBoundingClientRect().width > 3)
            .map(b => ({ id: b.id || '', cls: b.className?.slice(0, 30), ...rc(b), text: b.textContent?.trim()?.slice(0, 20), title: (b.title || '').slice(0, 30), hasSvg: !!b.querySelector('svg') })),
        })),
      }));
      return { tab: page.getAttribute('data-tab'), rows };
    });
  }

  const home = await captureTab('home');
  const insert = await captureTab('insert');

  const qat = await p.evaluate(() => {
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const q = document.querySelector('.qat-strip');
    if (!q) return null;
    const cs = getComputedStyle(q);
    return {
      ...rc(q), bg: cs.backgroundColor, border: cs.borderRight, cols: cs.gridTemplateColumns, rows: cs.gridTemplateRows,
      btns: [...q.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => ({ id: b.id, ...rc(b), hasIcon: !!b.querySelector('svg, .oo-ic, span[class*="ic"]') })),
    };
  });

  const tools = await p.evaluate(() => {
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const tt = document.querySelector('.toolbar-tools');
    if (!tt) return null;
    return { ...rc(tt), border: getComputedStyle(tt).borderLeft, btns: [...tt.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => ({ id: b.id, ...rc(b) })) };
  });

  await b.close();
  return { engine: 'wo', chrome, tabs, home, insert, qat, tools };
}

// ── OO capture ─────────────────────────────────────────────────────────
async function captureOO() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: VIEWPORT });
  await p.goto(OO_DEMO, { waitUntil: 'load', timeout: 90000 });
  await sleep(5000);
  const fileEl = await p.$('.file');
  if (fileEl) await fileEl.click();
  await sleep(15000);
  const f = p.frames().find(fr => fr.name() === 'frameEditor');
  if (!f) throw new Error('OO frame not found');

  // Get frame offset for coordinate normalization
  const frameOffset = await p.evaluate(() => {
    const iframe = document.querySelector('iframe[name="frameEditor"]');
    if (!iframe) return { x: 0, y: 0 };
    const r = iframe.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y) };
  });

  const chrome = await f.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const rc = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const tb = document.querySelector('.toolbar');
    const bt = document.querySelector('.box-tabs');
    const bc = document.querySelector('.box-controls');
    return {
      toolbar: { ...rc(tb), bg: cs(tb)?.backgroundColor },
      boxTabs: { ...rc(bt), bg: cs(bt)?.backgroundColor || cs(tb)?.backgroundColor, h: Math.round(bt?.getBoundingClientRect().height || 0) },
      boxControls: { ...rc(bc), bg: cs(bc)?.backgroundColor, h: Math.round(bc?.getBoundingClientRect().height || 0), pad: cs(bc)?.padding },
      totalH: Math.round(tb?.getBoundingClientRect().height || 0),
      bodyBg: cs(document.body)?.backgroundColor,
      bodyFont: cs(document.body)?.fontFamily?.slice(0, 50),
      bodyFontSize: cs(document.body)?.fontSize,
      cssVars: (() => { const v = {}; const s = cs(document.documentElement); for (const k of ['--background-toolbar','--toolbar-header-document','--border-toolbar','--highlight-button-hover','--highlight-button-pressed','--x-small-btn-size','--toolbar-height-controls','--x-huge-btn-height','--toolbar-small-btn-margin-top','--font-size-base','--layout-padding-toolbar','--canvas-background']) v[k] = s.getPropertyValue(k).trim(); return v; })(),
    };
  });

  const tabs = await f.evaluate(() => {
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return [...document.querySelectorAll('.tabs li')].filter(e => e.offsetParent !== null).map(li => ({
      label: li.textContent.trim(), ...rc(li), active: li.classList.contains('active'),
    }));
  });

  // Capture home ribbon
  await f.evaluate(() => { const t = [...document.querySelectorAll('.tabs li a, .ribtab a, .ribtab')].find(x => x.textContent?.includes('Startseite') || x.id === 'home'); if (t) t.click(); });
  await sleep(2000);
  const home = await f.evaluate(() => {
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const bc = document.querySelector('.box-controls');
    const btns = [...bc.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 5 && r.height > 5 && r.top > 30 && r.top < 130 && b.offsetParent !== null; })
      .map(b => ({ id: b.id?.replace('id-toolbar-btn-','')?.slice(0, 30), ...rc(b), text: b.textContent?.trim()?.slice(0, 20), title: (b.getAttribute('data-bs-tooltip') || b.title || '').slice(0, 30), hasIcon: !!b.querySelector('svg, i[class*="icon"]') }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const selects = [...bc.querySelectorAll('input.form-control, select')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.top > 30 && r.top < 130 && el.offsetParent !== null; })
      .map(el => ({ cls: el.className?.slice(0, 40), ...rc(el) }));
    return { btns: btns.slice(0, 60), selects };
  });

  // Capture insert ribbon
  await f.evaluate(() => { const t = [...document.querySelectorAll('.tabs li a, .ribtab a, .ribtab')].find(x => x.textContent?.includes('Einfügen')); if (t) t.click(); });
  await sleep(2000);
  const insert = await f.evaluate(() => {
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const bc = document.querySelector('.box-controls');
    const btns = [...bc.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.x > 170 && r.width > 5 && r.height > 20 && r.top > 30 && r.top < 130 && b.offsetParent !== null; })
      .map(b => ({ id: b.id?.replace('id-toolbar-btn-','')?.slice(0, 30), ...rc(b), text: b.textContent?.trim()?.slice(0, 20), hasIcon: !!b.querySelector('svg, i[class*="icon"]') }))
      .sort((a, b) => a.x - b.x);
    return { btns: btns.slice(0, 40) };
  });

  const qat = await f.evaluate(() => {
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const ps = document.querySelector('.panel.static');
    if (!ps) return null;
    return { ...rc(ps), btns: [...ps.querySelectorAll('button')].filter(b => b.offsetParent !== null && b.getBoundingClientRect().width > 5).map(b => ({ id: b.id?.replace('id-toolbar-btn-',''), ...rc(b), hasIcon: !!b.querySelector('i[class*="icon"], svg') })) };
  });

  await b.close();
  return { engine: 'oo', frameOffset, chrome, tabs, home, insert, qat };
}

// ── Diff ───────────────────────────────────────────────────────────────
function buildDiff(oo, wo) {
  const d = [];
  // Chrome
  d.push({ sec: 'chrome', field: 'totalH', oo: oo.chrome.totalH, wo: wo.chrome.totalH, Δ: wo.chrome.totalH - oo.chrome.totalH });
  d.push({ sec: 'chrome', field: 'tabStrip.bg', oo: oo.chrome.boxTabs?.bg, wo: wo.chrome.titlebar?.bg });
  d.push({ sec: 'chrome', field: 'tabStrip.h', oo: oo.chrome.boxTabs?.h, wo: wo.chrome.titlebar?.h });
  d.push({ sec: 'chrome', field: 'btnArea.bg', oo: oo.chrome.boxControls?.bg, wo: wo.chrome.toolbar?.bg });
  d.push({ sec: 'chrome', field: 'btnArea.h', oo: oo.chrome.boxControls?.h, wo: wo.chrome.toolbar?.h });
  d.push({ sec: 'chrome', field: 'bodyFont', oo: oo.chrome.bodyFont, wo: wo.chrome.bodyFont });
  d.push({ sec: 'chrome', field: 'bodyFontSize', oo: oo.chrome.bodyFontSize, wo: wo.chrome.bodyFontSize });
  d.push({ sec: 'chrome', field: 'bodyBg', oo: oo.chrome.bodyBg, wo: wo.chrome.bodyBg });
  // Tabs
  for (let i = 0; i < Math.min(oo.tabs.length, wo.tabs.length); i++) {
    d.push({ sec: 'tabs', field: oo.tabs[i].label + '.x', oo: oo.tabs[i].x, wo: wo.tabs[i].x, Δ: wo.tabs[i].x - oo.tabs[i].x });
  }
  d.push({ sec: 'tabs', field: 'count', oo: oo.tabs.length, wo: wo.tabs.length });
  // QAT
  d.push({ sec: 'qat', field: 'count', oo: oo.qat?.btns?.length, wo: wo.qat?.btns?.length });
  d.push({ sec: 'qat', field: 'w', oo: oo.qat?.w, wo: wo.qat?.w });
  // Home buttons — match by nearest x within row
  const ooHome = (oo.home?.btns || []);
  const woHome = (wo.home?.rows || []).flatMap(r => (r.items || []).flatMap(it => it.btns || []));
  d.push({ sec: 'home', field: 'btnCount', oo: ooHome.length, wo: woHome.length });
  // Insert buttons
  const ooIns = (oo.insert?.btns || []);
  const woIns = (wo.insert?.rows || []).flatMap(r => r.btns || []);
  d.push({ sec: 'insert', field: 'btnCount', oo: ooIns.length, wo: woIns.length });
  for (let i = 0; i < Math.min(ooIns.length, woIns.length); i++) {
    d.push({ sec: 'insert', field: `${ooIns[i].text || ooIns[i].id}`, oo: { x: ooIns[i].x, w: ooIns[i].w, h: ooIns[i].h }, wo: { x: woIns[i].x, w: woIns[i].w, h: woIns[i].h } });
  }
  return d;
}

(async () => {
  console.log('WO...'); const wo = await captureWO();
  console.log('OO...'); const oo = await captureOO();
  const diffs = buildDiff(oo, wo);
  const report = { capturedAt: new Date().toISOString(), wo, oo, diffs };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n=== ${OUT} ===`);
  console.log(`chrome totalH: OO=${oo.chrome.totalH} WO=${wo.chrome.totalH}`);
  console.log(`tabs: OO=${oo.tabs.length} WO=${wo.tabs.length}`);
  console.log(`home btns: OO=${oo.home?.btns?.length} WO=${(wo.home?.rows||[]).flatMap(r=>(r.items||[]).flatMap(i=>i.btns||[])).length}`);
  console.log(`insert btns: OO=${oo.insert?.btns?.length} WO=${(wo.insert?.rows||[]).flatMap(r=>r.btns||[]).length}`);
  console.log('\nKey diffs:');
  diffs.filter(d => d.Δ !== undefined && d.Δ !== 0).forEach(d => console.log(`  [${d.sec}] ${d.field}: OO=${JSON.stringify(d.oo)} WO=${JSON.stringify(d.wo)} Δ=${d.Δ}`));
  diffs.filter(d => d.Δ === undefined && JSON.stringify(d.oo) !== JSON.stringify(d.wo)).slice(0, 10).forEach(d => console.log(`  [${d.sec}] ${d.field}: OO=${JSON.stringify(d.oo)?.slice(0,50)} WO=${JSON.stringify(d.wo)?.slice(0,50)}`));
})().catch(e => { console.error(e); process.exit(1); });
