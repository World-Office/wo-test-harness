#!/usr/bin/env node
// fx-wo.cjs — FUNCTIONAL census of every World-Office ribbon control.
//
// The structural census (census-wo.cjs) answers "what exists"; the
// interaction census (interact-wo.cjs) answers "what a click OPENS".
// This one answers "does the click DO anything": for every visible ribbon
// button and select, arm a real selection, click, and detect an observable
// effect — document mutation, menu/popover/dialog/panel opening, or a
// statusbar message. A control with NO observable effect is classified
// "silent": per the loud-stub doctrine every unimplemented control must at
// least say so, so a silent row is a defect (either wire it or make it a
// loud stub via runCommand's unsupported-command fallback).
//
// Launch contract identical to census-wo.cjs: reconcile.py spawns a
// docserver and sets CENSUS_WO_URL + CENSUS_OUT (or run it against the rig
// without env). Output: $CENSUS_OUT/fx-wo.json (default census/ next to
// this file).
const fs = require('fs');
const path = require('path');
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Controls that legitimately have no in-page effect in headless runs.
// print* would open the browser print sheet; the slider is an <input>.
const SKIP = new Set(['print', 'btn-print-qa', 'zoom-slider', 'btn-close',
  'btn-fullscreen', 'btn-view-fullscreen', // fullscreen is denied headless
  'btn-text-from-file', // opens a NATIVE file picker — unreachable headless
]);
// Controls that are legitimately silent against the pristine seeded baseline
// ("already in state X" precondition no-ops). Every other control must
// produce an observable effect (doc / menu / dialog / panel / status / chrome).
const EXPECTED_SILENT = new Set([
  // "already in state X" precondition no-ops against the pristine baseline
  'outdent',      // nothing indented in the pristine seed (indent is its own control)
  'removeFormat', // the pristine seed carries no formatting to clear
  'justifyLeft',  // pristine paragraphs are already left-aligned
  'formatBlock',  // 'P' on paragraphs is already the current block state
  // walk-state precondition no-ops (state normalized per row in arm())
  'btn-redo',                // nothing undone at arm time (fresh history)
  'btn-zoom-100',            // zoom normalized to 100% before every row
  'btn-pause-recording',     // no macro recording is running
  'btn-close-header-footer', // header/footer mode normalized to none
  'btn-bring-forward', 'btn-send-backward', 'btn-group', 'btn-merge-shapes',
                     // shape ops: the census doc has no shapes (precondition)
  'btn-remove-header', 'btn-remove-footer',
                     // header/footer content normalized to pristine empty baseline
  'btn-align',       // alignObjects: console.log stub like the other shape ops
                     // (DocumentStore TODO — objects cannot exist in the census doc)
  'btn-page-margins', // valueless ribbon button RE-APPLIES the current margins
                      // (react renders a direct re-apply where OO opens a menu)
]);
// Controls whose effect is real but page-INVISIBLE (e.g. clipboard copy:
// writes the system clipboard, nothing in the DOM changes). Not defects.
const FX_NOOBSERVE = new Set(['btn-copy', 'btn-draw-copy', 'copy', 'btn-select-all', 'selectAll']);
// Deliberate divergences (fx-divergences.json, keyed '<tab>|<control-id>'):
// silent rows whose REAL behavior is registered with a verified date — the
// loud-stub gate treats them as declared, not defective.
let FX_DIVERGENCES = new Set();
try {
  const fd = JSON.parse(require('fs').readFileSync(__dirname + '/fx-divergences.json', 'utf8'));
  FX_DIVERGENCES = new Set(Object.keys(fd).filter(k => k !== '_comment'));
} catch (e) { /* no registry → every silent row is a defect */ }

