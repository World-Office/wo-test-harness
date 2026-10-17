#!/usr/bin/env node
// fig/fig-ui.cjs — UI strangler-fig: live OnlyOffice vs WO word editor.
//
// Strangler-fig pattern at the UI surface: the OnlyOffice Document Server on
// the demo site (world-office-demo.graphwiz.ai, the upstream the WO editor is
// derived from) is loaded live with a config we control (lang, customization),
// the WO editor boots locally behind fig-boot (:18113). One probe captures the
// SAME structure on both sides:
//
//   tabs[]        ribbon tab labels + geometry (OO: li.ribtab; WO: .ribbon-tabs)
//   oneRow        all tabs share a single y-band
//   fileInRow     the File trigger sits IN the tab row (not a separate line)
//   backstage     File menu / backstage items {label, enabled, x, y, w, h}
//
// Oracle output: fig/census/fig-ui.json, consumed by run-fig.sh (set -e).
//
// Gates (exit 1 — these are WO-integrity failures the port must fix):
//   G1  WO File trigger is IN the ribbon tab row (same y-band as tabs)
//   G2  WO tabs render on ONE row
//   G3  WO chrome language is pure: UI_LLCC=en-GB must not show German strings
// OO-vs-WO tab sequence and backstage item join are REPORT (the strangler
// backlog), never a gate — that gap is exactly what the port is tracking.
//
// Env: FIG_OO_LANG (default 'en')  FIG_OO_DOC (default Bericht.docx)
//      FIG_SKIP_OO=1 (WO-only gate run when demo DS unreachable)
'use strict';
const fs = require('fs');
const path = require('path');
const { ensure } = require(path.join(__dirname, 'boot.cjs'));
const OUT = path.join(__dirname, 'census', 'fig-ui.json');
const DEMO_DS = process.env.FIG_OO_DS || 'https://world-office-demo.graphwiz.ai';
const DEMO_DOC_URL =
  process.env.FIG_OO_DOC_URL || 'https://world-office.graphwiz.ai/demo/files/';
const LANG = process.env.FIG_OO_LANG || 'en';
const DOC = process.env.FIG_OO_DOC || 'Bericht.docx';

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const { execSync } = require('child_process');
  const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
  ({ chromium } = require(path.join(root, 'playwright')));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OO_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>fig-oo</title>
