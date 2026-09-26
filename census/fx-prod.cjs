#!/usr/bin/env node
// fx-prod.cjs — FUNCTIONAL (loud-stub) census of the LIVE canonical Rust editor.
//
// The harness's fx-wo.cjs boots the deprecated Python docserver. This is the
// "future Rust harness" port the decision deferred (DEPRECATED.md): mint a WOPI
// session against the collaboration shell, open a docx, reach the real #editor
// frame (editor.cloud.graphwiz.ai), and drive the SAME fx-wo census loop there.
//
// Doctrine: every visible ribbon control must produce an observable effect
// (doc mutation / menu / popover / dialog / panel / status / chrome). A control
// with NO effect is "silent" — per the loud-stub rule an unimplemented control
// must at least SAY so (runCommand's unsupported-command fallback sets status
// "Not available <cmd>"), so a silent row is a defect. Report them; exit 1.
//
// Config via env: OC_URL (default https://cloud.graphwiz.ai), OC_USER, OC_PASS,
// DOC (filename to open, must exist in the store; default first .docx found).
// Output: $CENSUS_OUT/fx-prod.json (default census/ next to this file).
const fs = require('fs');
const path = require('path');
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
const OC_URL = process.env.OC_URL || 'https://cloud.graphwiz.ai';
const OC_USER = process.env.OC_USER || 'admin';
const OC_PASS = process.env.OC_PASS || 'wo-od-2026';
const DOC = process.env.DOC || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Native/headless-denied controls that legitimately have no in-page effect here.
const SKIP = new Set(['print', 'btn-print-qa', 'zoom-slider', 'btn-close',
  'btn-fullscreen', 'btn-view-fullscreen']);
