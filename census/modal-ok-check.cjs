#!/usr/bin/env node
// modal-ok-check.cjs — functional proof for the round-2 OO-parity option
// modals: each control OPENS its modal AND its OK button applies a REAL
// document effect (not a stub). One-shot verification, not a gate.
// Usage (after spawning a docserver): CENSUS_WO_URL=... node modal-ok-check.cjs
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const bus = ([cmd]) => dispatchEvent(new CustomEvent('wo-command', { detail: { command: cmd } }));

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(process.env.CENSUS_WO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#toolbar', { timeout: 30000 });
  await page.waitForTimeout(3500);

  const fail = [];
  const open = id => page.evaluate(id => { const d = document.getElementById(id); if (d) d.classList.add('open'); }, id);
  const closeAll = () => page.evaluate(() => {
    document.querySelectorAll('.dialog-overlay.open').forEach(d => d.classList.remove('open'));
  });
  const modalOpen = () => page.evaluate(() =>
    [...document.querySelectorAll('.dialog-overlay')].some(d => d.classList.contains('open') && getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().width > 4));

  // 1. dropcap — modal -> OK -> span.dropcap exists
  await page.evaluate(bus, ['toggleDropcap']); await sleep(250);
  if (!(await modalOpen())) fail.push('dropcap: no modal');
  await page.evaluate(() => {
    const s = document.querySelector('.ribbon-tab[data-tab="insert"]'); if (s) s.click();
  }); // ensure editor focused w/ a selection
  await page.evaluate(() => { const e = document.querySelector('#editor p'); if (e && e.firstChild) { const r = document.createRange(); r.selectNodeContents(e.firstChild); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } });
  await page.evaluate(() => document.getElementById('btn-dropcap-ok').click()); await sleep(200);
  const dc = await page.evaluate(() => !!document.querySelector('#editor span.dropcap'));
  if (!dc) fail.push('dropcap: OK did not apply span.dropcap');
  await closeAll();

  // 2. linenumbers — modal -> OK -> div.line-numbers marker
  await page.evaluate(bus, ['toggleLineNumbers']); await sleep(250);
  if (!(await modalOpen())) fail.push('linenumbers: no modal');
  await page.evaluate(() => { const e = document.getElementById('ln-mode'); if (e) e.value = 'restart-each-section'; });
  await page.evaluate(() => document.getElementById('btn-linenumbers-ok').click()); await sleep(200);
  const ln = await page.evaluate(() => { const m = document.querySelector('#editor div.line-numbers'); return m && m.getAttribute('data-restart') === 'newSection'; });
  if (!ln) fail.push('linenumbers: OK did not apply data-restart=newSection');
  await closeAll();

  // 3. hyphenation — modal -> OK -> div.hyphenation
  await page.evaluate(bus, ['toggleHyphenation']); await sleep(250);
  if (!(await modalOpen())) fail.push('hyphenation: no modal');
  await page.evaluate(() => document.getElementById('btn-hyphenation-ok').click()); await sleep(200);
  if (!(await page.evaluate(() => !!document.querySelector('#editor div.hyphenation')))) fail.push('hyphenation: OK did not apply marker');
  await closeAll();

  // 4. watermark — modal (custom) -> OK -> div.watermark w/ data-text
  await page.evaluate(bus, ['toggleWatermark']); await sleep(250);
  if (!(await modalOpen())) fail.push('watermark: no modal');
  await page.evaluate(() => { const e = document.getElementById('wm-mode'); if (e) e.value = 'custom'; const r = document.getElementById('wm-custom-row'); if (r) r.hidden = false; const t = document.getElementById('wm-text'); if (t) t.value = 'TOPMOST SECRET'; });
  await page.evaluate(() => document.getElementById('btn-watermark-ok').click()); await sleep(200);
  const wm = await page.evaluate(() => { const m = document.querySelector('#editor div.watermark'); return m && (m.getAttribute('data-text') || '').includes('TOPMOST'); });
  if (!wm) fail.push('watermark: OK did not apply custom text');
  await closeAll();

  // 5. pagecolor — id click opens modal (native picker replaced) -> swatch -> OK -> --paper
  await page.evaluate(() => document.getElementById('pagecolor').click()); await sleep(250);
  if (!(await modalOpen())) fail.push('pagecolor: no modal');
  await page.evaluate(() => { const s = document.querySelector('#pagecolor-swatches .color-swatch[data-color="#fdf8ec"]'); if (s) s.click(); });
  await page.evaluate(() => document.getElementById('btn-pagecolor-ok').click()); await sleep(200);
  const pc = await page.evaluate(() => document.querySelector('#editor').style.getPropertyValue('--paper').trim());
  if (pc !== '#fdf8ec') fail.push('pagecolor: OK did not set --paper (got ' + pc + ')');
  await closeAll();

  // 6. themecolors — id click opens modal -> scheme gold -> OK -> --ink
  await page.evaluate(() => document.getElementById('themecolors').click()); await sleep(250);
  if (!(await modalOpen())) fail.push('colors: no modal');
  await page.evaluate(() => { const e = document.getElementById('cs-scheme'); if (e) e.value = 'gold'; });
  await page.evaluate(() => document.getElementById('btn-colors-ok').click()); await sleep(200);
  const ink = await page.evaluate(() => document.querySelector('#editor').style.getPropertyValue('--ink').trim());
  if (ink !== '#352a17') fail.push('colors: OK did not set --ink (got ' + ink + ')');
  await closeAll();

  // 7. updateToc — command -> modal -> OK -> nav.toc + status
  await page.evaluate(bus, ['updateToc']); await sleep(250);
  if (!(await modalOpen())) fail.push('updatetoc: no modal');
  await page.evaluate(() => { const e = document.getElementById('toc-update'); if (e) e.value = 'entire'; });
  await page.evaluate(() => document.getElementById('btn-updatetoc-ok').click()); await sleep(250);
  if (!(await page.evaluate(() => !!document.querySelector('#editor nav.toc')))) fail.push('updatetoc: OK did not insert nav.toc');
  await closeAll();

  // 8. displayMode — command -> modal -> OK('final') -> dataset.viewMode
  await page.evaluate(bus, ['displayMode']); await sleep(250);
  if (!(await modalOpen())) fail.push('displaymode: no modal');
  await page.evaluate(() => { const e = document.getElementById('viewmode'); if (e) e.value = 'final'; });
  await page.evaluate(() => document.getElementById('btn-displaymode-ok').click()); await sleep(200);
  const vm = await page.evaluate(() => document.querySelector('#editor').dataset.viewMode);
  if (vm !== 'final') fail.push('displaymode: OK did not set viewMode=final (got ' + vm + ')');
  await closeAll();

  // 9. addtext — select text -> click btn -> modal -> OK -> span.add-text-mask
  await page.evaluate(() => { const e = document.querySelector('#editor p'); if (e && e.firstChild) { const r = document.createRange(); r.selectNodeContents(e.firstChild); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } });
  await page.evaluate(() => document.getElementById('btn-addtext').click()); await sleep(250);
  if (!(await modalOpen())) fail.push('addtext: no modal');
  await page.evaluate(() => { const e = document.getElementById('addtext-level'); if (e) e.value = '2'; });
  await page.evaluate(() => document.getElementById('btn-addtext-ok').click()); await sleep(200);
  const at = await page.evaluate(() => { const m = document.querySelector('#editor .add-text-mask'); return m && m.getAttribute('data-level') === '2'; });
  if (!at) fail.push('addtext: OK did not apply add-text mask with level');
  await closeAll();

  await browser.close();
  if (fail.length) { console.error('FAILURES:\n  ' + fail.join('\n  ')); process.exit(1); }
  console.log('MODAL-OK: all 9 dialogs open their modal AND OK applies a real document effect.');
})();
