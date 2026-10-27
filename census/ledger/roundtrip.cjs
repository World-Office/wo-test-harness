#!/usr/bin/env node
/* LEDGER2-ROUNDTRIP: L3 "persists" probe for the World-Office feature ledger.
 *
 * For every ledger feature whose wo.match maps to a document-level editor
 * command, this script:
 *   1. boots the vanilla wysiwyg editor (served locally, fetch stubbed),
 *   2. applies the mutation (data-cmd click or dialog drive) on a sentinel word,
 *   3. verifies the mutation marker appears in the flat serialization,
 *   4. round-trips the HTML through the docserver conversion endpoint
 *      (html -> docx -> html),
 *   5. boots a fresh editor with the converted HTML and verifies the marker
 *      survived (level 3 = "persists").
 *
 * Outputs (in this ledger/ dir):
 *   - roundtrip-results.json  (per-command probe results)
 *   - ROUNDTRIP-GAPS.md       (every non-surviving feature + lost attribute)
 * Final stdout line starts with "roundtrip:" (gate contract).
 *
 * Env: WO_CONVERT_URL (default staging docserver), WO_EDITOR_DIR (default the
 * vanilla wysiwyg app served at /word/).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

const LEDGER_DIR = __dirname;
const CENSUS_DIR = path.join(LEDGER_DIR, '..');
const LEDGER_JSON = path.join(LEDGER_DIR, 'ledger.json');
const RESULTS_JSON = path.join(LEDGER_DIR, 'roundtrip-results.json');
const GAPS_MD = path.join(LEDGER_DIR, 'ROUNDTRIP-GAPS.md');

const EDITOR_DIR = process.env.WO_EDITOR_DIR
  || '/home/weiss/git/World-Office/server/apps/web/apps/documenteditor-wysiwyg';
const CONVERT_URL = process.env.WO_CONVERT_URL
  || 'http://192.168.42.42:8086/api/conversion/convert';

const SEED_HTML = '<p>ROUNDTRIP sentinel alpha text.</p><p>Second paragraph body here.</p>';
const SENTINEL_WORD = 'sentinel';
const BOOT_MS = 2200;

function loadPlaywright() {
  const candidates = [
    path.join(CENSUS_DIR, 'node_modules', 'playwright'),
  ];
  try {
    const { execSync } = require('child_process');
    candidates.push(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch (_) { /* ignore */ }
  for (const c of candidates) {
    try { return require(c); } catch (_) { /* try next */ }
  }
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
  const py = '/usr/bin/python3';
  const child = spawn(py, ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (d) => { err += d.toString(); });
  child._errbuf = () => err;
  return child;
}

/* ---------------- probe table ----------------
 * key       : canonical probe key (also used as data-cmd)
 * also      : other ledger wo.match values this probe covers (label-style)
 * value     : data-value for the clicked button (optional)
 * dialog    : { fields: [[selector, 'fill'|'select', value]], } — generic OK
 *             click on the visible .dialog-overlay is always attempted when
 *             dialog is set.
 * expect    : regex source that must match flat HTML right after apply
 *             (null => assume applied, survival check does the work)
 * survive   : regex source that must match after html->docx->html reload
 *             (defaults to expect)
 */
