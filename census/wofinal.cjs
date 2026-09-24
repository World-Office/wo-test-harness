const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)));

  await page.goto('https://cloud.graphwiz.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.evaluate(() => {
    const setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    setVal(document.querySelector('#oc-login-username'), 'admin'); setVal(document.querySelector('#oc-login-password'), 'wo-od-2026');
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Log in'); if (b) b.click();
  });
  await page.waitForTimeout(9000);
  await page.locator('a[href*="port-hfgate.docx"]').first().click({ timeout: 25000 });
  let wq = null;
  for (let i = 0; i < 30 && !wq; i++) {
    for (const f of page.frames()) { const m = /[?&](access_token=[^&]+&file_id=[^&]+|file_id=[^&]+&access_token=[^&]+)/.exec(f.url()); if (m) wq = m[1]; }
    if (!wq) await page.waitForTimeout(500);
  }
  if (!wq) { console.log('HARVEST FAILED; errs:', errs.slice(0, 3)); await browser.close(); process.exit(1); }

  const t = await ctx.newPage();
  const terrs = []; t.on('pageerror', e => terrs.push(String(e).slice(0, 200)));
  await t.goto('http://192.168.42.42:8088/editors/document/?' + wq, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await t.waitForFunction(() => { const ed = document.querySelector('#editor'); return ed && (ed.textContent || '').trim().length > 200; }, { timeout: 30000 }).catch(() => {});
  await t.waitForTimeout(3000); // pagination debounce
  const state = await t.evaluate(() => ({
    docName: (document.querySelector('.doc-name') || {}).textContent || null,
    sheets: document.querySelectorAll('.wo-page').length,
    textLen: ((document.querySelector('#editor') || {}).textContent || '').trim().length,
    hfClones: document.querySelectorAll('.wo-hf-clone').length,
    bridgeErr: window.__WO_BOOT_ERROR__ || null,
  }));
  console.log('EDITOR:', JSON.stringify(state));
  console.log('errs:', terrs.length ? terrs.slice(0, 3) : 'none');

  // save roundtrip
  if (state.textLen > 200 && !state.bridgeErr) {
    await t.evaluate(() => {
      const ed = document.querySelector('#editor');
      const p = document.createElement('p'); p.textContent = 'PORTED-WYSIWYG-SAVE-MARKER-9f2c';
      ed.appendChild(p); ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await t.keyboard.press('Control+s').catch(() => {});
    await t.waitForTimeout(5000);
    console.log('save requested');
    await t.screenshot({ path: '/tmp/usrflow/wysiwyg-port.png' });
  }
  await browser.close();
})();
