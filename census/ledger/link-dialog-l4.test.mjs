#!/usr/bin/node
/* L4 FIDELITY probe: link-dialog FIELD-level parity (campaign L4-001).
 *
 * The structural census (census-wo-dialogs.cjs) proves the link dialog
 * EXISTS (and could only force-open it — "cmd insertLink" is not a routed
 * command; the real route is the #btn-link toolbar click / wo-command
 * "link"). This probe asks the L4 question: does the dialog carry the OO
 * Hyperlink window's FIELD contract, opened the way a user opens it?
 *
 *   1. boots the vanilla wysiwyg editor (served locally, fetch stubbed —
 *      same boot as ledger/roundtrip.cjs),
 *   2. clicks the REAL toolbar route (#btn-link),
 *   3. extracts the dialog's visible fields + buttons (same extraction as
 *      census-wo-dialogs.cjs),
 *   4. joins them against the declared OO contract below (the OO rig
 *      census cannot open OO's hyperlink window — the "Link" trigger
 *      there captures Bookmarks — so the OO field list is DECLARED here
 *      and pinned by this probe; it flips deliberately, PROBES-dict
 *      spirit from ai-contracts.py),
 *   5. functional check: fill the URL field + Insert -> an <a href>
 *      must appear in #editor (a field that exists but does nothing is
 *      not parity).
 *
 * Writes ledger/link-dialog-l4.json (merged by ledger/build.py as the
 * `dialog.link-dialog.l4` row). Exit code: 0 = measured (parity may be
 * false — gaps are reported, not hidden); 1 = probe broken (dialog never
 * opened / editor dead) — loud, never a silent stub.
 *
 * Env: WO_EDITOR_DIR (default the vanilla wysiwyg app).
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const LEDGER_DIR = path.dirname(new URL(import.meta.url).pathname);
const CENSUS_DIR = path.join(LEDGER_DIR, '..');
const OUT = path.join(LEDGER_DIR, 'link-dialog-l4.json');

const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';

// Declared OO Hyperlink window field contract (external link mode).
// OO order: Text to display, then the link target. WO ships URL only —
// that gap is the honest L4 delta this row reports.
const OO_FIELDS = ['Text to display', 'URL'];

const SEED_HTML = '<p>link l4 sentinel alpha text.</p>';
const BOOT_MS = 2500;

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

(async () => {
  const out = {
    probe: 'ledger/link-dialog-l4.test.mjs',
    feature: 'dialog.link-dialog.l4',
    oo_fields: OO_FIELDS,
    openedBy: null, wo: null,
    covered: 0, total: OO_FIELDS.length, missing: [], mapping: {},
    parity: false, functional: false, functional_text: false, error: null,
    capturedAt: new Date().toISOString(),
  };

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

    // 1) REAL user route: activate the Insert ribbon tab, then the visible
    //    toolbar button (id-wired buttons need a real click — a DOM el.click()
    //    on a hidden element is not proof).
    await page.click('.ribbon-tab[data-tab="insert"]', { timeout: 5000 });
    await page.click('#btn-link', { timeout: 5000 });
    await page.waitForTimeout(300);
    const opened = await page.evaluate(() => {
      const d = document.getElementById('link-dialog');
      // note: .dialog-overlay is position:fixed — offsetParent is null by
      // definition; visibility = the .open class + non-none display.
      return !!d && d.classList.contains('open')
        && (getComputedStyle(d).display || '') !== 'none';
    });
    if (!opened) throw new Error('link-dialog did not open via #btn-link click');
    out.openedBy = 'click #btn-link (toolbar Insert link)';

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
    }, 'link-dialog');

    // 3) OO field join (declared contract): normalized exact or containment.
    for (const want of OO_FIELDS) {
      const wn = norm(want);
      const hit = out.wo.fields.find((f) => norm(f.label) === wn)
        || out.wo.fields.find((f) => wn.length >= 4 && (norm(f.label).includes(wn) || wn.includes(norm(f.label))));
      if (hit) { out.covered += 1; out.mapping[want] = hit.label; }
      else out.missing.push(want);
    }
    out.parity = out.missing.length === 0;

    // 4) functional: URL field + Insert must produce an anchor.
    await page.fill('#link-url', 'https://example.com/l4-probe');
    await page.click('#btn-link-ok', { timeout: 3000 });
    await page.waitForTimeout(300);
    out.functional = await page.evaluate(() =>
      !!document.querySelector('#editor a[href*="example.com/l4-probe"]'));

    // 5) functional: "Text to display" must drive the anchor text (OO
    //    semantics — a field that exists but does nothing is not parity).
    await page.click('.ribbon-tab[data-tab="insert"]', { timeout: 5000 });
    await page.click('#btn-link', { timeout: 5000 });
    await page.waitForTimeout(200);
    await page.fill('#link-text', 'Example display text');
    await page.fill('#link-url', 'https://example.com/l4-probe-text');
    await page.click('#btn-link-ok', { timeout: 3000 });
    await page.waitForTimeout(300);
    out.functional_text = await page.evaluate(() => {
      const a = document.querySelector('#editor a[href*="example.com/l4-probe-text"]');
      return !!a && (a.textContent || '').trim() === 'Example display text';
    });

    await ctx.close();
    await b.close();
  } catch (e) {
    out.error = String(e && e.message || e).slice(0, 300);
  } finally {
    if (srv.kill) srv.kill('SIGTERM');
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  const summary = `link-dialog-l4: parity=${out.parity} covered=${out.covered}/${out.total}`
    + (out.missing.length ? ` missing=[${out.missing.join(', ')}]` : '')
    + ` functional=${out.functional} functional_text=${out.functional_text}`;
  console.log(summary);
  process.exit(out.error || !out.wo ? 1 : 0);
})();