const PROBES = [
  { key: 'bold', expect: '<(b|strong)\\b|font-weight\\s*:\\s*(bold|[6-9]00)' },
  { key: 'italic', expect: '<(i|em)\\b|font-style\\s*:\\s*italic' },
  { key: 'underline', expect: '<u\\b|text-decoration[^>]*underline' },
  { key: 'strikeThrough', expect: '<(s|strike|del)\\b|line-through' },
  { key: 'superscript', expect: '<sup\\b|vertical-align[^>]*super' },
  { key: 'subscript', expect: '<sub\\b|vertical-align[^>]*\\bsub\\b' },
  { key: 'insertUnorderedList', expect: '<ul\\b' },
  { key: 'indent', expect: 'margin-left\\s*:|<blockquote\\b' },
  { key: 'justifyCenter', expect: null, survive: 'text-align[^">]*center|<center\\b|class="[^"]*center' },
  { key: 'justifyRight', expect: null, survive: 'text-align[^">]*right' },
  { key: 'justifyFull', expect: null, survive: 'text-align[^">]*justify' },
  { key: 'justifyLeft', expect: null, survive: 'text-align[^">]*left|align="left"' },
  { key: 'directionRtl', expect: 'data-textdir="rtl"|dir="rtl"', survive: 'rtl' },
  { key: 'formatBlock', value: 'H1', expect: '<h1\\b' },
  { key: 'formatBlock', value: 'H2', expect: '<h2\\b' },
  { key: 'code', expect: '<code\\b', survive: '<code\\b|courier|monospace' },
  { key: 'insertPageBreak', also: ['Insert page break'], expect: 'page-break' },
  { key: 'insertColumnBreak', also: ['Insert column break'], expect: 'column-break' },
  { key: 'insertSectionBreak', also: ['Insert section break'], expect: 'section-break' },
  { key: 'insertBlankPage', expect: 'page-break|blank-page' },
  { key: 'toggleDropcap', expect: 'dropcap' },
  { key: 'insertFootnote', expect: 'footnote' },
  { key: 'bookmark', dialog: { fields: [['#bookmark-name', 'fill', 'ROUNDTRIPBM']] }, expect: 'bookmark|data-name=' },
  { key: 'insertComment', dialog: { fields: [['#comment-body', 'fill', 'Roundtrip comment.']] }, expect: 'comment' },
  { key: 'link', dialog: { fields: [['#link-url', 'fill', 'https://roundtrip.example']] }, expect: '<a\\b[^>]*href' },
  { key: 'insertHeaderFooter', dialog: {}, expect: 'page-header|page-footer|wo-hf' },
  { key: 'insertTextbox', expect: 'textbox|text-box|data-kind="text' },
  { key: 'insertTextart', expect: 'textart' },
  { key: 'insertObject', dialog: {}, expect: 'chart|data-kind=' },
  { key: 'insertCaption', dialog: {}, expect: 'caption' },
  { key: 'insertToF', dialog: {}, expect: 'tof|figures|\\btoc\\b' },
  { key: 'multilevel', expect: '<ol\\b|<ul\\b|data-level|list-level' },
  { key: 'font-size', backup: ['fontSizeInc'], expect: 'font-size' },
  { key: 'font-family', expect: 'font-family' },
  { key: 'line-spacing', expect: 'line-height' },
  { key: 'text-color', expect: '(style="[^"]*)color:\\s*(rgb|#)' },
  { key: 'highlight-color', expect: 'background-color' },
  { key: 'toggleWatermark', dialog: { fields: [['#wm-mode', 'select', 'confidential']] }, expect: 'watermark' },
  { key: 'toggleLineNumbers', dialog: { fields: [['#ln-mode', 'select', 'continuous']] }, expect: 'line-number|linenumber' },
  { key: 'toggleHyphenation', dialog: { fields: [['#hy-mode', 'select', 'auto']] }, expect: 'hyphen' },
];

/* -------------- ledger coverage -------------- */

function coverageMap() {
  const ledger = JSON.parse(fs.readFileSync(LEDGER_JSON, 'utf8'));
  const cov = new Map(); // probe key -> [feature ids]
  for (const p of PROBES) {
    const ids = [];
    for (const f of ledger.features) {
      const m = (f.wo || {}).match;
      if (m && (m === p.key || (p.also || []).includes(m))) ids.push(f.feature);
    }
    cov.set(p.key + (p.value ? ':' + p.value : ''), ids);
  }
  return { ledger, cov };
}

/* -------------- in-page helpers -------------- */

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

async function bootEditor(browser, base, seed) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(stubInit, { seed });
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#editor', { timeout: 20000 });
  await page.waitForTimeout(BOOT_MS);
  return { ctx, page };
}

function pageHelpers() {
  window.__RT_SELECT__ = function (word) {
    const ed = document.querySelector('#editor');
    if (!ed) return 'no-editor';
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.textContent.indexOf(word);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + word.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        ed.focus();
        return 'ok';
      }
    }
    return 'word-not-found';
  };
  window.__RT_CLICK__ = function (cmd, value) {
    let btn = value != null
      ? document.querySelector(`button[data-cmd="${cmd}"][data-value="${value}"]`)
      : document.querySelector(`button[data-cmd="${cmd}"]`);
    if (!btn && value != null) btn = document.querySelector(`button[data-cmd="${cmd}"]`);
    if (btn) { btn.click(); return 'button'; }
    if (typeof window.runCommand === 'function') { window.runCommand(cmd, value); return 'runCommand'; }
    return 'no-button';
  };
}

