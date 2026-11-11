#!/usr/bin/env node
/**
 * ledger/combine-dialog-l4.test.mjs — L4 FIDELITY probe: the Combine
 * Documents dialog (campaign L4-gold FXG-F: batch parity -> census gold).
 *
 * The row dialog.combine-dialog.l4 so far stood on the FINAL-001 batch
 * probe (dialog-l4.test.mjs: field parity only, functional=null "needs
 * server-side document list"). This dedicated probe earns the L4 by
 * DRIVING the dialog in the running editor (caption-dialog-l4 pattern:
 * local static serve + stubbed fetch, REAL clicks):
 *
 * Census contract (honest, auditable):
 *   - OO modal EXISTENCE is measured: census/census-oo-interactions.json
 *     row "collaboration/Combine -> modal" (the OO rig captured the modal
 *     mask only — controls:0 — so no field-level OO capture exists).
 *   - The OO field contract is pinned here (PROBES spirit): a multi
 *     document picker, "Select documents to combine"; it flips deliberately
 *     WITH this probe, never silently.
 *
 * Asserted (deep, not surface):
 *   - opens via real clicks: Collaboration tab + Combine (combineRevisions)
 *   - title "Combine Documents"; field is a MULTIPLE select (vs the
 *     single-picker Compare dialog — the combine semantics WO-17)
 *   - buttons Cancel + Combine (primary)
 *   - the document list loads from GET /api/documents and FILTERS the
 *     current document out of the picker
 *   - Combine without a selection keeps the dialog open with a loud error
 *     and mutates nothing
 *   - multi-select + Combine closes the dialog, fetches
 *     combine?docs=<id>&docs=<id> and loads the merged HTML into the editor
 *   - reopen + Cancel closes and plants nothing
 *
 * Writes combine-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.combine-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-combine-dialog: OK|FAIL n/n checks".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'combine-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>l4 combine probe sentinel paragraph on the current document.</p>';
const COMBINE_HTML = '<p>l4 combine merge sentinel — applied combine result.</p>';
const BOOT_MS = 2200;

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  return !!ok;
};

async function loadPlaywright() {
  const candidates = [path.join(LEDGER_DIR, '..', 'node_modules', 'playwright')];
  try {
    const { execSync } = await import('node:child_process');
    candidates.push(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch (_) { /* global npm optional */ }
  for (const c of candidates) {
    try { return await import(pathToFileURL(path.join(c, 'index.mjs')).href); } catch (_) { /* next */ }
  }
  throw new Error('playwright not found (census/node_modules nor global)');
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
  srv.on('error', reject);
});

function startStaticServer(port, dir) {
  return spawn('/usr/bin/python3', ['-m', 'http.server', String(port),
    '--bind', '127.0.0.1', '--directory', dir], { stdio: ['ignore', 'ignore', 'pipe'] });
}