<script src="${DEMO_DS}/web-apps/apps/api/documents/api.js"></script></head>
<body><div id="editor"></div><script>
new DocsAPI.DocEditor('editor', {
  document: { fileType: 'docx', key: 'fig-ui-' + Date.now(), title: ${JSON.stringify(DOC)},
    url: ${JSON.stringify(DEMO_DOC_URL + DOC)} },
  documentType: 'word', type: 'desktop',
  editorConfig: { callbackUrl: 'https://world-office.graphwiz.ai/wo-demo/callback',
    lang: ${JSON.stringify(LANG)}, customization: { hideRightMenu: true, hideRulers: true, forcesave: false } }
});</script></body></html>`;

// German chrome strings that must never appear when UI_LLCC selects English.
const DE_TOKENS = [
  'Datei', 'Öffnen', 'Drucken', 'Verlauf', 'Startseite', 'Einfügen', 'Zeichnen',
  'Verweise', 'Zusammenarbeit', 'Schutz', 'Ansicht', 'Kopf- und Fußzeile',
  'Exportieren', 'Neu', 'Bearbeiten', 'Anwendungsmenü',
];

const rectOf = (r) => ({
  x: Math.round(r.x), y: Math.round(r.y),
  w: Math.round(r.width), h: Math.round(r.height),
});

// ---- OO capture ----------------------------------------------------------
async function captureOO(browser) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.setContent(OO_HTML, { waitUntil: 'load', timeout: 30000 });
  let frame = null;
  for (let i = 0; i < 24 && !frame; i++) {
    await sleep(5000);
    frame = page
      .frames()
      .find((f) => /web-apps|documenteditor/i.test(f.url()));
    if (frame) {
      try {
        const ready = await frame.evaluate(
          () => !!document.querySelector('[id="file"][data-tab="file"]'),
        );
        if (!ready) frame = null;
      } catch { frame = null; }
    }
  }
  if (!frame) throw new Error('OO editor frame never appeared (demo DS down?)');

  // Dismiss first-run tooltips overlaying the ribbon.
  for (let i = 0; i < 3; i++) {
    await frame
      .evaluate(() => {
        const g = [...document.querySelectorAll('button, a, .btn, .item')].find(
          (b) => /got it/i.test((b.innerText || '').trim()),
        );
        if (g) g.click();
      })
      .catch(() => {});
    await sleep(800);
  }

  const tabs = await frame.evaluate(() => {
    const out = [];
    document.querySelectorAll('section.tabs > ul > li.ribtab').forEach((li) => {
      const r = li.getBoundingClientRect();
      if (r.width <= 0) return;
      out.push({
        id: li.id || li.querySelector('a')?.id || '',
        label: (li.innerText || '').trim(),
        hidden: false,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      });
    });
    return out;
  });

  await frame.locator('[id="file"][data-tab="file"]').click({ force: true, timeout: 15000 });
  await sleep(2500);
  const backstage = await frame.evaluate(() => {
    const p = document.querySelector('#file-menu-panel');
    if (!p || p.getBoundingClientRect().width <= 0) return null;
    const items = [];
    p.querySelectorAll('li.fm-btn').forEach((li) => {
      const a = li.querySelector('a.menu-item');
      if (!a) return;
      const r = a.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      items.push({
        id: li.id || a.id || '',
        label: (a.innerText || '').trim(),
        enabled: !/disabled/.test(li.className),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      });
    });
    return items;
  });
  await page.close();
  return { tabs, backstage };
}

// ---- WO capture ----------------------------------------------------------
// opts.locale emulates the browser language (de-DE etc.) to exercise the
// navigator-language resolution path; opts.url may carry UI_LLCC for the
// WOPI-param path.
async function captureWO(browser, base, opts = {}) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    locale: opts.locale || 'en-US',
  });
  await page.goto(base + '/word/' + (opts.url || ''), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(6000);

  const tabs = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.ribbon-tabs .ribbon-tab').forEach((b) => {
      const r = b.getBoundingClientRect();
      out.push({
        id: b.dataset.tab || '',
        label: (b.textContent || '').trim(),
        hidden: !!b.hidden || r.width <= 0,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      });
    });
    return out;
  });

  // The File trigger, wherever it currently lives (menu-bar legacy or tab row).
  const fileTrigger = await page.evaluate(() => {
    const b = document.getElementById('btn-file');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), label: (b.textContent || '').trim() };
  });

  // Language purity scan over the visible chrome (tab row + menu bar + file menu).
  const chromeText = await page.evaluate(() => {
    const grab = (sel) =>
      [...document.querySelectorAll(sel)]
        .filter((e) => !e.hidden && e.getBoundingClientRect().width > 0)
        .map((e) => (e.textContent || '').trim())
        .join('\n');
    return [grab('.ribbon-tabs *'), grab('#menu-bar *')].join('\n');
  });
  const germanStrings = DE_TOKENS.filter((t) => chromeText.includes(t));

  // Open the file menu (WO backstage equivalent) and capture items.
  await page.evaluate(() => document.getElementById('btn-file')?.click());
  await sleep(700);
  const backstage = await page.evaluate(() => {
    const ul = document.getElementById('file-menu');
    if (!ul || ul.hidden) return null;
    const items = [];
    ul.querySelectorAll('button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      items.push({
        id: b.id || '',
        label: (b.textContent || '').trim(),
        enabled: !b.disabled,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      });
    });
    return items;
  });
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await page.close();
  return { tabs, fileTrigger, backstage, germanStrings };
}

// ---- analysis ------------------------------------------------------------
function oneRowBand(items) {
  const ys = items.filter((t) => !t.hidden).map((t) => t.y).sort((a, b) => a - b);
  if (!ys.length) return { oneRow: false, band: [] };
  const mid = ys[Math.floor(ys.length / 2)];
  const inBand = ys.filter((y) => Math.abs(y - mid) <= 3).length;
  return { oneRow: inBand === ys.length, band: [ys[0], ys[ys.length - 1]] };
}

function labelJoin(oo, wo) {
  const norm = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
  const ooSet = oo.map((t) => norm(t.label));
  const woSet = wo.map((t) => norm(t.label));
  return {
    missingInWo: ooSet.filter((l) => !woSet.includes(l)),
    extraInWo: woSet.filter((l) => !ooSet.includes(l)),
    sequenceMatch: JSON.stringify(ooSet) === JSON.stringify(woSet),
  };
}

async function main() {
  const server = await ensure();
  const base = server.base || 'http://127.0.0.1:18113';
  const browser = await chromium.launch();

  let oo = null;
  if (!process.env.FIG_SKIP_OO) {
    try {
      const c = await captureOO(browser);
      oo = { source: DEMO_DS, lang: LANG, ...c, ...oneRowBand(c.tabs) };
    } catch (e) {
      console.error('fig-ui: OO capture unavailable:', e.message.slice(0, 120));
      console.error('fig-ui: set FIG_SKIP_OO=1 to run WO gates only');
    }
  }

  const wo = await captureWO(browser, base, { url: '?UI_LLCC=en-GB' });
  // German browser, no UI_LLCC: every chrome label must resolve to ONE
  // language (all-DE or all-EN) — never the mixed set the old editor shipped.
  const woDe = await captureWO(browser, base, { locale: 'de-DE' });
  await browser.close();

  const EN_ONLY = ['File', 'Home', 'Insert', 'Draw', 'References', 'Collaboration', 'Protection', 'View'];
  const DE_ONLY = ['Datei', 'Start', 'Einf\u00fcgen', 'Zeichnen', 'Verweise', 'Zusammenarbeit', 'Schutz', 'Ansicht'];
  const deLabels = woDe.tabs.filter((t) => !t.hidden).map((t) => t.label)
    .concat(woDe.fileTrigger ? [woDe.fileTrigger.label] : []);
  const hasEn = deLabels.some((l) => EN_ONLY.includes(l));
  const hasDe = deLabels.some((l) => DE_ONLY.includes(l));

  const woVis = wo.tabs.filter((t) => !t.hidden);
  const woRow = oneRowBand(woVis);
  const tabYs = woVis.map((t) => t.y);
  const fileInRow = !!wo.fileTrigger && wo.fileTrigger.y >= Math.min(...tabYs) - 3 &&
    wo.fileTrigger.y <= Math.max(...tabYs) + 3;
  // Sequence join sees the File trigger as first tab (OO models it as one).
  const woSeq = fileInRow && wo.fileTrigger
    ? [{ label: wo.fileTrigger.label }, ...woVis]
    : woVis;

  const gates = [
    { id: 'G1', name: 'file trigger in ribbon tab row', pass: fileInRow },
    { id: 'G2', name: 'tabs on a single row', pass: woRow.oneRow },
    { id: 'G3', name: 'english chrome (no German strings at UI_LLCC=en-GB)', pass: wo.germanStrings.length === 0 },
    { id: 'G4', name: 'de-DE chrome consistent (no mixed EN/DE labels)', pass: !(hasEn && hasDe) },
  ];

  const report = {
    capturedAt: new Date().toISOString(),
    viewport: { width: 1600, height: 1000 },
    oo,
    wo: {
      tabs: wo.tabs,
      fileTrigger: wo.fileTrigger,
      backstage: wo.backstage,
      germanStrings: wo.germanStrings,
      ...woRow,
      fileInRow,
    },
    woDe: { tabs: woDe.tabs, fileTrigger: woDe.fileTrigger, mixedLanguage: hasEn && hasDe },
    gates,
    tabJoin: oo ? labelJoin(oo.tabs, woSeq) : null,
    backstageJoin: oo && wo.backstage && oo.backstage
      ? labelJoin(oo.backstage.map((b) => ({ label: b.label })), wo.backstage)
      : null,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

  const failed = gates.filter((g) => !g.pass);
  for (const g of gates) console.log(`fig-ui ${g.id} ${g.pass ? 'ok' : 'FAIL'}: ${g.name}`);
  if (!gates[3].pass)
    console.log('fig-ui de-DE labels:', deLabels.join(','));
  if (report.tabJoin) {
    console.log(
      `fig-ui tabs oo=[${oo.tabs.map((t) => t.label).join(',')}] wo=[${woVis.map((t) => t.label).join(',')}]`,
    );
    if (report.tabJoin.missingInWo.length)
      console.log('fig-ui missing tabs in WO:', report.tabJoin.missingInWo.join(', '));
    if (report.backstageJoin && report.backstageJoin.missingInWo.length)
      console.log('fig-ui backstage items missing in WO:', report.backstageJoin.missingInWo.join(', '));
  }
  console.log(`fig-ui → ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('fig-ui failed:', e.message);
  process.exit(2);
});