async function driveDialog(page, cfg) {
  for (const f of (cfg.fields || [])) {
    const [sel, method, val] = f;
    const loc = page.locator(sel).first();
    if (method === 'fill') await loc.fill(val, { timeout: 3000 });
    else if (method === 'select') await loc.selectOption(val, { timeout: 3000 });
  }
  // Generic OK: first visible dialog overlay's *-ok button.
  const ok = page.locator('.dialog-overlay:visible button[id$="-ok"]').first();
  try {
    await ok.click({ timeout: 3000 });
  } catch (_) { /* maybe direct insert, no dialog */ }
  await page.waitForTimeout(300);
}

async function convertOnce(buf, from, to) {
  const res = await fetch(CONVERT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_format: from,
      target_format: to,
      data: buf.toString('base64'),
    }),
  });
  if (!res.ok) throw new Error(`convert HTTP ${res.status}`);
  const j = await res.json();
  if (j.status !== 'Success' || !j.data) throw new Error(j.error || j.status || 'no data');
  return Buffer.from(j.data, 'base64');
}

function extractBody(html) {
  const m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return m ? m[1] : html;
}

function snippet(s) {
  return String(s || '').replace(/\s+/g, ' ').slice(0, 600);
}

/* -------------- probe runner -------------- */

async function runProbe(browser, base, probe) {
  const out = {
    key: probe.key + (probe.value ? ':' + probe.value : ''),
    cmd: probe.key,
    value: probe.value || null,
    ok: false,
    phase: null,
    detail: null,
    html1: null,
    html3: null,
    ms: 0,
  };
  const t0 = Date.now();
  try {
    // -- apply phase --
    const a = await bootEditor(browser, base, SEED_HTML);
    await a.page.evaluate(pageHelpers);
    const selRes = await a.page.evaluate((w) => window.__RT_SELECT__(w), SENTINEL_WORD);
    if (selRes !== 'ok') throw new Error(`selection failed: ${selRes}`);
    let how = await a.page.evaluate(([c, v]) => window.__RT_CLICK__(c, v), [probe.key, probe.value || null]);
    if (how === 'no-button' && probe.backup) {
      for (const bc of probe.backup) {
        how = await a.page.evaluate(([c, v]) => window.__RT_CLICK__(c, v), [bc, null]);
        if (how !== 'no-button') break;
      }
    }
    if (how === 'no-button') throw new Error('command not dispatched (no button, no runCommand)');
    await a.page.waitForTimeout(400);
    if (probe.dialog) await driveDialog(a.page, probe.dialog);
    await a.page.waitForTimeout(350);
    const html1 = await a.page.evaluate(() => window.__WO_FLAT_HTML__());
    out.html1 = snippet(html1);
    await a.ctx.close();

    const expectSrc = probe.expect;
    if (expectSrc && !(new RegExp(expectSrc, 'i')).test(html1)) {
      out.phase = 'apply';
      out.detail = 'mutation did not take effect (apply marker missing from flat HTML)';
      out.ms = Date.now() - t0;
      return out;
    }

    // -- conversion phase --
    let docxBuf;
    try {
      docxBuf = await convertOnce(Buffer.from(html1, 'utf8'), 'html', 'docx');
    } catch (e) {
      out.phase = 'convert';
      out.detail = `html->docx failed: ${String(e.message || e)}`;
      out.ms = Date.now() - t0;
      return out;
    }
    if (docxBuf.length < 4 || docxBuf.slice(0, 2).toString('latin1') !== 'PK') {
      out.phase = 'convert';
      out.detail = 'html->docx output is not a zip container (docx)';
      out.ms = Date.now() - t0;
      return out;
    }
    let html2;
    try {
      html2 = (await convertOnce(docxBuf, 'docx', 'html')).toString('utf8');
    } catch (e) {
      out.phase = 'convert';
      out.detail = `docx->html failed: ${String(e.message || e)}`;
      out.ms = Date.now() - t0;
      return out;
    }
    const bodyHtml = extractBody(html2);

    // -- survive phase --
    const v = await bootEditor(browser, base, bodyHtml);
    const html3 = await v.page.evaluate(() => window.__WO_FLAT_HTML__());
    out.html3 = snippet(html3);
    await v.ctx.close();

    const surviveSrc = probe.survive || probe.expect;
    if (!surviveSrc || !(new RegExp(surviveSrc, 'i')).test(html3)) {
      out.phase = 'survive';
      out.detail = surviveSrc
        ? `marker present before conversion but lost after html->docx->html (expected /${surviveSrc}/)`
        : 'no survival marker defined';
      out.ms = Date.now() - t0;
      return out;
    }

    out.ok = true;
    out.phase = 'persisted';
    out.detail = `marker /${surviveSrc || expectSrc || 'n/a'}/ survived html->docx->html`;
  } catch (e) {
    out.phase = out.phase || 'error';
    out.detail = String(e.message || e).slice(0, 300);
  }
  out.ms = Date.now() - t0;
  return out;
}