function stubInit(ctx) {
  localStorage.clear();
  window.__COLLAB__ = false;
  window.__FETCH_URLS__ = [];
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || 'GET';
    window.__FETCH_URLS__.push(method + ' ' + url);
    const json = (obj) => Promise.resolve(new Response(JSON.stringify(obj), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    if (method === 'GET' && url.includes('/api/documents/') && url.includes('/html')) {
      return json({ html: ctx.seed, name: 'demo.docx' });
    }
    if (method === 'GET' && url.includes('/combine?')) {
      return json({ html: ctx.combineHtml });
    }
    if (method === 'GET' && /\/api\/documents$/.test(url)) {
      // current document (demo.docx — wo-bridge default) FIRST — the picker
      // must filter it out of the combine list
      return json([
        { id: 'demo.docx', name: 'demo.docx', size: 123 },
        { id: 'alpha-l4.docx', name: 'alpha-l4.docx', size: 456 },
        { id: 'beta-l4.docx', name: 'beta-l4.docx', size: 789 },
      ]);
    }
    return json({ ok: true });
  };
  navigator.sendBeacon = () => true;
}

function pageHelpers() {
  window.__L4_COMBINE__ = function () {
    const d = document.getElementById('combine-dialog');
    const sel = document.getElementById('combine-document-select');
    const cs = d ? getComputedStyle(d) : null;
    return {
      open: !!d && d.classList.contains('open') && cs.display !== 'none' && cs.visibility !== 'hidden',
      multiple: sel ? sel.multiple : null,
      options: sel ? [...sel.options].map((o) => ({ value: o.value, text: o.textContent })) : [],
      error: (document.getElementById('combine-error') || {}).textContent || '',
      editor: (document.getElementById('editor') || {}).innerText || '',
      fetches: window.__FETCH_URLS__ || [],
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="collaboration"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="collaboration"]');
  await sleep(150);
  await page.evaluate(() => {
    const btn = document.querySelector('[data-cmd="combineRevisions"]');
    if (btn) btn.click();
  });
  await sleep(350);
}

async function main() {
  if (!fs.existsSync(path.join(EDITOR_DIR, 'index.html'))) {
    throw new Error(`editor dir missing index.html: ${EDITOR_DIR} (set WO_EDITOR_DIR)`);
  }
  const port = await freePort();
  const srv = startStaticServer(port, EDITOR_DIR);
  await sleep(500);
  const base = `http://127.0.0.1:${port}`;
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(stubInit, { seed: SEED_HTML, combineHtml: COMBINE_HTML });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);

    // --- 1. opens the user way: Collaboration tab + Combine ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => window.__L4_COMBINE__().open);
    check('open via real clicks (Collaboration tab + Combine cmd)', openRes);

    // --- 2..4 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('combine-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#combine-dialog-title') || {}).textContent || '';
      const sel = q('#combine-document-select');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-combine-cancel'); const apply = q('#btn-combine-apply');
      return {
        title: title.trim(),
        lab: lab('combine-document-select'), tag: sel ? sel.tagName.toLowerCase() : null,
        multiple: sel ? sel.multiple : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        apply: apply ? apply.textContent.trim() : null,
        applyPrimary: !!(apply && apply.classList.contains('primary')),
      };
    });
    check('title "Combine Documents"', c.title === 'Combine Documents', JSON.stringify(c.title));
    check('field Select documents to combine: MULTIPLE select (vs Compare single picker)',
      c.lab === 'Select documents to combine' && c.tag === 'select' && c.multiple === true,
      `${JSON.stringify(c.lab)} tag=${c.tag} multiple=${c.multiple}`);
    check('buttons Cancel + Combine(primary)',
      /^cancel$/i.test(c.cancel || '') && /^combine$/i.test(c.apply || '') && c.applyPrimary,
      `cancel=${JSON.stringify(c.cancel)} apply=${JSON.stringify(c.apply)} primary=${c.applyPrimary}`);

    // --- 5. document list loads, current document filtered ---
    await sleep(300); // loadCombineDocuments() resolves after open
    const list = await page.evaluate(() => window.__L4_COMBINE__().options);
    const vals = list.map((o) => o.value);
    check('document list loads from /api/documents with the current document filtered',
      vals.includes('alpha-l4.docx') && vals.includes('beta-l4.docx') && !vals.includes('demo.docx'),
      `options=${JSON.stringify(vals)}`);

    // --- 6. Combine without selection -> loud error, nothing applied ---
    const before = await page.evaluate(() => window.__L4_COMBINE__().editor);
    await page.click('#btn-combine-apply');
    await sleep(300);
    const err = await page.evaluate(() => window.__L4_COMBINE__());
    check('Combine without selection -> loud error, dialog stays open, doc untouched',
      err.open && /select at least one document/i.test(err.error) && err.editor === before,
      `open=${err.open} error=${JSON.stringify(err.error)} docUnchanged=${err.editor === before}`);

    // --- 7. multi-select + Combine -> merged HTML loads into the editor ---
    await page.selectOption('#combine-document-select', ['alpha-l4.docx', 'beta-l4.docx']);
    await page.click('#btn-combine-apply');
    await sleep(600);
    const applied = await page.evaluate(() => window.__L4_COMBINE__());
    check('multi-select + Combine -> dialog closes, combine?docs=<id>&docs=<id> fetched, merged HTML in editor',
      !applied.open
        && applied.fetches.some((u) => u.includes('/combine?')
          && u.includes('docs=alpha-l4.docx') && u.includes('docs=beta-l4.docx'))
        && applied.editor.includes('l4 combine merge sentinel'),
      `closed=${!applied.open} bothDocs=${applied.fetches.some((u) => u.includes('/combine?'))} `
        + `sentinel=${applied.editor.includes('l4 combine merge sentinel')}`);

    // --- 8. reopen + Cancel plants nothing ---
    await openViaRibbon(page);
    const preCancel = await page.evaluate(() => window.__L4_COMBINE__().editor);
    await page.click('#btn-combine-cancel');
    await sleep(300);
    const after = await page.evaluate(() => window.__L4_COMBINE__());
    check('reopen + Cancel closes and plants nothing',
      !after.open && after.editor === preCancel,
      `closed=${!after.open} docUnchanged=${after.editor === preCancel}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'combine-dialog-l4',
    feature: 'dialog.combine-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO interaction census proves the Combine modal exists '
      + '(collaboration/Combine -> modal, controls:0 — the OO rig captured the modal '
      + 'mask, not fields); the OO field contract is pinned from the combine shape '
      + '(multi document picker) and flips deliberately with this probe',
      'WO applies the docserver /combine merged HTML as the live document '
      + '(loadDocumentHTML); OO merges revisions into a tracked-changes review '
      + 'document — the offline probe proves the multi-picker + fetch + apply '
      + 'contract against a stubbed docserver',
    ],
    contract: {
      open: 'real clicks: Collaboration tab + Combine cmd (editor.js: combineRevisions -> openCombineDialog)',
      title: 'Combine Documents',
      fields: [
        { label: 'Select documents to combine', tag: 'select', type: 'select', multiple: true,
          note: 'options load from GET /api/documents; the current document is filtered out' },
      ],
      buttons: ['Cancel', 'Combine (primary)'],
      behavior: 'Combine without a selection keeps the dialog open with a loud error; multi-select + '
        + 'Combine fetches combine?docs=<id>&docs=<id> and loads the merged HTML into the editor; '
        + 'Cancel closes and plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-combine-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-combine-dialog: ERROR', e);
  process.exit(1);
});