// Precondition no-ops against the pristine seeded baseline ("already in state X").
const EXPECTED_SILENT = new Set([
  'outdent',      // nothing indented in the seed (indent is its own control)
  'removeFormat', // seed carries no formatting to clear
  'justifyLeft',  // seed paragraphs already left-aligned
  'formatBlock',  // 'P' on seed paragraphs is already the current block state
]);

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 120)));

  // 1) login
  await page.goto(OC_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.evaluate(([u, p]) => {
    const setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    setVal(document.querySelector('#oc-login-username'), u); setVal(document.querySelector('#oc-login-password'), p);
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Log in'); if (b) b.click();
  }, [OC_USER, OC_PASS]);
  await page.waitForTimeout(6500);

  // 2) open a docx (the shell redirects into the WOPI editor)
  let opened = false;
  if (DOC) {
    try { await page.locator(`a[href*="${DOC}"]`).first().click({ timeout: 15000 }); opened = true; } catch (e) {}
  }
  if (!opened) {
    const docLink = page.locator('a[href*=".docx"]').first();
    if (await docLink.count()) { await docLink.click({ timeout: 20000 }); opened = true; }
  }
  if (!opened) { console.error('fx-prod: could not open a docx'); await browser.close(); process.exit(2); }
  await page.waitForTimeout(8000);

  // 3) reach the editor frame (#editor)
  let ed = null;
  for (let i = 0; i < 48 && !ed; i++) {
    for (const f of page.frames()) { if (f !== page.mainFrame()) { const has = await f.evaluate(() => !!document.querySelector('#editor')).catch(() => false); if (has) ed = f; } }
    if (!ed) await page.waitForTimeout(500);
  }
  if (!ed) { console.error('fx-prod: editor frame not found'); await browser.close(); process.exit(2); }
  await ed.waitForSelector('#toolbar', { timeout: 30000 });
  await ed.waitForTimeout(2500);

  // snapshotJS — identical to fx-wo.cjs (evaluated inside the editor frame)
  const snapshotJS = `(() => {
    const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const row2 = document.getElementById('ribbon-row-2');
    const activeTab = document.querySelector('.ribbon-page.active');
    return {
      html: document.getElementById('editor').innerHTML,
      menus: [...document.querySelectorAll('.menu-list,.rb-menu,.dropdown,.color-palette,.insert-pop,[id$="-menu"]')].filter(vis).length,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(vis).length,
      panels: [...document.querySelectorAll('[class*="panel"],[id*="panel"]')].filter(vis).length,
      status: (document.getElementById('status')?.textContent || '').trim(),      chrome: document.documentElement.className + '|' + (row2 ? vis(row2) : '') + '|' +
              (activeTab ? activeTab.dataset.tab : '') + '|' + (document.fullscreenElement ? 'fs' : '') + '|' +
              (document.getElementById('zoom-slider')?.value || '') + '|' +
              (document.querySelector('.ruler') ? vis(document.querySelector('.ruler')) : '') + '|' +
              (document.getElementById('editor')?.getAttribute('style') || '') + '|' +
              [...document.querySelectorAll('[aria-pressed]')].map(e => e.id + '=' + e.getAttribute('aria-pressed')).join(','),
    };
  })()`;
  await ed.evaluate(() => {
    window.__fxPristine = {};
    document.querySelectorAll('.menu-list,.rb-menu,.insert-pop,[role="dialog"]').forEach(m => {
      const k = m.id || (m.className.toString().split(' ')[0] || m.tagName);
      window.__fxPristine[k] = { style: m.getAttribute('style'), hidden: m.hidden, cls: m.className.toString() };
    });
    window.__fxHtmlClass = document.documentElement.className;
  });
  await ed.evaluate(() => {
    const el = document.getElementById('editor');
    el.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(150);
  const snap = () => ed.evaluate(snapshotJS);
  const arm = async () => {
    await ed.evaluate(() => {
      const eddom = document.getElementById('editor');
      eddom.focus();
      const r = document.createRange(); r.selectNodeContents(eddom);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    });
    await sleep(60);
  };
  const cleanup = async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await ed.evaluate(() => {
      const row2 = document.getElementById('ribbon-row-2');
      if (row2 && row2.getBoundingClientRect().height === 0) {
        const c = document.getElementById('btn-ribbon-collapse'); if (c) c.click();
      }
      const themeBtn = document.getElementById('btn-theme');
      if (themeBtn && window.__fxHtmlClass !== undefined && document.documentElement.className !== window.__fxHtmlClass) themeBtn.click();
      document.querySelectorAll('.menu-list,.rb-menu,.insert-pop,[role="dialog"]').forEach(m => {
        const p = (window.__fxPristine || {})[m.id || (m.className.toString().split(' ')[0] || m.tagName)];
        if (p) {
          if (p.style === null) m.removeAttribute('style'); else m.setAttribute('style', p.style);
          m.hidden = p.hidden; m.className = p.cls;
        }
      });
      document.querySelectorAll('[aria-expanded="true"]').forEach(e => e.setAttribute('aria-expanded', 'false'));
    });
    await sleep(120);
  };

  const tabs = await ed.evaluate(() =>
    [...document.querySelectorAll('.ribbon-tab')].map(t => (t.dataset ? t.dataset.tab : (t.textContent || '').trim())).filter(Boolean));
  console.log('fx-prod: tabs =', tabs.join(', '));
  const rows = [];
  for (const tab of tabs) {
    await ed.evaluate(t => {
      const el = [...document.querySelectorAll('.ribbon-tab')].find(x => (x.dataset ? x.dataset.tab : x.textContent.trim()) === t);
      if (el) el.click();
    }, tab);
    await sleep(250);
    const handles = await ed.$$('.ribbon-page.active button, .ribbon-page.active select');
    const meta = await ed.evaluate(() => {
      const pg = document.querySelector('.ribbon-page.active');
      if (!pg) return [];
      const all = [...pg.querySelectorAll('button, select')];
      return all.map((el, i) => {
        const top = !el.closest('.menu-list, .rb-menu, .insert-pop, [role="dialog"], .dropdown, .color-palette');
        const r = el.getBoundingClientRect();
        const vis = top && r.width > 0 && r.height > 0 && !el.disabled;
        return { i, vis, kind: el.tagName.toLowerCase(), id: el.id || '',
                 cmd: el.dataset ? (el.dataset.cmd || '') : '',
                 label: (el.title || el.getAttribute('aria-label') || el.textContent || '').replace(/[\s]+/g, ' ').trim().slice(0, 30) };
      }).filter(m => m.vis);
    });
    for (const m of meta) {
      const k = m.i;
      const key = m.id || m.cmd || m.label;
      if (SKIP.has(m.id) || SKIP.has(m.cmd) || /print/.test((m.label || '').toLowerCase())) continue;
      if (!handles[k]) continue;
      let clicked = false, why = '', before = null;
      try {
        await ed.evaluate(tabName => {
          const active = document.querySelector('.ribbon-page.active');
          if (!active || active.dataset.tab !== tabName) {
            const el = [...document.querySelectorAll('.ribbon-tab')].find(x => (x.dataset ? x.dataset.tab : x.textContent.trim()) === tabName);
            if (el) el.click();
          }
          const eddom = document.getElementById('editor');
          eddom.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
          eddom.dispatchEvent(new Event('input', { bubbles: true }));
          if (eddom.contentEditable !== 'true') { eddom.contentEditable = 'true'; eddom.setAttribute('aria-readonly', 'false'); }
          document.querySelectorAll('.dialog-overlay.open,.insert-pop.open,.menu-list.open,.rb-menu.open')
            .forEach(e => e.classList.remove('open'));
        }, tab);
        await arm();
        before = await snap();
        if (m.kind === 'select') {
          const cur = await handles[k].inputValue();
          const opts = await handles[k].$$('option');
          const vals = (await Promise.all(opts.map(o => o.getAttribute('value'))))
            .filter(v => v && v !== cur && !/more|__|placeholder|^$/i.test(v) && !(parseFloat(v) <= 1));
          if (!vals.length) { rows.push({ tab, key, label: m.label, effect: 'select:no-alternative' }); continue; }
          await handles[k].selectOption(vals[0]);
        } else {
          await handles[k].click({ timeout: 1500, force: true });
        }
        clicked = true;
      } catch (e) { why = e.message.split('\n')[0].slice(0, 80); }
      let after = await snap();
      for (let t = 0; t < 10 && after.html === before.html && after.menus === before.menus &&
           after.dialogs === before.dialogs && after.panels === before.panels &&
           after.status === before.status && after.chrome === before.chrome; t++) {
        await sleep(300); after = await snap();
      }
      let eff = [];
      {
        const a2 = await snap();
        if (a2.html !== before.html) eff.push('doc');
        if (a2.menus > before.menus) eff.push('menu');
        if (a2.dialogs > before.dialogs) eff.push('dialog');
        if (a2.panels > before.panels) eff.push('panel');
        if (a2.status !== before.status) eff.push('status');
        if (a2.chrome !== before.chrome) eff.push('chrome');
      }
      if (clicked && eff.length === 0 && m.kind !== 'select') {
        try {
          await ed.evaluate(() => {
            const eddom = document.getElementById('editor');
            eddom.innerHTML = '<p>Lorem ipsum dolor sit amet.</p><p>Consectetur adipiscing elit sed do.</p>';
            eddom.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelectorAll('.dialog-overlay.open,.insert-pop.open,.menu-list.open,.rb-menu.open')
              .forEach(e => e.classList.remove('open'));
          });
          await arm();
          const b2 = await snap();
          await handles[k].click({ timeout: 1500, force: true });
          await sleep(700);
          const a2 = await snap();
          if (a2.html !== b2.html) eff.push('doc');
          if (a2.menus > b2.menus) eff.push('menu');
          if (a2.dialogs > b2.dialogs) eff.push('dialog');
          if (a2.panels > b2.panels) eff.push('panel');
          if (a2.status !== b2.status) eff.push('status');
          if (a2.chrome !== b2.chrome) eff.push('chrome');
          if (eff.length) eff.push('retry');
        } catch (e) {}
      }
      const row = { tab, key, label: m.label, effect: clicked ? (eff.length ? eff.join('+') : 'silent') : 'unclickable', why, statusText: '' };
      // report the status bar text when present (so a "Not available <cmd>"
      // loud-stub message is visible in the output — that's a real gap)
      if (eff.length && (eff.includes('status') || eff.includes('dialog') || eff.includes('panel'))) {
        const st = await snap();
        row.statusText = st.status || '';
      }
      rows.push(row);
      await cleanup();
    }
    await cleanup();
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'fx-prod.json'), JSON.stringify({
    engine: 'world-office-rust', url: OC_URL, capturedAt: new Date().toISOString(),
    pageErrors: errs.slice(0, 5), controls: rows,
  }, null, 1) + '\n');
  const silent = rows.filter(r => (r.effect === 'silent' || r.effect === 'unclickable') && !EXPECTED_SILENT.has(r.key || r.label));
  const expected = rows.filter(r => EXPECTED_SILENT.has(r.key || r.label) && (r.effect === 'silent' || r.effect === 'unclickable'));
  console.log(`fx-prod: ${rows.length} controls, ${silent.length} silent/unclickable, ${expected.length} expected-silent` +
    (silent.length ? '\n  ' + silent.map(r => `[${r.tab}] ${r.key || r.label} (${r.effect})`).join('\n  ') : ''));
  await browser.close();
  process.exit(silent.length ? 1 : 0);
})().catch(e => { console.error('fx-prod FATAL', e.message); process.exit(1); });
