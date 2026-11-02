#!/usr/bin/env node
/* L4 FIDELITY probe: symbol-dialog field-level parity (task L4-002).
 *
 * OO's Insert tab → Symbol → "More symbols" opens the Symbol modal with the
 * fields Font + Range over a glyph grid and the buttons Symbols / Special
 * characters / Insert / Close. WO mirrors it as #symbol-dialog (opened by the
 * real ribbon button #btn-symbol): #symbol-font select, #symbol-range select
 * (Unicode block bounds in the option values), the #symbol-grid of
 * .symbol-btn glyph buttons and #btn-symbol-close. Clicking a glyph inserts
 * it at the saved caret (execCommand insertText) — WO's counterpart of OO's
 * pick-then-Insert flow.
 *
 * OO reference fields are MEASURED from the committed census
 * (census-oo-dialogs.json, dialog title "Symbol"), never hand-copied; the
 * OO->WO mapping below is the declared, auditable pairing. Per field:
 *   present  the WO control exists in the live dialog
 *   applied  driving it changes the dialog (grid font / block) or, for the
 *            insert/close actions, the dialog state / flat HTML
 * parity = every gated row present AND applied.
 *
 * Known button divergence (recorded, not gated — dialog-parity.py precedent):
 * OO's "Symbols"/"Special characters" tabs collapse into WO's single grid +
 * Range select; OO's "Insert" button maps to direct insert-on-click.
 *
 * Writes ledger/symbol-dialog-l4.json (merged by ledger/build.py as the
 * dialog.symbol-dialog.l4 row). Exit 1 on parity gap (loud, not silent).
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app in the server repo).
 * Run: node census/ledger/symbol-dialog-l4.test.mjs
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
const OUT_JSON = path.join(LEDGER_DIR, 'symbol-dialog-l4.json');
const OO_DIALOGS = path.join(CENSUS_DIR, 'census', 'census-oo-dialogs.json');

const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>symboldialog sentinel alpha text.</p>';
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

/* OO field label -> live WO probe. apply() drives the control and returns
 * whether the declared effect happened (dialog-internal or flat-HTML). */
const FIELD_MAP = {
  'font': {
    sel: '#symbol-font', kind: 'choice',
    apply: async (page) => {
      await page.selectOption('#symbol-font', 'Arial');
      await page.waitForTimeout(200);
      return page.evaluate(() => (document.getElementById('symbol-grid') || {}).style?.fontFamily || '');
    },
    want: (v) => /Arial/i.test(String(v)),
  },
  'range': {
    sel: '#symbol-range', kind: 'choice',
    apply: async (page) => {
      // 'Greek' = U+0391..U+03CE — the Ω (U+03A9) glyph must appear in the grid
      await page.selectOption('#symbol-range', '391-3ce');
      await page.waitForTimeout(200);
      return page.evaluate(() => Array.from(document.querySelectorAll('#symbol-grid .symbol-btn')).map((b) => b.textContent));
    },
    want: (glyphs) => Array.isArray(glyphs) && glyphs.includes('Ω'),
  },
};

/* #btn-symbol lives on the Insert ribbon tab (hidden while Home is
 * active) — activate the tab before every click. */
async function clickSymbolBtn(page) {
  const active = await page.$('.ribbon-tab[data-tab="insert"][aria-selected="true"]');
  if (!active) {
    await page.click('.ribbon-tab[data-tab="insert"]');
    await page.waitForTimeout(200);
  }
  await page.click('#btn-symbol');
  await page.waitForTimeout(200);
}

/* rows beyond the OO field list: the dialog surface + the action buttons'
 * WO counterparts (OO Insert → direct insert-on-click; OO Close → Close). */
