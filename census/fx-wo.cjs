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
  'btn-fullscreen', 'btn-view-fullscreen']); // fullscreen is denied headless
// Controls that are legitimately silent against the pristine seeded baseline
// ("already in state X" precondition no-ops). Every other control must
// produce an observable effect (doc / menu / dialog / panel / status / chrome).
const EXPECTED_SILENT = new Set([
  'outdent',      // nothing indented in the pristine seed (indent is its own control)
  'removeFormat', // the pristine seed carries no formatting to clear
  'justifyLeft',  // pristine paragraphs are already left-aligned
  'formatBlock',  // 'P' on paragraphs is already the current block state
]);

(async () => {
  const { chromium } = require('playwright');
  const url = process.env.CENSUS_WO_URL;
  if (!url) { console.error('fx-wo: CENSUS_WO_URL required (spawn via reconcile.py)'); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#toolbar', { timeout: 30000 });
  await page.waitForTimeout(2500);

  const snapshotJS = `(() => {
    const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const row2 = document.getElementById('ribbon-row-2');
    const activeTab = document.querySelector('.ribbon-page.active');
    return {
      html: document.getElementById('editor').innerHTML,
      menus: [...document.querySelectorAll('.menu-list,.rb-menu,.dropdown,.color-palette,.insert-pop,[id$="-menu"]')].filter(vis).length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(vis).length,
      panels: [...document.querySelectorAll('[class*="panel"],[id*="panel"]')].filter(vis).length,
      status: (document.getElementById('status')?.textContent || '').trim(),
      // chrome-level effects: theme class, row-2 visibility, active tab,
      // fullscreen, zoom slider, ruler visibility, and every aria-pressed
      // toggle (track changes, gridlines, hyphenation, ...) joined.
      chrome: document.documentElement.className + '|' + (row2 ? vis(row2) : '') + '|' +
              (activeTab ? activeTab.dataset.tab : '') + '|' + (document.fullscreenElement ? 'fs' : '') + '|' +
              (document.getElementById('zoom-slider')?.value || '') + '|' +
              (document.querySelector('.ruler') ? vis(document.querySelector('.ruler')) : '') + '|' +
              (document.getElementById('editor')?.getAttribute('style') || '') + '|' +
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
  // clean block seed: raw text nodes and empty <p> are invisible to the
  // block-level commands (line spacing / RTL / dropcap resolve <p> blocks),
  // so seed real paragraphs up front.
  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(150);
  const snap = () => page.evaluate(snapshotJS);
  const arm = async () => { // real selection inside the editor before every click
    await page.evaluate(() => {
      const ed = document.getElementById('editor');
      ed.focus();
      const r = document.createRange(); r.selectNodeContents(ed);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    });
    await sleep(60);
  };
  const cleanup = async () => {
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
  const rows = [];
  for (const tab of tabs) {
    await page.evaluate(t => {
      const el = [...document.querySelectorAll('.ribbon-tab')].find(x => (x.textContent || '').trim() === t);
      if (el) el.click();
    }, tab);
    await sleep(250);
    // enumerate controls as visible, clickable elements (handles → no selector ambiguity)
    const handles = await page.$$('.ribbon-page.active button, .ribbon-page.active select');
    const meta = await page.evaluate(() => {
      const pg = document.querySelector('.ribbon-page.active');
      const all = [...pg.querySelectorAll('button, select')];
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
          const ed = document.getElementById('editor');
          ed.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
          ed.dispatchEvent(new Event('input', { bubbles: true }));
          // earlier controls can leave restrict-editing on (contentEditable
          // off) — restore the pristine editable baseline
          if (ed.contentEditable !== 'true') { ed.contentEditable = 'true'; ed.setAttribute('aria-readonly', 'false'); }
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
      for (let t = 0; t < 10 && after.html === before.html && after.menus === before.menus &&
           after.dialogs === before.dialogs && after.panels === before.panels &&
           after.status === before.status && after.chrome === before.chrome; t++) {
        await sleep(300);
        after = await snap();
      }
      let eff = [];
      {
        const after2 = await snap();
        if (after2.html !== before.html) eff.push('doc');
        if (after2.menus > before.menus) eff.push('menu');
        if (after2.dialogs > before.dialogs) eff.push('dialog');
        if (after2.panels > before.panels) eff.push('panel');
        if (after2.status !== before.status) eff.push('status');
        if (after2.chrome !== before.chrome) eff.push('chrome');
      }
      // single retry for flapping rows (timing-dependent handler runs):
      // re-seed, re-arm, click again; keep the retry's effect if it lands.
      if (clicked && eff.length === 0 && !['select'].includes(m.kind)) {
        try {
          await page.evaluate(() => {
            const ed = document.getElementById('editor');
            ed.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
            ed.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelectorAll('.dialog-overlay.open,.insert-pop.open,.menu-list.open,.rb-menu.open')
              .forEach(e => e.classList.remove('open'));
          });
          await arm();
          const before2 = await snap();
          await handles[k].click({ timeout: 1500, force: true });
          await sleep(700);
          const after2 = await snap();
          if (after2.html !== before2.html) eff.push('doc');
          if (after2.menus > before2.menus) eff.push('menu');
          if (after2.dialogs > before2.dialogs) eff.push('dialog');
          if (after2.panels > before2.panels) eff.push('panel');
          if (after2.status !== before2.status) eff.push('status');
          if (after2.chrome !== before2.chrome) eff.push('chrome');
          if (eff.length) eff.push('retry');
        } catch (e) { /* keep original verdict */ }
      }
      rows.push({ tab, key, label: m.label, effect: clicked ? (eff.length ? eff.join('+') : 'silent') : 'unclickable', why });
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
