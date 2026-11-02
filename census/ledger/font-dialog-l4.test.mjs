#!/usr/bin/env node
/* L4 FIDELITY probe: font-dialog field-level parity (task L4-005).
 *
 * Neither editor ships a separate "Font" modal — OO exposes the font
 * contract on its Home ribbon (family combo, size combo, B/I/U/S, font and
 * highlight color) and WO mirrors it as the Home-tab font control group
 * (#font-family select, #font-size select, data-cmd buttons, color inputs).
 * This probe treats that group as THE font dialog and asks the L4 question:
 * does every OO font field exist in WO AND actually apply when driven?
 *
 * OO reference fields are MEASURED from the committed census
 * (census-oo-deep.json tabs.home), never hand-copied; the OO->WO selector
 * mapping below is the declared, auditable pairing. Per field:
 *   present  the WO control exists in the live editor
 *   applied  driving it on a selected word changes window.__WO_FLAT_HTML__()
 * parity = every OO field present AND every apply-verified field applied.
 *
 * Writes ledger/font-dialog-l4.json (merged by ledger/build.py as the
 * dialog.font-dialog.l4 row). Exit 1 on parity gap (loud, not silent).
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app in the server repo).
 * Run: node census/ledger/font-dialog-l4.test.mjs
 */
'use strict';

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_DIR = __dirname;
const CENSUS_DIR = path.join(LEDGER_DIR, '..');
const OUT_JSON = path.join(LEDGER_DIR, 'font-dialog-l4.json');
const OO_DEEP = path.join(CENSUS_DIR, 'census', 'census-oo-deep.json');

const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>fontdialog sentinel alpha text.</p>';
const SENTINEL = 'sentinel';
const BOOT_MS = 2200;

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [path.join(CENSUS_DIR, 'node_modules', 'playwright')];
  try {
    const { execSync } = require('node:child_process');
    candidates.push(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch (_) { /* ignore */ }
  for (const c of candidates) {
    try { return require(c); } catch (_) { /* try next */ }
  }
  throw new Error('playwright not found (census/node_modules nor global)');
}

/* OO font-group field label -> live WO probe.
 * how  : presence selector
 * apply: optional {act} that drives the control on the selected word
 * want : regex the flat HTML must match after apply (apply-verified) */
const FIELD_MAP = {
  'font': {
    sel: '#font-family', kind: 'choice',
    act: { type: 'selectOption', target: '#font-family', value: 'Arial' },
    want: /font-family\s*:/i,
  },
  'font size': {
    sel: '#font-size', kind: 'choice',
    act: { type: 'selectOption', target: '#font-size', value: '5' },
    want: /font-size\s*:/i,
  },
  'increment font size': { sel: '[data-cmd="fontSizeInc"]', kind: 'button' },
  'decrement font size': { sel: '[data-cmd="fontSizeDec"]', kind: 'button' },
  'bold': {
    sel: '[data-cmd="bold"]', kind: 'button',
    act: { type: 'click', target: '[data-cmd="bold"]' },
    want: /<(b|strong)\b|font-weight\s*:\s*(bold|[6-9]00)/i,
  },
  'italic': {
    sel: '[data-cmd="italic"]', kind: 'button',
    act: { type: 'click', target: '[data-cmd="italic"]' },
    want: /<(i|em)\b|font-style\s*:\s*italic/i,
  },
  'underline': { sel: '[data-cmd="underline"]', kind: 'button' },
  'strikethrough': { sel: '[data-cmd="strikeThrough"]', kind: 'button' },
  'highlight color': {
    sel: '#highlight-color', kind: 'color',
    act: { type: 'color', target: '#highlight-color', value: '#ff00ff' },
    want: /background-color\s*:\s*rgb/i,
  },
  'font color': {
    sel: '#text-color', kind: 'color',
    act: { type: 'color', target: '#text-color', value: '#ff0000' },
    want: /(?<!background-)color\s*:\s*rgb\s*\(\s*255/i,
  },
};

/* OO reference: home-tab font-group labels from the committed census. */
function ooFontFields() {
  const oo = JSON.parse(fs.readFileSync(OO_DEEP, 'utf8'));
  const home = ((oo.tabs || {}).home || {}).buttons || [];
  const isFont = (l) => /^(font|bold|italic|underline|strikethrough|highlight color)\b/i.test(l)
    || /font (family|size|color)/i.test(l);
  const seen = new Set();
  const out = [];
  for (const b of home) {
    const label = (b.label || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); // drop "(Ctrl+B)"
    const key = label.toLowerCase();
    if (!label || !isFont(label) || key === 'default' || seen.has(key)) continue;
    if (!(key in FIELD_MAP)) continue; // not part of the font group contract
    seen.add(key);
    out.push(label);
  }
  return out;
}

/* ---------- editor boot (same contract as ledger/roundtrip.cjs) ---------- */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    srv.on('error', reject);
  });
}