/* -------------- main -------------- */

async function main() {
  const { cov } = coverageMap();
  const { chromium } = loadPlaywright();

  const port = await freePort();
  const server = startStaticServer(port, EDITOR_DIR);
  const base = `http://127.0.0.1:${port}`;
  // give http.server a moment
  await new Promise((r) => setTimeout(r, 600));

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  const results = [];
  const POOL = 3;
  let idx = 0;
  async function worker() {
    while (idx < PROBES.length) {
      const p = PROBES[idx++];
      const ids = cov.get(p.key + (p.value ? ':' + p.value : '')) || [];
      if (ids.length === 0) continue; // no ledger coverage -> skip silently
      const r = await runProbe(browser, base, p);
      r.features = ids;
      results.push(r);
      process.stdout.write(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.key} [${r.phase}] (${r.ms}ms)\n`);
    }
  }
  await Promise.all(Array.from({ length: POOL }, worker));

  await browser.close();
  server.kill('SIGTERM');

  results.sort((x, y) => x.key.localeCompare(y.key));
  const survived = results.filter((r) => r.ok).length;

  const payload = {
    generated: new Date().toISOString(),
    convert_url: CONVERT_URL,
    editor_dir: EDITOR_DIR,
    probed: results.length,
    survived,
    entries: results,
  };
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(payload, null, 2) + '\n');

  // ---- ROUNDTRIP-GAPS.md ----
  const failed = results.filter((r) => !r.ok);
  const lines = [];
  lines.push('# LEDGER2-ROUNDTRIP: persistence gaps');
  lines.push('');
  lines.push(`Generated: ${payload.generated}`);
  lines.push(`Conversion endpoint: \`${CONVERT_URL}\` (html -> docx -> html)`);
  lines.push(`Editor: \`${EDITOR_DIR}\``);
  lines.push(`Probed: ${results.length} document-level commands — survived: ${survived}, lost: ${failed.length}`);
  lines.push('');
  lines.push('A feature reaches **L3 (persists)** only when its mutation marker is present');
  lines.push('in the editor serialization *and* still present after booting a fresh editor');
  lines.push('from the round-tripped (html->docx->html) document.');
  lines.push('');
  if (failed.length) {
    lines.push('## Non-surviving commands (exact lost attribute)');
    lines.push('');
    for (const r of failed) {
      lines.push(`### ${r.key}${r.value ? ` (value ${r.value})` : ''} — ledger features: ${r.features.join(', ')}`);
      lines.push('');
      lines.push(`- **Lost at phase:** \`${r.phase}\``);
      lines.push(`- **Lost attribute:** ${r.detail}`);
      if (r.html1 != null) lines.push(`- HTML after apply: \`${r.html1}\``);
      if (r.html3 != null) lines.push(`- HTML after roundtrip: \`${r.html3}\``);
      lines.push('');
    }
  }
  // ledger rows with wo.match that no probe covers
  const covered = new Set();
  for (const p of PROBES) {
    for (const f of cov.get(p.key + (p.value ? ':' + p.value : '')) || []) covered.add(f);
  }
  const ledger = JSON.parse(fs.readFileSync(LEDGER_JSON, 'utf8'));
  const uncovered = ledger.features.filter((f) => {
    const m = (f.wo || {}).match;
    return m && !covered.has(f.feature);
  });
  if (uncovered.length) {
    lines.push('## Features with wo.match but no persistence probe');
    lines.push('');
    lines.push('These stay at L1: no document-level mutation probe is defined (UI-only,');
    lines.push('dialog-only, or state toggles with no serialized marker).');
    lines.push('');
    for (const f of uncovered) {
      lines.push(`- \`${f.feature}\` (wo.match \`${f.wo.match}\`) — lost attribute: none serialized (no marker contract)`);
    }
    lines.push('');
  }
  fs.writeFileSync(GAPS_MD, lines.join('\n') + '\n');

  process.stdout.write(`roundtrip: ${survived}/${results.length} survived, level3=${survived}\n`);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${String(e && e.stack || e)}\n`);
  process.stdout.write('roundtrip: 0/0 survived, level3=0 (fatal)\n');
  process.exit(1);
});
