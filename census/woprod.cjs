const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
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

  // the shell embeds the editor iframe — find the frame with #editor
  let ed = null;
  for (let i = 0; i < 40 && !ed; i++) {
    for (const f of page.frames()) { if (f !== page.mainFrame()) { const has = await f.evaluate(() => !!document.querySelector('#editor')).catch(() => false); if (has) ed = f; } }
    if (!ed) await page.waitForTimeout(500);
  }
  if (!ed) { console.log('NO EDITOR FRAME; pageerrs:', errs.slice(0, 3)); await browser.close(); process.exit(1); }
  await ed.waitForFunction(() => { const e = document.querySelector('#editor'); return e && (e.textContent || '').trim().length > 200; }, { timeout: 30000 });
  await ed.waitForTimeout(3000);
  const state = await ed.evaluate(() => ({
    url: location.pathname,
    docName: (document.querySelector('.doc-name') || {}).textContent || null,
    sheets: document.querySelectorAll('.wo-page').length,
    textLen: ((document.querySelector('#editor') || {}).textContent || '').trim().length,
    bridgeErr: window.__WO_BOOT_ERROR__ || null,
  }));
  console.log('PROD EDITOR IN SHELL:', JSON.stringify(state));
  // edit + save inside the iframe
  await ed.evaluate(() => {
    const e2 = document.querySelector('#editor');
    const p = document.createElement('p'); p.textContent = 'PROD-SHELL-ROUNDTRIP-e3d9';
    e2.appendChild(p); e2.dispatchEvent(new Event('input', { bubbles: true }));
    window.dispatchEvent(new Event('online'));
  });
  const frameEl = await ed.frameElement();
  await frameEl.click().catch(() => {});
  await page.keyboard.press('Control+s').catch(() => {});
  await ed.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })));
  await ed.waitForTimeout(9000);
  console.log('save dispatched');
  await page.screenshot({ path: '/tmp/usrflow/prod-shell-wysiwyg.png' });
  await browser.close();
})();
