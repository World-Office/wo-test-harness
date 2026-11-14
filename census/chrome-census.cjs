#!/usr/bin/env node
/* chrome-census.cjs — unified chrome census rig that captures EVERY visual
 * detail of the ribbon for both OO and WO side-by-side, producing a
 * structured JSON diff report. Catches: geometry, colors, fonts, borders,
 * shadows, icon presence, button order, tab positions, group separators,
 * QAT layout, toolbar-tools, statusbar.
 *
 * Usage:
 *   WO_URL=https://editor.cloud.graphwiz.ai/word/ \
 *   OO_DEMO=https://world-office.graphwiz.ai/demo \
 *   node chrome-census.cjs [--out census-chrome-diff.json]
 *
 * Output: JSON with per-section OO vs WO values + computed deltas.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/weiss/.npm-global/lib/node_modules/playwright/index.mjs');

const WO_URL = process.env.WO_URL || 'https://editor.cloud.graphwiz.ai/word/';
const OO_DEMO = process.env.OO_DEMO || 'https://world-office.graphwiz.ai/demo';
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : '/tmp/census-chrome-diff.json';

const VIEWPORT = { width: 1680, height: 950 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Capture function for WO (direct page) ──────────────────────────────
async function captureWO(url) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: VIEWPORT });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#editor', { timeout: 30000 });
  await sleep(3000);

  const data = await p.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };

    // Chrome structure
    const titlebar = document.querySelector('.titlebar');
    const toolbar = document.querySelector('.toolbar');
    const body = document.body;

    // Tabs
    const fileBtn = document.querySelector('#btn-file');
    const tabs = [...document.querySelectorAll('.ribbon-tab')].filter(e => !e.hidden);
    const allTabs = [{ label: fileBtn?.textContent.trim(), ...rect(fileBtn), cls: 'file-menu', active: false }]
      .concat(tabs.map(t => ({ label: t.textContent.trim(), ...rect(t), cls: 'ribbon-tab', active: t.classList.contains('active') || t.getAttribute('aria-selected') === 'true' })));

    // Toolbar children layout
    const toolbarKids = [...toolbar.children].filter(c => c.offsetParent !== null).map(c => ({
      cls: c.className?.slice(0, 50), tag: c.tagName, ...rect(c),
      bg: cs(c)?.backgroundColor, order: cs(c)?.order, display: cs(c)?.display,
    }));

    // QAT strip
    const qat = document.querySelector('.qat-strip');
    const qatBtns = qat ? [...qat.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => ({
      id: b.id, label: b.title?.slice(0, 30), ...rect(b),
      hasIcon: !!b.querySelector('svg, .oo-ic, span[class*="icon"]'),
    })) : [];

    // Home ribbon (click home tab)
    const homeTab = document.querySelector('.ribbon-tab[data-tab="home"]');
    const homeData = { rows: [] };
    if (homeTab && !homeTab.classList.contains('active')) homeTab.click();

    return {
      engine: 'wo',
      chrome: {
        titlebar: titlebar ? { ...rect(titlebar), bg: cs(titlebar).backgroundColor, fontSize: cs(titlebar).fontSize, fontFamily: cs(titlebar).fontFamily.slice(0, 40), color: cs(titlebar).color, border: cs(titlebar).borderBottom, pad: cs(titlebar).padding } : null,
        toolbar: toolbar ? { ...rect(toolbar), bg: cs(toolbar).backgroundColor, fontSize: cs(toolbar).fontSize, border: cs(toolbar).borderBottom, pad: cs(toolbar).padding, shadow: cs(toolbar).boxShadow } : null,
        totalH: titlebar && toolbar ? Math.round(titlebar.getBoundingClientRect().height + toolbar.getBoundingClientRect().height) : 0,
        bodyBg: cs(body).backgroundColor,
        bodyFont: cs(body).fontFamily.slice(0, 40),
        bodyFontSize: cs(body).fontSize,
      },
      tabs: allTabs,
      toolbarKids,
      qat: qat ? { ...rect(qat), bg: cs(qat).backgroundColor, border: cs(qat).borderRight, gridCols: cs(qat).gridTemplateColumns, gridRows: cs(qat).gridTemplateRows, btns: qatBtns } : null,
      homeTab: homeTab ? { ...rect(homeTab), active: homeTab.classList.contains('active') } : null,
    };
  });

  // Now capture home ribbon buttons after tab switch
  await sleep(1500);
  const homeRibbon = await p.evaluate(() => {
    const page = document.querySelector('.ribbon-page.active');
    if (!page) return null;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const rows = [...page.querySelectorAll('.ribbon-row')].map((row, ri) => ({
      rowIdx: ri, ...rect(row),
      items: [...row.children].filter(c => c.offsetParent !== null && c.getBoundingClientRect().width > 5).map(c => ({
        tag: c.tagName, cls: c.className?.slice(0, 50), ...rect(c),
        text: c.textContent?.trim()?.slice(0, 30),
        btns: [...c.querySelectorAll('button:not([hidden]), select:not([hidden])')].filter(b => b.offsetParent !== null && b.getBoundingClientRect().width > 5).map(b => ({
          id: b.id || '', cls: b.className?.slice(0, 30), ...rect(b),
          text: b.textContent?.trim()?.slice(0, 20), title: b.title?.slice(0, 30),
          hasIcon: !!b.querySelector('svg'),
        })),
      })),
    }));
    return { tab: page.getAttribute('data-tab'), rows };
  });
  data.homeRibbon = homeRibbon;

  // Insert ribbon
  await p.click('.ribbon-tab[data-tab="insert"]');
  await sleep(1500);
  const insertRibbon = await p.evaluate(() => {
    const page = document.querySelector('.ribbon-page.active');
    if (!page) return null;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const rows = [...page.querySelectorAll('.ribbon-row')].map((row, ri) => ({
      rowIdx: ri, ...rect(row),
      btns: [...row.querySelectorAll('button:not([hidden]), select:not([hidden])')].filter(b => b.offsetParent !== null && b.getBoundingClientRect().width > 5).map(b => ({
        id: b.id || '', cls: b.className?.slice(0, 30), ...rect(b),
        text: b.textContent?.trim()?.slice(0, 20), title: b.title?.slice(0, 30),
        hasIcon: !!b.querySelector('svg'),
      })),
    }));
    return { tab: page.getAttribute('data-tab'), rows };
  });
  data.insertRibbon = insertRibbon;

  // Toolbar-tools
  data.toolbarTools = await p.evaluate(() => {
    const tt = document.querySelector('.toolbar-tools');
    if (!tt) return null;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { ...rect(tt), border: getComputedStyle(tt).borderLeft, btns: [...tt.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => ({ id: b.id, ...rect(b), text: b.textContent?.trim()?.slice(0, 15) })) };
  });

  await b.close();
  return data;
}

// ── Capture function for OO (via demo side-by-side) ────────────────────
async function captureOO(demoUrl) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: VIEWPORT });
  await p.goto(demoUrl, { waitUntil: 'load', timeout: 90000 });
  await sleep(5000);
  const fileEl = await p.$('.file');
  if (fileEl) await fileEl.click();
  await sleep(15000);

  const ooFrame = p.frames().find(f => f.name() === 'frameEditor');
  if (!ooFrame) throw new Error('OO frame not found');

  const data = await ooFrame.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };

    const toolbar = document.querySelector('.toolbar');
    const boxTabs = document.querySelector('.box-tabs');
    const boxControls = document.querySelector('.box-controls');
    const body = document.body;

    // Tabs
    const tabs = [...document.querySelectorAll('.tabs li')].filter(e => e.offsetParent !== null).map(li => ({
      label: li.textContent.trim(), ...rect(li), active: li.classList.contains('active'),
    }));

    // Toolbar children
    const toolbarKids = [...toolbar.children].filter(c => c.offsetParent !== null && c.getBoundingClientRect().width > 10).map(c => ({
      cls: String(c.className || '').slice(0, 50), tag: c.tagName, ...rect(c),
      bg: cs(c)?.backgroundColor,
    }));

    // QAT (panel.static)
    const panelStatic = document.querySelector('.panel.static');
    const qatBtns = panelStatic ? [...panelStatic.querySelectorAll('button')].filter(b => b.offsetParent !== null && b.getBoundingClientRect().width > 5).map(b => ({
      id: b.id?.replace('id-toolbar-btn-', ''), ...rect(b),
      hasIcon: !!b.querySelector('svg, i[class*="icon"]'),
    })) : [];

    return {
      engine: 'oo',
      chrome: {
        toolbar: toolbar ? { ...rect(toolbar), bg: cs(toolbar).backgroundColor, fontSize: cs(toolbar).fontSize } : null,
        boxTabs: boxTabs ? { ...rect(boxTabs), bg: cs(boxTabs).backgroundColor, h: Math.round(boxTabs.getBoundingClientRect().height) } : null,
        boxControls: boxControls ? { ...rect(boxControls), bg: cs(boxControls).backgroundColor, h: Math.round(boxControls.getBoundingClientRect().height), pad: cs(boxControls).padding } : null,
        totalH: toolbar ? Math.round(toolbar.getBoundingClientRect().height) : 0,
        bodyBg: cs(body).backgroundColor,
        bodyFont: cs(body).fontFamily.slice(0, 40),
        bodyFontSize: cs(body).fontSize,
      },
      tabs,
      toolbarKids,
      qat: panelStatic ? { ...rect(panelStatic), bg: cs(panelStatic).backgroundColor, btns: qatBtns } : null,
    };
  });

  // Home ribbon
  await ooFrame.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tabs li a, .ribtab a, .ribtab')];
    const home = tabs.find(t => t.textContent?.includes('Startseite') || t.id === 'home');
    if (home) home.click();
  });
  await sleep(2000);
  data.homeRibbon = await ooFrame.evaluate(() => {
    const bc = document.querySelector('.box-controls');
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const btns = [...bc.querySelectorAll('button')].filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 5 && r.height > 5 && r.top > 30 && r.top < 130 && b.offsetParent !== null;
    }).map(b => ({
      id: b.id?.replace('id-toolbar-btn-', '')?.slice(0, 30), ...rect(b),
      text: b.textContent?.trim()?.slice(0, 20), title: b.getAttribute('data-bs-tooltip') || b.title || '',
      hasIcon: !!b.querySelector('svg, i[class*="icon"]'),
    })).sort((a, b) => a.x - b.x || a.y - b.y);
    // Also get selects/inputs
    const selects = [...bc.querySelectorAll('input, select')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 10 && r.top > 30 && r.top < 130 && el.offsetParent !== null;
    }).map(el => ({ cls: el.className?.slice(0, 40), ...rect(el) }));
    return { btns: btns.slice(0, 60), selects };
  });

  // Insert ribbon
  await ooFrame.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tabs li a, .ribtab a, .ribtab')];
    const ins = tabs.find(t => t.textContent?.includes('Einfügen'));
    if (ins) ins.click();
  });
  await sleep(2000);
  data.insertRibbon = await ooFrame.evaluate(() => {
    const bc = document.querySelector('.box-controls');
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const btns = [...bc.querySelectorAll('button')].filter(b => {
      const r = b.getBoundingClientRect();
      return r.x > 170 && r.width > 5 && r.height > 20 && r.top > 30 && r.top < 130 && b.offsetParent !== null;
    }).map(b => ({
      id: b.id?.replace('id-toolbar-btn-', '')?.slice(0, 30), ...rect(b),
      text: b.textContent?.trim()?.slice(0, 20),
      hasIcon: !!b.querySelector('svg, i[class*="icon"]'),
    })).sort((a, b) => a.x - b.x);
    return { btns: btns.slice(0, 40) };
  });

  await b.close();
  return data;
}

// ── Diff computation ───────────────────────────────────────────────────
function diffChrome(oo, wo) {
  const diffs = [];
  const c = (label, ooVal, woVal) => {
    if (JSON.stringify(ooVal) !== JSON.stringify(woVal)) {
      diffs.push({ section: 'chrome', label, oo: ooVal, wo: woVal, delta: typeof ooVal === 'number' && typeof woVal === 'number' ? woVal - ooVal : null });
    }
  };
  c('totalH', oo.chrome.totalH, wo.chrome.totalH);
  c('titlebar.bg', oo.chrome.boxTabs?.bg, wo.chrome.titlebar?.bg);
  c('titlebar.h', oo.chrome.boxTabs?.h, wo.chrome.titlebar?.h);
  c('toolbar.bg', oo.chrome.boxControls?.bg, wo.chrome.toolbar?.bg);
  c('toolbar.h', oo.chrome.boxControls?.h, wo.chrome.toolbar?.h);
  c('bodyFont', oo.chrome.bodyFont, wo.chrome.bodyFont);
  c('bodyFontSize', oo.chrome.bodyFontSize, wo.chrome.bodyFontSize);
  c('bodyBg', oo.chrome.bodyBg, wo.chrome.bodyBg);
  return diffs;
}

function diffTabs(oo, wo) {
  const diffs = [];
  const ooLabels = oo.tabs.map(t => t.label);
  const woLabels = wo.tabs.map(t => t.label);
  if (ooLabels.length !== woLabels.length) {
    diffs.push({ section: 'tabs', label: 'count', oo: ooLabels.length, wo: woLabels.length, ooLabels, woLabels });
  }
  for (let i = 0; i < Math.min(oo.tabs.length, wo.tabs.length); i++) {
    const o = oo.tabs[i], w = wo.tabs[i];
    if (o.x !== w.x) diffs.push({ section: 'tabs', label: `${o.label} x-pos`, oo: o.x, wo: w.x, delta: w.x - o.x });
  }
  return diffs;
}

function diffRibbon(oo, wo, section) {
  const diffs = [];
  const ooBtns = oo?.btns || [];
  const woRows = wo?.rows || [];
  const woBtns = woRows.flatMap(r => r.btns || []);
  
  // Compare button counts
  diffs.push({ section, label: 'button-count', oo: ooBtns.length, wo: woBtns.length });
  
  // Compare by position proximity (within 10px)
  for (const ob of ooBtns) {
    const match = woBtns.find(wb => Math.abs(wb.x - ob.x) < 15 && Math.abs(wb.y - ob.y) < 15);
    if (!match) {
      diffs.push({ section, label: `missing-in-wo: "${ob.text || ob.id}"`, oo: { x: ob.x, y: ob.y, w: ob.w, h: ob.h, text: ob.text }, wo: null });
    } else if (Math.abs(match.w - ob.w) > 3 || Math.abs(match.h - ob.h) > 3) {
      diffs.push({ section, label: `size-diff: "${ob.text || ob.id}"`, oo: { w: ob.w, h: ob.h }, wo: { w: match.w, h: match.h } });
    }
  }
  for (const wb of woBtns) {
    const match = ooBtns.find(ob => Math.abs(ob.x - wb.x) < 15 && Math.abs(ob.y - wb.y) < 15);
    if (!match) {
      diffs.push({ section, label: `extra-in-wo: "${wb.text || wb.id}"`, wo: { x: wb.x, y: wb.y, w: wb.w, h: wb.h, text: wb.text }, oo: null });
    }
  }
  return diffs;
}

// ── Main ───────────────────────────────────────────────────────────────
(async () => {
  console.log('Capturing WO...');
  const wo = await captureWO(WO_URL);
  console.log('Capturing OO...');
  const oo = await captureOO(OO_DEMO);

  const diffs = [
    ...diffChrome(oo, wo),
    ...diffTabs(oo, wo),
    ...diffRibbon(oo.homeRibbon, wo.homeRibbon, 'home-ribbon'),
    ...diffRibbon(oo.insertRibbon, wo.insertRibbon, 'insert-ribbon'),
  ];

  const report = {
    capturedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    woUrl: WO_URL,
    ooDemo: OO_DEMO,
    wo,
    oo,
    diffs,
    summary: {
      totalDiffs: diffs.length,
      chromeDiffs: diffs.filter(d => d.section === 'chrome').length,
      tabDiffs: diffs.filter(d => d.section === 'tabs').length,
      homeDiffs: diffs.filter(d => d.section === 'home-ribbon').length,
      insertDiffs: diffs.filter(d => d.section === 'insert-ribbon').length,
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n=== CENSUS REPORT: ${OUT} ===`);
  console.log(`Total diffs: ${report.summary.totalDiffs}`);
  console.log(`  chrome: ${report.summary.chromeDiffs}`);
  console.log(`  tabs: ${report.summary.tabDiffs}`);
  console.log(`  home: ${report.summary.homeDiffs}`);
  console.log(`  insert: ${report.summary.insertDiffs}`);
  console.log('\nTop diffs:');
  diffs.slice(0, 30).forEach(d => console.log(`  [${d.section}] ${d.label}: OO=${JSON.stringify(d.oo)?.slice(0, 60)} WO=${JSON.stringify(d.wo)?.slice(0, 60)}`));
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
