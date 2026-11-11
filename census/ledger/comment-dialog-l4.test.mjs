#!/usr/bin/env node
/**
 * ledger/comment-dialog-l4.test.mjs — L4 FIDELITY probe: the Add comment
 * dialog (campaign L4-gold FXG-G: batch parity -> census gold).
 *
 * The row dialog.comment-dialog.l4 so far stood on the FINAL-001 batch
 * probe (dialog-l4.test.mjs: field parity + functional "comment span/panel
 * after insert"). This dedicated probe earns the L4 by DRIVING the dialog
 * in the running editor (compare-dialog-l4 pattern: local static serve +
 * stubbed fetch, REAL clicks):
 *
 * Census contract (honest, auditable):
 *   - OO modal EXISTENCE is measured: census/census-oo-interactions.json
 *     row "insert/Comment -> modal" (the OO rig captured the trigger's
 *     dropdown — 87 controls — not a field-level dialog capture).
 *   - The OO field contract is pinned here + in the batch PROBES dict
 *     (Comment); it flips deliberately WITH this probe, never silently.
 *
 * Asserted (deep, not surface):
 *   - opens via real clicks: Collaboration tab + #btn-comment
 *     (openCommentDialog at the current selection)
 *   - title "Add comment"; field Comment is a textarea (label for=
 *     #comment-body), body starts EMPTY on every open
 *   - buttons Cancel + Comment (primary)
 *   - Comment + OK wraps the selected word in span.comment carrying
 *     data-id (UUID), data-author (TRACK_AUTHOR) and the typed body in
 *     data-comment
 *   - the comments panel opens and lists the comment text
 *   - Ctrl+Enter in the textarea confirms a second comment (the wired
 *     keyboard path, not only the button)
 *   - both comments carry unique data-ids and both are listed
 *   - Cancel closes and plants nothing; a reopened dialog starts empty
 *
 * Writes comment-dialog-l4.json next to this script (merged by
 * ledger/build.py into row dialog.comment-dialog.l4; level 4 only when
 * every check passed). Exit code 0 iff ok. Final stdout line:
 * "l4-comment-dialog: OK|FAIL n/n checks".
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app, same as roundtrip.cjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(LEDGER_DIR, 'comment-dialog-l4.json');
const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const SEED_HTML = '<p>alpha bravo charlie delta echo foxtrot</p>';
const WORD_ONE = 'bravo';
const WORD_TWO = 'delta';
const BODY_ONE = 'l4 probe: tighten this wording';
const BODY_TWO = 'l4 probe: second thread via Ctrl+Enter';
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

function pageHelpers() {
  window.__L4_SELECT_WORD__ = function (word) {
    const editor = document.getElementById('editor');
    editor.focus();
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const i = (n.textContent || '').indexOf(word);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + word.length);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        return true;
      }
    }
    return false;
  };
  window.__L4_COMMENT__ = function () {
    const d = document.getElementById('comment-dialog');
    const cs = d ? getComputedStyle(d) : null;
    const dlg = d || document;
    const q = (s) => dlg.querySelector(s);
    const body = q('#comment-body');
    const lab = (dlg.querySelector('label[for="comment-body"]') || {}).textContent || '';
    const panel = document.getElementById('comments-panel');
    return {
      open: !!d && d.classList.contains('open') && cs.display !== 'none' && cs.visibility !== 'hidden',
      title: ((q('#comment-dialog-title') || {}).textContent || '').trim(),
      label: lab.trim(),
      tag: body ? body.tagName.toLowerCase() : null,
      bodyValue: body ? body.value : null,
      cancel: ((q('#btn-comment-cancel') || {}).textContent || '').trim(),
      ok: ((q('#btn-comment-ok') || {}).textContent || '').trim(),
      okPrimary: !!(q('#btn-comment-ok') && q('#btn-comment-ok').classList.contains('primary')),
      spans: [...(document.getElementById('editor') || { querySelectorAll: () => [] })
        .querySelectorAll('span.comment')].map((s) => ({
        id: s.getAttribute('data-id') || '',
        author: s.getAttribute('data-author') || '',
        comment: s.getAttribute('data-comment') || '',
        text: s.textContent || '',
      })),
      panelHidden: panel ? !!panel.hidden : null,
      panelItems: [...(document.getElementById('comments-list') || { querySelectorAll: () => [] })
        .querySelectorAll('.review-item .review-text')].map((el) => el.textContent.trim()),
      status: ((document.getElementById('status') || {}).textContent || '').trim(),
    };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openViaRibbon(page) {
  // Always click the tab (even when active): the tab activation resets the
  // dialog bookkeeping exactly as a user returning to the tab would.
  await page.click('.ribbon-tab[data-tab="collaboration"]');
  await sleep(150);
  await page.click('#btn-comment');
  await sleep(350);
}

const uuidish = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');

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
    await page.addInitScript(stubInit, { seed: SEED_HTML });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#editor', { timeout: 20000 });
    await page.waitForTimeout(BOOT_MS);
    await page.evaluate(pageHelpers);

    // --- 1. opens the user way: Collaboration tab + #btn-comment ---
    await page.evaluate((w) => window.__L4_SELECT_WORD__(w), WORD_ONE);
    await sleep(250); // let the selection settle in the focused editor before the click
    await openViaRibbon(page);
    const c = await page.evaluate(() => window.__L4_COMMENT__());
    check('open via real clicks (Collaboration tab + #btn-comment)', c.open);

    // --- 2..3 static contract while open ---
    check('title "Add comment"; field Comment is a textarea', c.title === 'Add comment'
        && c.label === 'Comment' && c.tag === 'textarea',
      `title=${JSON.stringify(c.title)} label=${JSON.stringify(c.label)} tag=${c.tag}`);
    check('buttons Cancel + Comment(primary); body starts EMPTY on open',
      /^cancel$/i.test(c.cancel) && /^comment$/i.test(c.ok) && c.okPrimary && c.bodyValue === '',
      `cancel=${JSON.stringify(c.cancel)} ok=${JSON.stringify(c.ok)} primary=${c.okPrimary} `
        + `body=${JSON.stringify(c.bodyValue)}`);

    // --- 4. Comment + OK wraps the selected word with the typed metadata ---
    await page.fill('#comment-body', BODY_ONE);
    await page.click('#btn-comment-ok');
    await sleep(400);
    const one = await page.evaluate(() => window.__L4_COMMENT__());
    check('OK closes + wraps the selected word in span.comment with data-id/author/comment',
      !one.open && one.spans.length === 1
        && one.spans[0].text === WORD_ONE
        && one.spans[0].comment === BODY_ONE
        && one.spans[0].author.length > 0
        && uuidish(one.spans[0].id),
      `closed=${!one.open} spans=${one.spans.length} text=${JSON.stringify(one.spans[0] && one.spans[0].text)} `
        + `data-comment=${JSON.stringify(one.spans[0] && one.spans[0].comment)} `
        + `author=${JSON.stringify(one.spans[0] && one.spans[0].author)} uuid=${uuidish(one.spans[0] && one.spans[0].id)}`);

    // --- 5. comments panel opens + lists the comment ---
    check('comments panel opens + lists the comment text',
      one.panelHidden === false && one.panelItems.some((t) => t.includes(BODY_ONE)),
      `panelHidden=${one.panelHidden} items=${JSON.stringify(one.panelItems)}`);

    // --- 6. Ctrl+Enter confirms a second comment (wired keyboard path) ---
    await page.evaluate((w) => window.__L4_SELECT_WORD__(w), WORD_TWO);
    await sleep(250); // let the selection settle in the focused editor before the click
    await openViaRibbon(page);
    await page.fill('#comment-body', BODY_TWO);
    await page.focus('#comment-body');
    await page.keyboard.press('Control+Enter');
    await sleep(400);
    const two = await page.evaluate(() => window.__L4_COMMENT__());
    check('Ctrl+Enter in the textarea confirms the second comment',
      !two.open && two.spans.length === 2
        && two.spans[1].text === WORD_TWO && two.spans[1].comment === BODY_TWO,
      `closed=${!two.open} spans=${two.spans.length} `
        + `text=${JSON.stringify(two.spans[1] && two.spans[1].text)} `
        + `data-comment=${JSON.stringify(two.spans[1] && two.spans[1].comment)}`);

    // --- 7. unique ids + both listed ---
    const uniq = new Set(two.spans.map((s) => s.id));
    check('both comments carry unique data-ids and both are listed in the panel',
      uniq.size === 2 && two.panelItems.filter((t) => t.includes(BODY_ONE) || t.includes(BODY_TWO)).length === 2,
      `uniqueIds=${uniq.size} panelItems=${JSON.stringify(two.panelItems)}`);

    // --- 8. Cancel plants nothing ---
    await page.evaluate((w) => window.__L4_SELECT_WORD__(w), 'echo');
    await openViaRibbon(page);
    await page.fill('#comment-body', 'this must not land');
    await page.click('#btn-comment-cancel');
    await sleep(300);
    const cancel = await page.evaluate(() => window.__L4_COMMENT__());
    check('Cancel closes + plants nothing (still 2 spans, panel intact)',
      !cancel.open && cancel.spans.length === 2
        && !cancel.spans.some((s) => (s.comment || '').includes('must not land')),
      `closed=${!cancel.open} spans=${cancel.spans.length}`);

    // --- 9. reopened dialog starts empty again ---
    await openViaRibbon(page);
    const fresh = await page.evaluate(() => window.__L4_COMMENT__());
    check('reopened dialog starts empty again (fresh state for the next comment)',
      fresh.open && fresh.bodyValue === '',
      `open=${fresh.open} body=${JSON.stringify(fresh.bodyValue)}`);
    await page.click('#btn-comment-cancel');

    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }

  const ok = checks.every((c) => c.ok);
  const out = {
    version: 1,
    probe: 'comment-dialog-l4',
    feature: 'dialog.comment-dialog.l4',
    generated: new Date().toISOString(),
    ok,
    checks,
    declaredGaps: [
      'the committed OO interaction census proves the Comment trigger opens a '
      + 'surface (insert/Comment -> modal; the OO rig captured its dropdown — '
      + '87 controls — not field-level dialog fields); the OO field contract '
      + '(Comment) is pinned from the batch PROBES dict and flips deliberately '
      + 'with this probe',
      'WO stores a comment as span.comment metadata on the wrapped selection '
      + '(data-id/data-author/data-comment) + a comments side panel; OO keeps '
      + 'comments in its own annotation layer — the wrap + panel contract is '
      + 'what this probe pins (declared divergence)',
      'comment persistence across html->docx->html is the roundtrip layer '
      + '(roundtrip.cjs); this probe pins the dialog + insert semantics',
      'measured quirk: confirmCommentDialog wraps whatever range it captured '
      + 'at open — a comment confirmed with no live selection plants an empty '
      + 'span.comment (metadata carried, wrapped text empty); the probe always '
      + 'opens with a real selection (the user flow) and asserts the wrap',
    ],
    contract: {
      open: 'real clicks: Collaboration tab + #btn-comment '
        + '(editor.js: openCommentDialog at the current selection)',
      title: 'Add comment',
      fields: [
        { label: 'Comment', tag: 'textarea', type: 'text',
          note: 'cleared on every open; Ctrl+Enter confirms from the textarea' },
      ],
      buttons: ['Cancel', 'Comment (primary)'],
      behavior: 'OK (or Ctrl+Enter) wraps the current selection in '
        + 'span.comment[data-id][data-author][data-comment] and opens the '
        + 'comments panel listing the thread; Cancel closes and plants nothing',
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`l4-comment-dialog: ${ok ? 'OK' : 'FAIL'} ${checks.filter((c) => c.ok).length}/${checks.length} checks`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('l4-comment-dialog: ERROR', e);
  process.exit(1);
});