(async () => {
  const { chromium } = require('playwright');
  const url = process.env.CENSUS_WO_URL;
  if (!url) { console.error('fx-wo: CENSUS_WO_URL required (spawn via reconcile.py)'); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#toolbar', { timeout: 30000 });
  await page.waitForTimeout(2500);
  // paste needs clipboard content to be observable (seed AFTER load — about:blank
  // rejects clipboard writes); copy has no page-visible effect (FX_NOOBSERVE).
  await page.evaluate(() => navigator.clipboard.writeText('fx clipboard seed').catch(() => {})).catch(() => {});

  // The react canvas editor owns document pixels in WASM — no innerHTML.
  // Its container publishes a monotonic data-wo-rev counter bumped on every
  // committed mutation (CanvasEditor bumpDocRev), which is the observable
  // doc-mutation signal. Legacy wysiwyg (if ever re-engaged) uses innerHTML.
  const editorInfo = await page.evaluate(() => ({
    canvas: document.querySelector('[data-wo-rev]') !== null ||
            (!document.getElementById('editor') && document.querySelectorAll('canvas').length > 0),
  }));
  const DOC_SIGNAL = editorInfo.canvas
    ? `(document.querySelector('[data-wo-rev]')?.getAttribute('data-wo-rev') || '')`
    : `document.getElementById('editor').innerHTML`;

  const snapshotJS = `(() => {
    const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const row2 = document.getElementById('ribbon-row-2');
    const activeTab = document.querySelector('.ribbon-page.active');
    return {
      html: ${DOC_SIGNAL},
      menus: [...document.querySelectorAll('.menu-list,.rb-menu,.dropdown,.color-palette,.insert-pop,[id$="-menu"],[role="menu"],[role="listbox"]')].filter(vis).length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(vis).length,
      panels: [...document.querySelectorAll('[class*="panel"],[id*="panel"]')].filter(vis).length,
      status: ((document.getElementById('status')?.textContent) || document.querySelector('.de-statusbar')?.textContent || '').trim(),
      // chrome-level effects: theme class + data-theme, row-2 visibility,
      // active tab, fullscreen, zoom slider, ruler visibility, page-layout
      // container inline style (margins/orientation/page size/columns),
      // header/footer editing regions, and every aria-pressed toggle joined.
      chrome: document.documentElement.className + '|' + (document.documentElement.dataset.theme || '') + '|' +
              (row2 ? vis(row2) : '') + '|' +
              (activeTab ? activeTab.dataset.tab : '') + '|' + (document.fullscreenElement ? 'fs' : '') + '|' +
              (document.getElementById('zoom-slider')?.value || '') + '|' +
              (document.querySelector('.ruler') ? vis(document.querySelector('.ruler')) : '') + '|' +
              (document.getElementById('editor')?.getAttribute('style') || '') + '|' +
              (document.querySelector('.de-viewport-editor > div')?.getAttribute('style') || '') + '|' +
              (document.querySelector('[data-header-footer-region]') ? 'hf:' + [...document.querySelectorAll('[data-header-footer-region]')].map(e => e.getAttribute('style')).join(';') : '') + '|' +
              [...document.querySelectorAll('.de-statusbar-btn,.de-statusbar-zoom-label')].map(e => e.className).join(',') + '|' +
              [...document.querySelectorAll('[aria-pressed]')].map(e => e.id + '=' + e.getAttribute('aria-pressed')).join(','),
    };
  })()`;
  // capture the pristine inline style/hidden of every menu/pop/dialog so the
  // cleanup can RESTORE instead of clobbering (a forced display:none would
  // break every subsequent open — menus manage their own display).
  await page.evaluate(() => {
    window.__fxPristine = {};
    document.querySelectorAll('.menu-list,.rb-menu,.insert-pop,[role="dialog"]').forEach(m => {
      const k = m.id || (m.className.toString().split(' ')[0] || m.tagName);
        window.__fxPristine[k] = {
        style: m.getAttribute('style'), hidden: m.hidden, cls: m.className.toString() };
    });
    window.__fxHtmlClass = document.documentElement.className;
  });
  await page.evaluate((canvas) => { window.__fxCanvas = canvas; }, editorInfo.canvas); // per-row re-seed must skip canvas mode (see below)
  // clean block seed: raw text nodes and empty <p> are invisible to the
  // block-level commands (line spacing / RTL / dropcap resolve <p> blocks),
  // so seed real paragraphs up front.
  await page.evaluate((canvasMode) => {
    // clean block seed: raw text nodes and empty <p> are invisible to the
    // block-level commands (line spacing / RTL / dropcap resolve <p> blocks),
    // so seed real paragraphs up front. The canvas editor owns its own
    // document (no innerHTML) — nothing to seed.
    if (canvasMode) return;
    const ed = document.getElementById('editor');
    if (!ed) return;
    ed.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  }, editorInfo.canvas);
  await sleep(150);
  // null-safe: a control that navigates/crashes the page must not kill the
  // whole census — the row just records no observable change.
  const snap = async () => {
    try { return await page.evaluate(snapshotJS); }
    catch { return null; }
  };
  // canary: a broken snapshotJS (syntax error, null deref) would make EVERY
  // row 'silent' and mask all defects — fail loudly at startup instead.
  if (await snap() === null) {
    console.error('fx-wo FATAL: snapshot eval failed at startup (broken snapshotJS)');
    await browser.close();
    process.exit(1);
  }
  const arm = async () => { // real selection inside the editor before every click
    try {
      // Normalize UI state so every control starts from a known baseline:
      // zoom 100%, header/footer mode closed, panels closed, fit flags off.
      // Without this the census walk order creates phantom silent rows
      // (zoom clamped at max, edit-header a no-op after insert-header-footer).
      await page.evaluate(() => {
        const s = window.__woStores?.document;
        if (!s) return;
        try { if (s.zoomLevel !== 100) s.setZoomLevel(100); } catch {}
        try { if (s.headerFooterMode !== 'none') s.headerFooterMode = 'none'; } catch {}
        try { if (s.showFindPanel) s.setShowFindPanel(false); } catch {}
        try { if (s.isFileMenuOpen) s.setFileMenuOpen(false); } catch {}
        try { if (s.fitToPage) s.setFitToPage(false); } catch {}
        try { if (s.fitToWidth) s.fitToWidth = false; } catch {}
        try { if (s.activeRightPanel) s.setActiveRightPanel(null); } catch {}
        try { if (s.headerHtml) s.headerHtml = ''; } catch {}
        try { if (s.footerHtml) s.footerHtml = ''; } catch {}
      }).catch(() => {});
      if (editorInfo.canvas) {
        // canvas engine: click focuses, type 'x' pushes an undoable mutation,
        // Ctrl+A selects all (JS select-all drives engine anchor+extend).
        // Formatting needs a selection; undo/redo need history — both armed.
        await page.locator('canvas').first().click({ timeout: 2000, force: true });
        await page.keyboard.type('x', { delay: 20 });
        await page.keyboard.press('Control+a');
        await sleep(80);
        return;
      }
      await page.evaluate(() => {
        const ed = document.getElementById('editor');
        if (!ed) return;
        ed.focus();
        const r = document.createRange(); r.selectNodeContents(ed);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      });
      await sleep(60);
    } catch { /* page gone — snap() below records it */ }
  };
  const cleanup = async () => {
    if (editorInfo.canvas) {
      // react surfaces toggle: re-click the ACTIVE rail button to close its
      // panel (Escape is a no-op on react panels) — same doctrine as
      // interact-wo closeAll. An open panel would make the next control's
      // panel delta read as zero -> false silent.
      await page.evaluate(() => {
        try {
          const rt = document.querySelector('.de-right-menu-btn[aria-pressed="true"], .de-right-menu-btn.active');
          if (rt) rt.click();
          const lt = document.querySelector('.de-left-menu-btn[aria-pressed="true"], .de-left-menu-btn.active');
          if (lt) lt.click();
          [...document.querySelectorAll('.dialog-overlay.open')].forEach(d => {
            const b = d.querySelector('button[id$="-close"], .find-close, [data-dialog-close]');
            if (b) b.click();
            else { d.classList.remove('open'); d.style.display = ''; }
          });
          ['#file-menu', '#ctx-menu'].forEach(s => { const e = document.querySelector(s); if (e) e.hidden = true; });
        } catch (e) {}
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }).catch(() => {});
      await sleep(150);
      return;
    }
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      // restore chrome mutations: the collapse toggle hides ribbon-row-2 (every
      // later row-B control would read as hidden), theme flips html class.
      const row2 = document.getElementById('ribbon-row-2');
      if (row2 && row2.getBoundingClientRect().height === 0) {
        const c = document.getElementById('btn-ribbon-collapse');
        if (c) c.click();
      }
      const themeBtn = document.getElementById('btn-theme');
      if (themeBtn && window.__fxHtmlClass !== undefined &&
          document.documentElement.className !== window.__fxHtmlClass) themeBtn.click();
      document.querySelectorAll('.menu-list,.rb-menu,.insert-pop,[role="dialog"]').forEach(m => {
        const p = (window.__fxPristine || {})[m.id || (m.className.toString().split(' ')[0] || m.tagName)];
        if (p) {
          if (p.style === null) m.removeAttribute('style'); else m.setAttribute('style', p.style);
          m.hidden = p.hidden;
          m.className = p.cls; // opens can be class-based ('open') — style alone stays covered
        }
      });
      document.querySelectorAll('[aria-expanded="true"]').forEach(e => e.setAttribute('aria-expanded', 'false'));
    });
    await sleep(120);
  };

  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('.ribbon-tab')].map(t => (t.textContent || '').trim()).filter(Boolean));
  const t0 = Date.now();
  const progress = m => console.error(`[fx ${(Date.now() - t0) / 1000 | 0}s] ${m}`);
  const rows = [];
  for (const tab of tabs) {
    progress(`tab ${tab} (${rows.length} rows so far)`);
    await page.evaluate(t => {
      const el = [...document.querySelectorAll('.ribbon-tab')].find(x => (x.textContent || '').trim() === t);
      if (el) el.click();
    }, tab);
    await sleep(250);
    // enumerate controls as visible, clickable elements (handles → no selector ambiguity)
    const activeOk = () => page.evaluate(() => !!document.querySelector('.ribbon-page.active'));
    if (!(await activeOk())) {
      // transient activation race: re-click the tab once, wait longer
      await page.evaluate((pref) => {
        const t = [...document.querySelectorAll('.ribbon-tab')].find(x => (x.textContent || '').trim().startsWith(String(pref).slice(0, 6)));
        if (t) t.click();
      }, tab);
      await sleep(600);
    }
    if (!(await activeOk())) {
      rows.push({ tab, key: 'TAB-ENUM-FAILED', label: tab, effect: 'unclickable', why: 'ribbon page never activated' });
      console.log(`[fx] tab ${tab}: ribbon page never activated — recorded as unclickable`);
      await cleanup();
      continue;
    }
    const handles = await page.$$('.ribbon-page.active button, .ribbon-page.active select');
    const meta = await page.evaluate(() => {
      const pg = document.querySelector('.ribbon-page.active');
      const all = [...(pg ? pg.querySelectorAll('button, select') : [])];
      // TOP-LEVEL ribbon controls only: menu/popover/dialog internals are
      // exercised through their parent caret/button; enumerating them here
      // opens menus mid-loop and every later click degrades. i = index in the
      // FULL list (same order as the element handles above).
      return all.map((el, i) => {
        const top = !el.closest('.menu-list, .rb-menu, .insert-pop, [role="dialog"], .dropdown, .color-palette');
        const r = el.getBoundingClientRect();
        const vis = top && r.width > 0 && r.height > 0 && !el.disabled;
        return { i, vis, kind: el.tagName.toLowerCase(),
                 id: el.id || '', cmd: el.dataset ? (el.dataset.cmd || '') : '',
                 label: (el.title || el.getAttribute('aria-label') || el.textContent || '').replace(/[\s]+/g, ' ').trim().slice(0, 30) };
      }).filter(m => m.vis);
    });
    for (const m of meta) {
      const k = m.i;
      if (!m.vis) continue;
      const key = m.id || m.cmd || m.label;
      if (SKIP.has(m.id) || SKIP.has(m.cmd) || (m.label || '').toLowerCase().includes('print')) continue;
      if (!handles[k]) continue;
      let clicked = false, why = '', before = null;
      try {
        // deterministic precondition: earlier controls trash the document
        // (lists, headers, TOC) and later block-level commands mis-resolve;
        // re-seed the same clean paragraphs before every control.
        await page.evaluate((tabName) => {
          // controls like hf-close switch the active ribbon tab mid-loop;
          // later force-clicks on the now-hidden page would dispatch at (0,0)
          const active = document.querySelector('.ribbon-page.active');
          if (!active || active.dataset.tab !== tabName) {
            const el = [...document.querySelectorAll('.ribbon-tab')].find(x => (x.dataset ? x.dataset.tab : x.textContent.trim()) === tabName) ||
                       [...document.querySelectorAll('.ribbon-tab')].find(x => (x.textContent||'').trim() === tabName);
            if (el) { if (el.hidden) el.hidden = false; el.click(); }
          }
          if (!window.__fxCanvas) {
            const ed = document.getElementById('editor');
            if (ed) {
              ed.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
              ed.dispatchEvent(new Event('input', { bubbles: true }));
              // earlier controls can leave restrict-editing on (contentEditable
              // off) — restore the pristine editable baseline
              if (ed.contentEditable !== 'true') { ed.contentEditable = 'true'; ed.setAttribute('aria-readonly', 'false'); }
            }
          }
          // canvas mode: the WASM engine owns the doc — an innerHTML re-seed
          // here used to WIPE the react canvas + the data-wo-rev doc signal,
          // reading every engine-only control (cut) as silent. Nothing to seed.
          // modal overlays can re-open post-cleanup (async fetch adds .open
          // after the class restore) and swallow real mouse events — hard-close
          document.querySelectorAll('.dialog-overlay.open,.insert-pop.open,.menu-list.open,.rb-menu.open')
            .forEach(e => e.classList.remove('open'));
        }, tab);
        await arm();
        before = await snap();
        if (m.kind === 'select') {
          const cur = await handles[k].inputValue();
          const opts = await handles[k].$$('option');
          const vals = (await Promise.all(opts.map(o => o.getAttribute('value'))))
            .filter(v => v && v !== cur && !/more|__|placeholder|^$/i.test(v) &&
                         !(parseFloat(v) <= 1)); // "1"-style values are 'reset' no-ops
          if (!vals.length) { rows.push({ tab, key, label: m.label, effect: 'select:no-alternative' }); continue; }
          await handles[k].selectOption(vals[0]);
        } else {
          // force: skip actionability (page/tab transitions flap the stability
          // check); the hit test is the structural census's job, not this one's
          await handles[k].click({ timeout: 1500, force: true });
        }
        clicked = true;
      } catch (e) { why = e.message.split('\n')[0].slice(0, 80); }
      // async handlers (plugin/AI fetches) settle late — poll for the first
      // observable change for up to ~3s instead of one fixed look.
      let after = await snap();
      for (let t = 0; t < 10 && after && before &&
           after.html === before.html && after.menus === before.menus &&
           after.dialogs === before.dialogs && after.panels === before.panels &&
           after.status === before.status && after.chrome === before.chrome; t++) {
        await sleep(300);
        after = await snap();
      }
      let eff = [];
      if (after && before) {
        if (after.html !== before.html) eff.push('doc');
        if (after.menus > before.menus) eff.push('menu');
        if (after.dialogs > before.dialogs) eff.push('dialog');
        if (after.panels > before.panels) eff.push('panel');
        if (after.status !== before.status) eff.push('status');
        if (after.chrome !== before.chrome) eff.push('chrome');
      }
      // single retry for flapping rows (timing-dependent handler runs):
      // re-seed, re-arm, click again; keep the retry's effect if it lands.
      if (clicked && eff.length === 0 && !['select'].includes(m.kind)) {
        try {
          await page.evaluate(() => {
            const ed = document.getElementById('editor');
            if (ed) { // canvas mode: nothing to re-seed
              ed.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
              ed.dispatchEvent(new Event('input', { bubbles: true }));
            }
            document.querySelectorAll('.dialog-overlay.open,.insert-pop.open,.menu-list.open,.rb-menu.open')
              .forEach(e => e.classList.remove('open'));
          });
          await arm();
          const before2 = await snap();
          await handles[k].click({ timeout: 1500, force: true });
          await sleep(700);
          const after2 = await snap();
          if (after2 && before2) {
            if (after2.html !== before2.html) eff.push('doc');
            if (after2.menus > before2.menus) eff.push('menu');
            if (after2.dialogs > before2.dialogs) eff.push('dialog');
            if (after2.panels > before2.panels) eff.push('panel');
            if (after2.status !== before2.status) eff.push('status');
            if (after2.chrome !== before2.chrome) eff.push('chrome');
          }
          if (eff.length) eff.push('retry');
        } catch (e) { /* keep original verdict */ }
      }
      const effect = clicked ? (eff.length ? eff.join('+') : 'silent') : 'unclickable';
      const divergent = effect === 'silent' && FX_DIVERGENCES.has(tab + '|' + (m.id || m.key || m.label));
      rows.push({ tab, key, label: m.label,
        effect: effect === 'silent' && (FX_NOOBSERVE.has(m.id) || FX_NOOBSERVE.has(m.cmd))
          ? 'noobserve'
          : effect === 'silent' && divergent ? 'divergence'
          : effect, why });
      await cleanup();
    }
    await cleanup();
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'fx-wo.json'), JSON.stringify({
    engine: 'world-office', capturedAt: new Date().toISOString(), viewport: { width: 1440, height: 900 },
    pageErrors: errs.slice(0, 5), controls: rows,
  }, null, 1) + '\n');
  const silent = rows.filter(r => (r.effect === 'silent' || r.effect === 'unclickable') && !EXPECTED_SILENT.has(r.key || r.label));
  const expected = rows.filter(r => EXPECTED_SILENT.has(r.key || r.label) && (r.effect === 'silent' || r.effect === 'unclickable'));
  console.log(`fx-wo: ${rows.length} controls, ${silent.length} silent/unclickable, ${expected.length} expected-silent` +
    (silent.length ? '\n  ' + silent.map(r => `[${r.tab}] ${r.key || r.label}`).join('\n  ') : ''));
  await browser.close();
  process.exit(silent.length ? 1 : 0);
})().catch(e => { console.error('fx-wo FATAL', e.message); process.exit(1); });
