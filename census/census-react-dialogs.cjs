#!/usr/bin/env node
// census-react-dialogs.cjs — dialog census of the REACT editor (the deployed
// /word since 2026-11-16), the react-side counterpart of
// census-wo-dialogs.cjs. The React app has no <dialog id="*-dialog">
// registry: its dialog surfaces are the right-rail panels (ai-assistant,
// comments, review, paragraph, table, image, …) opened via
// documentStore.toggleRightPanel. Each is opened the way a user opens it
// (wo-command bus = the same route the ribbon uses; rail-button click once
// the rail is visible) and captured with the SAME schema as the OO/WO dialog
// censuses so the ledger can join them:
//
//   id / title / openedBy / fields / buttons / rect
//
// Usage (boot the rig first:  bash census/run-react-rig.sh 8943):
//   CENSUS_REACT_URL=http://127.0.0.1:8943/word/ node census/census-react-dialogs.cjs
// Output: census/census/census-react-dialogs.json (override dir: CENSUS_OUT).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL_BASE = process.env.CENSUS_REACT_URL;
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every right-menu panel of the React editor, keyed by the rail button's
// stable `data-action` (= documentStore RightMenuPanel id). `cmd` = the
// wo-command a ribbon button routes through (word-commands.ts →
// toggleRightPanel) as fallback when the rail is not reachable.
const PANELS = [
  ['ai-assistant', 'aiAssistant', 'AI Assistant'],
  ['comments', 'insertComment', 'Comments'],
  ['review', 'displayMode', 'Review'],
  ['paragraph', 'dropCap', 'Paragraph'],
  ['table', 'insertTable', 'Table'],
  ['image', 'image', 'Image'],
  ['shape', 'insertShape', 'Shape'],
  ['chart', 'insertChart', 'Chart'],
  ['textart', 'textArt', 'TextArt'],
  ['mailmerge', 'mailMerge', 'MailMerge'],
  ['signature', null, 'Signature'], // no wo-command routes here — rail click
  ['form', 'insertContentControl', 'Form'],
  ['plugins', 'plugins', 'Plugins'],
  ['crossreference', 'link', 'Cross-Ref'],
  ['theme', 'openTheme', 'Theme'],
];

async function emitCommand(page, cmd) {
  await page.evaluate((c) => {
    window.dispatchEvent(new CustomEvent('wo-command', { detail: { command: c, value: '' } }));
  }, cmd);
}

// Open the panel: click the right-rail button (its stable data-action) —
// the visible UI; fall back to the wo-command bus route. Returns how it was
// opened (or 'failed').
async function openPanel(page, id, cmd) {
  const clicked = await page.evaluate((id) => {
    const btn = document.querySelector(`.de-right-menu button[data-action="${id}"]`);
    if (btn && btn.offsetParent !== null) { btn.click(); return true; }
    return false;
  }, id);
  if (clicked) return `rail:${id}`;
  if (cmd) { await emitCommand(page, cmd); return `cmd:${cmd}`; }
  return 'failed';
}

