#!/usr/bin/node
/* L4 FIDELITY probe: multi-dialog FIELD-level parity (campaign FINAL-001).
 *
 * Same ladder as link-dialog-l4.test.mjs / font-dialog-l4.test.mjs, but for
 * the dialogs whose OO counterpart EXISTS as a measured modal in
 * census-oo-interactions.json (tab/Label rows below) yet never got an
 * L4 probe: each probe opens the REAL WO dialog via the real user route,
 * extracts its field contract (same extraction as census-wo-dialogs.cjs),
 * joins it against the DECLARED OO field contract, and functionally proves
 * the acting fields where that is possible offline.
 *
 * OO contract sources (honest, auditable):
 *   - OO modal EXISTENCE is measured: census/census-oo-interactions.json
 *     rows (tab + Label -> modal) cited per probe below.
 *   - OO FIELD lists are declared here (pinned, ai-contracts.py PROBES
 *     spirit): the OO rig dialog census cannot reach these modals (its
 *     walker only walks ribbon controls that render extractable OO modals
 *     — cf. census-oo-dialogs.json's 18 entries). A declared contract
 *     flips deliberately, WITH this row, never silently.
 *
 * Writes ledger/dialog-l4.json (merged by ledger/build.py as one
 * `dialog.<id>.l4` row per probe). Exit code: 0 = every probe measured
 * (parity may be false — gaps are reported, not hidden); 1 = one or more
 * probes broken (dialog never opened / editor dead) — loud, never a stub.
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app).
 */
'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const CENSUS_DIR = path.join(LEDGER_DIR, '..');
const OUT = path.join(LEDGER_DIR, 'dialog-l4.json');

const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';

const SEED_HTML = '<p>l4 multi probe sentinel alpha text and more words here.</p>';
const BOOT_MS = 2500;

/* Declared OO field contracts. "oo_modal" cites the MEASURED OO modal row
 * (census-oo-interactions.json: tab + Label -> modal). "aliases" are the
 * auditable label equivalences used by the join (OO name -> WO label
 * fragment), kept in the same spirit as dialog-parity.py FIELD_ALIASES. */
const PROBES = [
  {
    feature: 'dialog.equation-dialog.l4',
    dialog: 'equation-dialog',
    cluster: 'insert',
    oo_modal: 'insert/Equation -> modal (census-oo-interactions.json)',
    oo_fields: ['Linear notation', 'Preview'],
    aliases: { 'linear notation': 'linear notation', preview: 'preview' },
    open: { tab: 'insert', click: '#btn-equation' },
    functional: 'equation',
  },
  {
    feature: 'dialog.pagecolor-dialog.l4',
    dialog: 'pagecolor-dialog',
    cluster: 'page',
    oo_modal: 'layout/PageColor -> modal (census-oo-interactions.json)',
    oo_fields: ['Swatches', 'Custom color', 'R', 'G', 'B', 'Hex'],
    aliases: { hex: 'hex' },
    open: { tab: 'layout', click: '#pagecolor' },
    functional: 'pagecolor',
  },
  {
    feature: 'dialog.chart-dialog.l4',
    dialog: 'chart-dialog',
    cluster: 'chart',
    oo_modal: 'insert/Chart -> modal (census-oo-interactions.json)',
    oo_fields: ['Chart type', 'Data', 'Preview'],
    aliases: {},
    open: { tab: 'insert', pre: '#btn-insert-more', click: '#btn-chart' },
    functional: 'chart',
  },
  {
    feature: 'dialog.comment-dialog.l4',
    dialog: 'comment-dialog',
    cluster: 'review',
    oo_modal: 'insert/Comment -> modal (census-oo-interactions.json)',
    oo_fields: ['Comment'],
    aliases: {},
    open: { tab: 'collaboration', click: '#btn-comment', selectText: true },
    functional: 'comment',
  },
  {
    feature: 'dialog.compare-dialog.l4',
    dialog: 'compare-dialog',
    cluster: 'collab',
    oo_modal: 'collaboration/Compare -> modal (census-oo-interactions.json)',
    oo_fields: ['Select document to compare'],
    aliases: {},
    open: { tab: 'collaboration', click: '[data-cmd="compareVersion"]' },
    functional: null, // document list comes from the server — not provable offline
  },
  {
    feature: 'dialog.combine-dialog.l4',
    dialog: 'combine-dialog',
    cluster: 'collab',
    oo_modal: 'collaboration/Combine -> modal (census-oo-interactions.json)',
    oo_fields: ['Select documents to combine'],
    aliases: {},
    open: { tab: 'collaboration', click: '[data-cmd="combineRevisions"]' },
    functional: null, // document list comes from the server — not provable offline
  },
  {
    feature: 'dialog.textfromfile-dialog.l4',
    dialog: 'textfromfile-dialog',
    cluster: 'insert',
    oo_modal: 'insert/Text fromFile -> modal (census-oo-interactions.json)',
    oo_fields: ['Choose file'],
    aliases: { 'choose file': 'choose file' },
    open: { tab: 'insert', click: '#btn-textfile' },
    functional: 'textfromfile',
  },
  {
    feature: 'dialog.field-dialog.l4',
    dialog: 'field-dialog',
    cluster: 'insert',
    oo_modal: 'insert/Field -> modal (census-oo-interactions.json)',
    oo_fields: ['Field type'],
    aliases: {},
    open: { tab: 'references', click: '#btn-field' },
    functional: 'field',
  },
  {
    feature: 'dialog.speech-dialog.l4',
    dialog: 'speech-dialog',
    cluster: 'view',
    oo_modal: 'plugins/Speech -> modal (census-oo-interactions.json)',
    oo_fields: ['Voice', 'Speed', 'Pitch'],
    aliases: {},
    open: { tab: 'view', pre: '#btn-speech', click: '#btn-readaloud' },
    functional: null, // TTS side effects are not observable offline
  },
];