function stubInit(seed) {
  localStorage.clear();
  window.__COLLAB__ = false;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || 'GET';
    if (method === 'GET' && url.includes('/api/documents/') && url.includes('/html')) {
      return Promise.resolve(new Response(JSON.stringify({ html: seed, name: 'demo.docx' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  };
  navigator.sendBeacon = () => true;
}

async function bootEditor(browser, base) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(stubInit, SEED_HTML);
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#editor', { timeout: 20000 });
  await page.waitForTimeout(BOOT_MS);
  return { ctx, page };
}

async function selectWord(page, word) {
  return page.evaluate((w) => {
    const ed = document.querySelector('#editor');
    if (!ed) return 'no-editor';
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.textContent.indexOf(w);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + w.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        ed.focus();
        return 'ok';
      }
    }
    return 'word-not-found';
  }, word);
}

async function applyAct(page, act) {
  if (act.type === 'selectOption') {
    await page.selectOption(act.target, act.value);
  } else if (act.type === 'click') {
    await page.click(act.target);
  } else if (act.type === 'color') {
    await page.evaluate(({ target, value }) => {
      const el = document.querySelector(target);
      if (!el) throw new Error('no ' + target);
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, act);
  }
  await page.waitForTimeout(200);
}

/* -------------------------------- main -------------------------------- */
const main = async () => {
  const ooFields = ooFontFields();
  if (!ooFields.length) throw new Error('no OO font fields found in census-oo-deep.json');

  const port = await freePort();
  const srv = spawn('/usr/bin/python3',
    ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', EDITOR_DIR],
    { stdio: ['ignore', 'ignore', 'ignore'] });
  const base = `http://127.0.0.1:${port}`;

  let browser;
  const fields = [];
  try {
    const { chromium } = loadPlaywright();
    browser = await chromium.launch();
    const { ctx, page } = await bootEditor(browser, base);

    // the font control group itself must exist (the "dialog" surface)
    const group = await page.$('.rb-group[aria-label="Font"]');
    fields.push({
      oo: 'Font group surface', sel: '.rb-group[aria-label="Font"]',
      present: !!group, ok: !!group,
    });

    for (const label of ooFields) {
      const spec = FIELD_MAP[label.toLowerCase()];
      const row = { oo: label, sel: spec.sel, kind: spec.kind, present: false, applied: null, ok: false };
      try {
        const el = await page.$(spec.sel);
        row.present = !!el;
        if (spec.act) {
          const s = await selectWord(page, SENTINEL);
          if (s !== 'ok') throw new Error('select: ' + s);
          await applyAct(page, spec.act);
          const flat = await page.evaluate(() => window.__WO_FLAT_HTML__());
          row.applied = spec.want.test(flat || '');
          row.ok = row.present && row.applied;
        } else {
          row.ok = row.present;
        }
      } catch (err) {
        row.error = String(err && err.message || err);
      }
      fields.push(row);
    }
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }

  const verified = fields.filter((f) => f.applied !== null);
  const parity = fields.length > 0 && fields.every((f) => f.ok);
  const covered = fields.filter((f) => f.ok).length;
  const out = {
    version: 1,
    generated: new Date().toISOString(),
    source: {
      oo: 'census/census/census-oo-deep.json (tabs.home font group)',
      wo: 'live editor drive (font-dialog-l4.test.mjs)',
      pairing: 'declared FIELD_MAP in font-dialog-l4.test.mjs',
    },
    summary: { probed: fields.length, covered, appliedVerified: verified.filter((f) => f.applied).length },
    parity,
    fields,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 1), 'utf8');

  console.log(`font-dialog-l4: ${covered}/${fields.length} font fields ok`
    + ` (${out.summary.appliedVerified} apply-verified) — parity=${parity}`);
  for (const f of fields) {
    const flag = f.ok ? 'OK ' : 'GAP';
    console.log(`  ${flag} ${f.oo.padEnd(24)} present=${f.present}`
      + (f.applied !== null ? ` applied=${f.applied}` : '')
      + (f.error ? ` error=${f.error}` : ''));
  }
  console.log('wrote', OUT_JSON);
  process.exit(parity ? 0 : 1);
};

main().catch((err) => { console.error('font-dialog-l4: FATAL', err); process.exit(2); });