async function extract(page, id, openedBy, fallbackTitle) {
  return await page.evaluate(({ id, openedBy, fallbackTitle }) => {
    const rail = document.querySelector('.de-viewport-right-menu');
    if (!rail) return null;
    const el = [...rail.children].find(
      (c) =>
        !c.classList.contains('de-right-menu') &&
        !c.classList.contains('de-right-panel-side') &&
        c.offsetParent !== null &&
        c.offsetWidth > 0,
    );
    if (!el) return null;

    // title: first direct child that is a bold short header (the panels'
    // shared "fontWeight 600 + borderBottom" header); button text (close ✕)
    // excluded. Else the rail name.
    let title = '';
    for (const c of el.children) {
      const cs = getComputedStyle(c);
      const bold = cs.fontWeight === 'bold' || parseInt(cs.fontWeight, 10) >= 600;
      let t = '';
      for (const n of c.childNodes) if (n.nodeType === 3) t += n.textContent;
      for (const n of c.children) if (n.tagName !== 'BUTTON') t += n.textContent || '';
      t = t.trim();
      if (bold && t && t.length <= 80) { title = t; break; }
    }

    const fields = [];
    const seen = new Set();
    const optionsOf = (ctrl) =>
      ctrl && ctrl.tagName === 'SELECT'
        ? [...ctrl.querySelectorAll('option')].map((o) => (o.textContent || '').trim()).slice(0, 30)
        : [];
    for (const lab of el.querySelectorAll('label')) {
      const text = (lab.textContent || '').trim();
      if (!text) continue;
      const forId = lab.getAttribute('for');
      let ctrl = forId ? el.querySelector('#' + CSS.escape(forId)) : null;
      if (!ctrl) ctrl = lab.querySelector('input,select,textarea');
      if (!ctrl && lab.nextElementSibling && /^(INPUT|SELECT|TEXTAREA)$/.test(lab.nextElementSibling.tagName)) {
        ctrl = lab.nextElementSibling;
      }
      if (ctrl) seen.add(ctrl);
      fields.push({
        label: text,
        tag: ctrl ? ctrl.tagName.toLowerCase() : 'text',
        type: ctrl ? ctrl.getAttribute('type') || (ctrl.tagName === 'SELECT' ? 'select' : 'text') : 'text',
        options: optionsOf(ctrl),
      });
    }
    // unlabeled controls (the panels use section divs + bare selects/inputs)
    for (const ctrl of el.querySelectorAll('select, input, textarea')) {
      if (seen.has(ctrl) || ctrl.offsetParent === null || seen.has(ctrl)) continue;
      seen.add(ctrl);
      let label = ctrl.getAttribute('aria-label') || ctrl.getAttribute('placeholder') || ctrl.getAttribute('title') || '';
      if (!label) {
        const sec = ctrl.closest('.de-prop-section, [class*="section"]');
        const hdr = sec ? sec.firstElementChild : null;
        if (hdr && hdr !== ctrl && !hdr.contains(ctrl)) {
          const t = (hdr.textContent || '').trim();
          if (t && t.length <= 60 && !t.includes('\n')) label = t;
        }
      }
      fields.push({
        label,
        tag: ctrl.tagName.toLowerCase(),
        type: ctrl.getAttribute('type') || (ctrl.tagName === 'SELECT' ? 'select' : 'text'),
        options: optionsOf(ctrl),
      });
    }

    const buttons = [...el.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => (b.textContent || '').trim() || b.getAttribute('aria-label') || b.getAttribute('title') || b.id)
      .filter(Boolean)
      .slice(0, 25);

    return {
      id,
      openedBy,
      visible: true,
      title: title || fallbackTitle,
      fields,
      buttons,
      rect: { w: el.offsetWidth, h: el.offsetHeight },
    };
  }, { id, openedBy, fallbackTitle });
}

(async () => {
  if (!URL_BASE) throw new Error('CENSUS_REACT_URL is required');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => console.error('pageerror:', String(e.message).slice(0, 160)));
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForSelector('.de-statusbar, [data-tab="file"]', { timeout: 30000 }).catch(() => {});
  await sleep(4000); // wasm boot + demo load

  // The right rail is hidden until a panel is requested — reveal it once via
  // the wo-command bus (the route every ribbon panel button takes).
  await emitCommand(page, 'plugins');
  await sleep(600);
  await emitCommand(page, 'plugins'); // toggle back off; rail stays visible
  await sleep(300);

  const dialogs = [];
  const failures = [];
  for (const [id, cmd, title] of PANELS) {
    const openedBy = await openPanel(page, id, cmd);
    await sleep(500);
    if (openedBy === 'failed') {
      // capture nothing — a stale previous panel would silently mis-report
      failures.push(id);
      continue;
    }
    const snap = await extract(page, id, openedBy, title);
    if (snap) dialogs.push(snap);
    else failures.push(id);
  }

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  const outPath = path.join(OUT, 'census-react-dialogs.json');
  fs.writeFileSync(outPath, JSON.stringify({
    capturedAt: new Date().toISOString(),
    engine: 'worldoffice-react',
    dialogs,
  }, null, 2));

  const withFields = dialogs.filter((d) => d.fields.length).length;
  console.log(`census-react-dialogs: ${dialogs.length}/${PANELS.length} panels captured (${withFields} with labeled fields)`);
  for (const d of dialogs) {
    console.log(`  - ${d.title} [${d.id}] via ${d.openedBy}: fields=${d.fields.length} buttons=${d.buttons.length} ${d.rect.w}x${d.rect.h}`);
  }
  console.log(`  wrote ${outPath}`);
  if (failures.length) console.error(`  never opened: ${failures.join(', ')}`);
  if (dialogs.length < 5) {
    console.error('FAIL: fewer than 5 panels opened — the React panel surface regressed');
    process.exit(1);
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