function loadPlaywright() {
  for (const c of [path.join(CENSUS_DIR, 'node_modules', 'playwright')]) {
    try { return require(c); } catch (_) { /* try next */ }
  }
  const { execSync } = require('node:child_process');
  try {
    return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch (_) { /* fallthrough */ }
  throw new Error('playwright not found (census/node_modules nor global)');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function startStaticServer(port, dir) {
  const child = spawn('/usr/bin/python3',
    ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  child.stderr.on('data', (d) => { err += d.toString(); });
  child._errbuf = () => err;
  return child;
}

function stubInit(ctx) {
  localStorage.clear();
  window.__COLLAB__ = false;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || 'GET';
    if (method === 'GET' && url.includes('/api/documents/') && url.includes('/html')) {
      return Promise.resolve(new Response(JSON.stringify({ html: ctx.seed, name: 'demo.docx' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  };
  navigator.sendBeacon = () => true;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ').trim();

/* per-dialog functional proofs (page.evaluate-able expressions are not
 * enough — these are REAL functions passed to evaluate) */
async function functionalCheck(page, kind) {
  if (kind === 'equation') {
    await page.fill('#equation-input', 'x = (-b + sqrt(b^2)) / (2a)');
    await page.waitForTimeout(200); // live preview refresh (input handler)
    const previewed = await page.evaluate(() =>
      (document.getElementById('equation-preview') || {}).innerHTML || '');
    await page.click('#btn-equation-ok', { timeout: 3000 });
    await page.waitForTimeout(300);
    const inserted = await page.evaluate(() =>
      !!document.querySelector('#editor svg, #editor img, #editor .object'));
    return { ok: previewed.trim().length > 0 && inserted, detail: `preview=${previewed.trim().length > 0} inserted=${inserted}` };
  }
  if (kind === 'pagecolor') {
    await page.fill('#pagecolor-hex', '#FEF3C7');
    await page.dispatchEvent('#pagecolor-hex', 'input');
    await page.waitForTimeout(150);
    await page.click('#btn-pagecolor-ok', { timeout: 3000 });
    await page.waitForTimeout(200);
    const paper = await page.evaluate(() => {
      const ed = document.getElementById('editor');
      return (ed && ed.style.getPropertyValue('--paper')) || '';
    });
    return { ok: paper.toLowerCase() === '#fef3c7', detail: `--paper=${paper}` };
  }
  if (kind === 'chart') {
    await page.fill('#chart-title', 'L4 probe chart');
    await page.waitForTimeout(200); // live preview refresh
    const previewed = await page.evaluate(() =>
      (document.getElementById('chart-preview') || {}).innerHTML || '');
    await page.click('#btn-chart-ok', { timeout: 3000 });
    await page.waitForTimeout(300);
    const inserted = await page.evaluate(() =>
      !!document.querySelector('#editor svg, #editor img, #editor .object'));
    return { ok: previewed.trim().length > 0 && inserted, detail: `preview=${previewed.trim().length > 0} inserted=${inserted}` };
  }
  if (kind === 'comment') {
    await page.fill('#comment-body', 'l4 probe comment');
    await page.click('#btn-comment-ok', { timeout: 3000 });
    await page.waitForTimeout(300);
    const ok = await page.evaluate(() =>
      !!document.querySelector('#editor .comment, #comments-panel .comment'));
    return { ok, detail: 'comment span/panel after insert' };
  }
  if (kind === 'textfromfile') {
    const tmp = path.join(os.tmpdir(), 'l4-probe-insert.txt');
    fs.writeFileSync(tmp, 'L4PROBE text-from-file sentinel\n');
    await page.setInputFiles('#textfromfile-input', tmp);
    await page.waitForTimeout(200);
    await page.click('#btn-textfromfile-insert', { timeout: 3000 });
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() =>
      (document.getElementById('editor') || {}).innerText.includes('L4PROBE text-from-file sentinel'));
    return { ok, detail: 'file text inserted into #editor' };
  }
  if (kind === 'field') {
    await page.selectOption('#field-type', 'PAGE');
    // insertHTML needs a caret in #editor (dialog keeps focus; place one)
    await page.evaluate(() => {
      const ed = document.getElementById('editor');
      ed.focus();
      const sel = window.getSelection();
      const p = ed.querySelector('p');
      const range = document.createRange();
      if (p) { range.selectNodeContents(p); range.collapse(false); }
      else { range.selectNodeContents(ed); range.collapse(false); }
      sel.removeAllRanges(); sel.addRange(range);
    });
    await page.click('#btn-field-ok', { timeout: 3000 });
    await page.waitForTimeout(300);
    // the editor's normalizer rewrites the inserted field span (class/
    // data-field are stripped, value survives) — assert the VALUE landed
    // and the editor confirmed the insert.
    const r = await page.evaluate(() => {
      const ed = document.getElementById('editor');
      const status = ((document.getElementById('status') || {}).textContent) || '';
      const span = ed.querySelector('p span');
      return { landed: !!span && span.textContent.trim() === '1', status };
    });
    return { ok: r.landed, detail: `PAGE field value '1' in #editor (status: ${r.status})` };
  }
  return null;
}

(async () => {
  const results = [];
  const PORT = await freePort();
  const srv = startStaticServer(PORT, EDITOR_DIR);
  const browser = loadPlaywright().chromium.launch({ args: ['--no-sandbox'] });
  try {
    const b = await browser;
    const ctx = await b.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(stubInit, { seed: SEED_HTML });
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);

    for (const spec of PROBES) {
      const out = {
        feature: spec.feature,
        dialog: spec.dialog,
        oo_modal: spec.oo_modal,
        oo_fields: spec.oo_fields,
        openedBy: null, wo: null,
        covered: 0, total: spec.oo_fields.length, missing: [], mapping: {},
        parity: false, functional: null, error: null,
      };
      try {
        // 1) REAL user route: activate the dialog's ribbon tab, then click
        await page.click(`.ribbon-tab[data-tab="${spec.open.tab}"]`, { timeout: 5000 });
        await page.waitForTimeout(200);
        if (spec.open.selectText) {
          // a comment needs a range: select some text first (real user flow)
          await page.evaluate(() => {
            const ed = document.getElementById('editor');
            ed.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            const p = ed.querySelector('p');
            const tn = p && p.firstChild;
            if (tn && tn.nodeType === Node.TEXT_NODE && tn.length >= 5) {
              range.setStart(tn, 0); range.setEnd(tn, 5);
            } else if (p) { range.selectNodeContents(p); }
            else { range.selectNodeContents(ed); }
            sel.removeAllRanges(); sel.addRange(range);
          });
        }
        if (spec.open.pre) {
          await page.click(spec.open.pre, { timeout: 5000 });
          await page.waitForTimeout(250); // menu-list unhide
        }
        await page.click(spec.open.click, { timeout: 5000 });
        await page.waitForTimeout(300);
        const opened = await page.evaluate((id) => {
          const d = document.getElementById(id);
          return !!d && d.classList.contains('open')
            && (getComputedStyle(d).display || '') !== 'none';
        }, spec.dialog);
        if (!opened) throw new Error(spec.dialog + ' did not open via ' + spec.open.click);
        out.openedBy = 'click ' + spec.open.click + ' (tab ' + spec.open.tab + (spec.open.pre ? ', via ' + spec.open.pre : '') + ')';

        // 2) measure the field contract (same extraction as census-wo-dialogs.cjs)
        out.wo = await page.evaluate((id) => {
          const el = document.getElementById(id);
          const titleEl = el.querySelector("[id$='-title']") || el.querySelector('h1,h2,h3');
          const fields = [];
          for (const lab of el.querySelectorAll('label')) {
            const text = (lab.textContent || '').trim();
            if (!text) continue;
            const idFor = lab.getAttribute('for');
            const ctrl = idFor ? el.querySelector('#' + CSS.escape(idFor)) : null;
            fields.push({
              label: text,
              tag: ctrl ? ctrl.tagName.toLowerCase() : 'text',
              type: ctrl ? (ctrl.getAttribute('type') || 'text') : 'text',
            });
          }
          const buttons = [...el.querySelectorAll('button')]
            .filter((bn) => bn.offsetParent !== null)
            .map((bn) => (bn.textContent || '').trim()).filter(Boolean);
          return { id, title: (titleEl && titleEl.textContent || '').trim(), fields, buttons };
        }, spec.dialog);

        // 3) OO field join (declared contract): alias -> exact -> containment
        for (const want of spec.oo_fields) {
          const alias = norm(spec.aliases[want.toLowerCase()] || want);
          const hit = out.wo.fields.find((f) => norm(f.label) === alias)
            || out.wo.fields.find((f) =>
              alias.length >= 4 && (norm(f.label).includes(alias) || alias.includes(norm(f.label))));
          if (hit) { out.covered += 1; out.mapping[want] = hit.label; }
          else out.missing.push(want);
        }
        out.parity = out.missing.length === 0;

        // 4) functional proof (where provable offline)
        if (spec.functional) {
          const r = await functionalCheck(page, spec.functional);
          out.functional = r ? r.ok : null;
          out.functional_detail = r ? r.detail : null;
        } else {
          out.functional_detail = 'not provable offline (needs server-side document list)';
        }

        // close whatever state we opened (dialog or applied side effects) —
        // ALWAYS, also on the error path below, or an open overlay intercepts
        // the next probe's ribbon clicks (this cascade bit the first run).
        const closeIt = () => page.evaluate((id) => {
          const d = document.getElementById(id);
          if (d) d.classList.remove('open');
        }, spec.dialog).catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});
        await closeIt();
        await page.waitForTimeout(150);
      } catch (e) {
        out.error = String(e && e.message || e).slice(0, 300);
        await page.keyboard.press('Escape').catch(() => {});
        await page.evaluate((id) => {
          const d = document.getElementById(id);
          if (d) d.classList.remove('open');
        }, spec.dialog).catch(() => {});
        await page.waitForTimeout(150);
      }
      results.push(out);
      const flag = out.error ? 'BROKEN' : out.parity ? 'PARITY' : 'GAP';
      console.log(`dialog-l4: ${flag} ${out.feature} ${out.covered}/${out.total}`
        + (out.missing.length ? ` missing=[${out.missing.join(', ')}]` : '')
        + (out.error ? ` error=${out.error.slice(0, 80)}` : ` functional=${out.functional}`));
    }

    await ctx.close();
    await b.close();
  } catch (e) {
    // editor-level failure: report every probe as broken, never silently
    for (const spec of PROBES) {
      if (!results.find((r) => r.feature === spec.feature)) {
        results.push({
          feature: spec.feature, dialog: spec.dialog, oo_modal: spec.oo_modal,
          oo_fields: spec.oo_fields, openedBy: null, wo: null,
          covered: 0, total: spec.oo_fields.length, missing: [...spec.oo_fields],
          parity: false, functional: null, error: String(e && e.message || e).slice(0, 300),
        });
      }
    }
  } finally {
    if (srv.kill) srv.kill('SIGTERM');
  }

  const broken = results.filter((r) => r.error).length;
  fs.writeFileSync(OUT, JSON.stringify({
    probe: 'ledger/dialog-l4.test.mjs',
    source: {
      oo_modal_existence: 'census/census-oo-interactions.json (measured)',
      oo_fields: 'declared per-probe (pinned in PROBES; rig dialog census cannot reach these modals)',
    },
    summary: { probed: results.length, parity: results.filter((r) => r.parity).length, broken },
    results,
    capturedAt: new Date().toISOString(),
  }, null, 1) + '\n');
  process.exit(broken ? 1 : 0);
})();