async function probeSurfaceAndActions(page) {
  const rows = [];

  // surface: the real ribbon button must open the real dialog
  const open = { oo: 'Symbol dialog surface', sel: '#symbol-dialog.open', present: false, applied: null, ok: false };
  await clickSymbolBtn(page);
  open.present = !!(await page.$('#symbol-dialog.open'));
  open.applied = open.present;
  open.ok = open.present;
  rows.push(open);

  // insert (OO button "Insert"): click the Ω glyph -> dialog closes and the
  // symbol lands in the document (flat HTML) at the saved caret
  const ins = { oo: 'Insert (glyph click inserts at caret)', sel: '#symbol-grid .symbol-btn', present: false, applied: null, ok: false };
  try {
    // the surface row left the modal open — close it first (the overlay
    // intercepts pointer events while open)
    if (await page.$('#symbol-dialog.open')) {
      await page.click('#btn-symbol-close');
      await page.waitForTimeout(200);
    }
    // caret in the editor BEFORE opening the dialog is what the dialog saves
    const s = await selectWord(page, SENTINEL);
    if (s !== 'ok') throw new Error('select: ' + s);
    await clickSymbolBtn(page);
    // grid still on Greek from the Range field drive above (page.$ ignores
    // hasText — must use a locator)
    const glyph = page.locator('#symbol-grid .symbol-btn', { hasText: 'Ω' }).first();
    ins.present = (await glyph.count()) > 0;
    await glyph.click();
    await page.waitForTimeout(300);
    const flat = await page.evaluate(() => window.__WO_FLAT_HTML__());
    const closed = !(await page.$('#symbol-dialog.open'));
    ins.applied = /Ω/.test(flat || '') && closed;
    ins.ok = ins.present && ins.applied;
  } catch (err) {
    ins.error = String(err && err.message || err);
  }
  rows.push(ins);

  // close (OO button "Close")
  const close = { oo: 'Close', sel: '#btn-symbol-close', present: false, applied: null, ok: false };
  try {
    if (await page.$('#symbol-dialog.open')) {
      await page.click('#btn-symbol-close');
      await page.waitForTimeout(200);
    }
    await clickSymbolBtn(page);
    close.present = !!(await page.$('#symbol-dialog.open #btn-symbol-close'));
    await page.click('#btn-symbol-close');
    await page.waitForTimeout(200);
    close.applied = !(await page.$('#symbol-dialog.open'));
    close.ok = close.present && close.applied;
  } catch (err) {
    close.error = String(err && err.message || err);
  }
  rows.push(close);

  return rows;
}

/* OO reference: dialog "Symbol" fields from the committed census (deduped). */
function ooSymbolFields() {
  const d = JSON.parse(fs.readFileSync(OO_DIALOGS, 'utf8'));
  const seen = new Set();
  const out = [];
  for (const e of d.dialogs || []) {
    const dlg = e.dialog || {};
    if ((dlg.title || '') !== 'Symbol') continue;
    for (const f of dlg.fields || []) {
      const label = (f.label || '').trim();
      if (!label || seen.has(label.toLowerCase())) continue;
      if (!(label.toLowerCase() in FIELD_MAP)) continue; // not the field contract we probe
      seen.add(label.toLowerCase());
      out.push({ label, buttons: dlg.buttons || [] });
    }
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

/* -------------------------------- main -------------------------------- */
const main = async () => {
  const ooFields = ooSymbolFields();
  if (!ooFields.length) throw new Error('no OO Symbol dialog fields found in census-oo-dialogs.json');

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

    // OO fields first: drive Font then Range; the grid ends on Greek
    for (const { label } of ooFields) {
      const spec = FIELD_MAP[label.toLowerCase()];
      const row = { oo: label, sel: spec.sel, kind: spec.kind, present: false, applied: null, ok: false };
      try {
        // the dialog must be open to drive its fields
        if (!(await page.$('#symbol-dialog.open'))) {
          await clickSymbolBtn(page);
        }
        row.present = !!(await page.$(spec.sel));
        const val = await spec.apply(page);
        row.applied = spec.want(val);
        row.ok = row.present && row.applied;
      } catch (err) {
        row.error = String(err && err.message || err);
      }
      fields.push(row);
    }
    // close the dialog so the action rows start from a clean state; the
    // selects keep their values (Greek), so the reopened grid still has Ω
    if (await page.$('#symbol-dialog.open')) {
      await page.click('#btn-symbol-close');
      await page.waitForTimeout(200);
    }
    fields.push(...(await probeSurfaceAndActions(page)));
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
      oo: 'census/census/census-oo-dialogs.json (dialog: Symbol — fields Font, Range)',
      wo: 'live editor drive (symbol-dialog-l4.test.mjs)',
      pairing: 'declared FIELD_MAP in symbol-dialog-l4.test.mjs',
      buttonsNote: 'OO tabs Symbols/Special characters collapse into the WO grid + Range select; OO Insert = direct insert-on-glyph-click (dialog-parity.py precedent: buttons recorded, fields gate)',
    },
    summary: { probed: fields.length, covered, appliedVerified: verified.filter((f) => f.applied).length },
    parity,
    fields,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 1), 'utf8');

  console.log(`symbol-dialog-l4: ${covered}/${fields.length} symbol-dialog rows ok`
    + ` (${out.summary.appliedVerified} apply-verified) — parity=${parity}`);
  for (const f of fields) {
    const flag = f.ok ? 'OK ' : 'GAP';
    console.log(`  ${flag} ${f.oo.padEnd(36)} present=${f.present}`
      + (f.applied !== null ? ` applied=${f.applied}` : '')
      + (f.error ? ` error=${f.error}` : ''));
  }
  console.log('wrote', OUT_JSON);
  process.exit(parity ? 0 : 1);
};

main().catch((err) => { console.error('symbol-dialog-l4: FATAL', err); process.exit(2); });
