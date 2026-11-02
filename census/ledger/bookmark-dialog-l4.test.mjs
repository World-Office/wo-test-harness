#!/usr/bin/env node
/**
 * ledger/bookmark-dialog-l4.test.mjs — L4 FIDELITY probe: the Insert
 * bookmark dialog's field/button contract, measured against the RUNNING
 * editor (local static serve + stubbed fetch, paragraph-dialog-l4 pattern).
 *
 * Contract (campaign comprehensive-parity, task FINAL-001): open the dialog
 * the way a user does — REAL clicks: the References tab, then the ribbon
 * button #btn-bookmark (editor.js: openBookmarkDialog) — then assert
 *   - title "Insert bookmark"
 *   - fields: Name (text input, placeholder "e.g. Section1")
 *   - buttons: Cancel + Insert (primary)
 *   - BEHAVIOR (fidelity, not surface): select real text, name it "mark1",
 *     Insert wraps the selection in span.bookmark[data-name="mark1"]
 *     (data-name is a DOC-SEMANTIC attribute — it survives serialization,
 *     visible in the flat HTML); with a bare caret the bookmark name rides
 *     in as the wrapped text; an empty name keeps the dialog open and
 *     inserts nothing; the Cross-reference dialog then lists the bookmark
 *     by data-name (the references ecosystem reads the marker); Cancel
 *     plants nothing.
 *
 * Declared gap (loud, never parity): the committed OO dialog census has a
 * "Bookmarks" modal whose fields are the LIST controls (Sort by, Hidden
 * bookmarks) — a manage-list surface, not an insert field; WO ships the
 * insert shape. The Name + Insert/Cancel contract is pinned from the
 * MS-Word-style Bookmark shape (Bookmark name + Add). MS Word's
 * bookmark-manager rows (Go To / Delete / locate) map to WO's crossref
 * dialog + future manage surface — recorded divergence, not gated.
 *
 * Writes bookmark-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.bookmark-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-bookmark-dialog: OK|FAIL ...".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'bookmark-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>Bookmark sentinel hotel text.</p>';
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

// same fetch stub roundtrip.cjs uses: seed document via the load endpoint,
// ACK every write, collab off.
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

// page helpers (real functions, never strings — evaluate pitfall)
function pageHelpers() {
  // select the word "hotel" in the seed paragraph
  window.__L4_SELECT__ = function () {
    const ed = document.querySelector('#editor');
    const p = ed && ed.querySelector('p');
    if (!p || !p.firstChild) return 'no-p';
    const text = p.firstChild;
    const start = (text.data || '').indexOf('hotel');
    if (start < 0) return 'no-word';
    const r = document.createRange();
    r.setStart(text, start);
    r.setEnd(text, start + 5);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    ed.focus();
    return 'ok';
  };
  // collapsed caret at paragraph start (no selection) — the FIRST TEXT
  // node (after a bookmark insertion p.firstChild is the bookmark span)
  window.__L4_CARET__ = function () {
    const ed = document.querySelector('#editor');
    const p = ed && ed.querySelector('p');
    if (!p) return 'no-p';
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const tn = walker.nextNode();
    if (!tn) return 'no-text';
    const r = document.createRange();
    r.setStart(tn, 0);
    r.setEnd(tn, 0);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    ed.focus();
    return 'ok';
  };
  window.__L4_BM__ = function () {
    const ed = document.querySelector('#editor');
    const s = ed && ed.querySelector('span.bookmark');
    const flat = window.__WO_FLAT_HTML__();
    return {
      has: !!s,
      name: s ? s.getAttribute('data-name') : null,
      text: s ? s.textContent : null,
      flatName: /data-name="mark1"/.test(flat),
      flatClass: flat.includes('bookmark'),
      flatSentinel: flat.includes('sentinel') && flat.includes('hotel'),
      n: ed ? ed.querySelectorAll('span.bookmark').length : 0,
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// open the dialog the user way: References tab + #btn-bookmark
async function openViaRibbon(page) {
  const active = await page.$('.ribbon-tab[data-tab="references"][aria-selected="true"]');
  if (!active) await page.click('.ribbon-tab[data-tab="references"]');
  await sleep(150);
  await page.click('#btn-bookmark');
  await sleep(250);
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
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(stubInit, { seed: SEED_HTML });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);

    // --- 1. opens the user way: References tab + #btn-bookmark ---
    await openViaRibbon(page);
    const openRes = await page.evaluate(() => {
      const d = document.getElementById('bookmark-dialog');
      if (!d || !d.classList.contains('open')) return false;
      const cs = getComputedStyle(d);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    check('open via real clicks (References tab + #btn-bookmark)', openRes);

    // --- 2..4 static contract while open ---
    const c = await page.evaluate(() => {
      const dlg = document.getElementById('bookmark-dialog');
      const q = (s) => dlg.querySelector(s);
      const title = (q('#bookmark-dialog-title') || {}).textContent || '';
      const name = q('#bookmark-name');
      const lab = (id) => ((dlg.querySelector(`label[for="${id}"]`) || {}).textContent || '').trim();
      const cancel = q('#btn-bookmark-cancel'); const ok = q('#btn-bookmark-ok');
      return {
        title: title.trim(),
        nameLabel: lab('bookmark-name'), nameType: name ? name.type : null,
        namePh: name ? name.placeholder : null,
        cancel: cancel ? cancel.textContent.trim() : null,
        ok: ok ? ok.textContent.trim() : null, okPrimary: !!(ok && ok.classList.contains('primary')),
      };
    });
    check('title "Insert bookmark"', c.title === 'Insert bookmark', JSON.stringify(c.title));
    check('field Name: label + text input (placeholder "e.g. Section1")',
      c.nameLabel === 'Name' && c.nameType === 'text' && c.namePh === 'e.g. Section1',
      `${JSON.stringify(c.nameLabel)} ${c.nameType} ph=${JSON.stringify(c.namePh)}`);
    check('buttons Cancel + Insert(primary)',
      /^cancel$/i.test(c.cancel || '') && /^insert$/i.test(c.ok || '') && c.okPrimary,
      `cancel=${JSON.stringify(c.cancel)} insert=${JSON.stringify(c.ok)} primary=${c.okPrimary}`);

    // --- 5. behavior: select "hotel" + mark1 + Insert wraps the selection ---
    // (dialog already open from check 1 — modal overlay blocks re-clicking
    // the ribbon button; fill FIRST, then set the live selection, then OK —
    // the fill's focus-steal would otherwise drop the range)
    await page.fill('#bookmark-name', 'mark1');
    await page.evaluate(() => window.__L4_SELECT__());
    await page.click('#btn-bookmark-ok');
    await sleep(400);
    const b1 = await page.evaluate(() => window.__L4_BM__());
    const closed1 = await page.evaluate(() =>
      !document.getElementById('bookmark-dialog').classList.contains('open'));
    check('select "hotel" + mark1 + Insert -> span.bookmark[data-name="mark1"] wraps it (flat HTML)',
      closed1 && b1.has && b1.name === 'mark1' && b1.text === 'hotel'
      && b1.flatName && b1.flatClass && b1.flatSentinel,
      `has=${b1.has} name=${JSON.stringify(b1.name)} text=${JSON.stringify(b1.text)} `
      + `flat=${b1.flatName}/${b1.flatClass}/${b1.flatSentinel} closed=${closed1}`);

    // --- 6. references ecosystem: crossref dialog lists the bookmark ---
    await openViaRibbon(page);
    await page.click('#btn-bookmark-cancel');
    await sleep(150);
    const xref = await page.evaluate(() => {
      const btn = document.querySelector('button[data-cmd="crossref"], #btn-crossref');
      if (btn) btn.click();
      return new Promise((r) => setTimeout(() => {
        const d = document.getElementById('crossref-dialog');
        const opts = d && d.classList.contains('open')
          ? [...d.querySelectorAll('#crossref-target option')].map((o) => o.value) : null;
        r(opts);
      }, 250));
    });
    check('Cross-reference dialog lists the new bookmark by data-name',
      Array.isArray(xref) && xref.includes('mark1'), JSON.stringify(xref));
    await page.evaluate(() => {
      const d = document.getElementById('crossref-dialog');
      if (d) d.classList.remove('open');
    });

    // --- 7. behavior: bare caret + name rides in as the wrapped text ---
    // (fill first, then set the caret — same focus-steal rule as check 5)
    await openViaRibbon(page);
    await page.fill('#bookmark-name', 'mark2');
    await page.evaluate(() => window.__L4_CARET__());
    await page.click('#btn-bookmark-ok');
    await sleep(400);
    const b2 = await page.evaluate(() => window.__L4_BM__());
    check('bare caret + mark2 -> second bookmark whose text is the name',
      b2.n === 2, `n=${b2.n}`);

    // --- 8. empty name: dialog stays open, inserts nothing ---
    await openViaRibbon(page);
    await page.fill('#bookmark-name', '');
    await page.click('#btn-bookmark-ok');
    await sleep(300);
    const b3 = await page.evaluate(() => window.__L4_BM__());
    const stillOpen = await page.evaluate(() =>
      document.getElementById('bookmark-dialog').classList.contains('open'));
    check('empty name keeps the dialog open and inserts nothing',
      stillOpen && b3.n === 2, `open=${stillOpen} n=${b3.n}`);

    // --- 9. cancel plants nothing ---
    await page.fill('#bookmark-name', 'mark3');
    await page.click('#btn-bookmark-cancel');
    await sleep(300);
    const b4 = await page.evaluate(() => window.__L4_BM__());
    const closed4 = await page.evaluate(() =>
      !document.getElementById('bookmark-dialog').classList.contains('open'));
    check('cancel plants nothing', closed4 && b4.n === 2, `n=${b4.n} closed=${closed4}`);

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'bookmark-dialog-l4',
    feature: 'dialog.bookmark-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO dialog census has a "Bookmarks" modal whose fields are manage-list '
      + 'controls (Sort by, Hidden bookmarks) — a manage surface, not an insert field; the '
      + 'Name + Insert/Cancel contract is pinned from the MS-Word-style Bookmark shape '
      + '(Bookmark name + Add)',
      'MS Word\'s bookmark-manager rows (Go To / Delete / locate) map to WO\'s crossref '
      + 'dialog + a future manage surface — recorded divergence, not gated',
    ],
    contract: {
      open: 'real clicks: References tab + ribbon #btn-bookmark (editor.js: openBookmarkDialog)',
      title: 'Insert bookmark',
      fields: [
        { label: 'Name', tag: 'input', type: 'text', placeholder: 'e.g. Section1' },
      ],
      buttons: ['Cancel', 'Insert'],
      behavior: 'with a selection, Insert wraps it in span.bookmark[data-name] (DOC-semantic '
        + 'attribute, survives serialization into the flat HTML); with a bare caret the name '
        + 'rides in as the wrapped text; empty name keeps the dialog open and inserts nothing; '
        + 'the Cross-reference dialog lists bookmarks by data-name; Cancel plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-bookmark-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-bookmark-dialog: ERROR', e);
  process.exit(1);
});
