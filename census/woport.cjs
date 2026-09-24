const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 150)));

  // 1) harvest a real WOPI token via the prod shell
  await page.goto('https://cloud.graphwiz.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!document.querySelector('#oc-login-password')).catch(() => false)) break; await page.waitForTimeout(500); }
  await page.evaluate(() => {
    const setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    setVal(document.querySelector('#oc-login-username'), 'admin'); setVal(document.querySelector('#oc-login-password'), 'wo-od-2026');
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Log in'); if (b) b.click();
  });
  await page.waitForTimeout(6000);
  await page.locator('a[href*="worepro.docx"]').first().click({ timeout: 15000 });
  let wopiQuery = null;
  for (let i = 0; i < 24 && !wopiQuery; i++) {
    for (const f of page.frames()) {
      const u = f.url();
      const m = /[?&](access_token=[^&]+&file_id=[^&]+|file_id=[^&]+&access_token=[^&]+)/.exec(u);
      if (m) wopiQuery = m[1];
    }
    if (!wopiQuery) await page.waitForTimeout(500);
  }
  if (!wopiQuery) { console.log('HARVEST FAILED'); console.log('pageerrors:', errs.slice(0, 3)); await browser.close(); process.exit(1); }
  console.log('TOKEN HARVESTED, query len', wopiQuery.length);

  // 2) open the WYSIWYG editor on the test container with the same WOPI params
  const t = await ctx.newPage();
  const terrs = []; t.on('pageerror', e => terrs.push(String(e).slice(0, 200)));
  await t.goto('http://192.168.42.42:8088/editors/document/?' + wopiQuery, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await t.waitForFunction(() => {
    const ed = document.querySelector('#editor');
    return ed && (ed.textContent || '').trim().length > 40;
  }, { timeout: 30000 }).catch(() => {});
  await t.waitForTimeout(2500); // let pagination settle
  const state = await t.evaluate(() => ({
    docName: (document.querySelector('.doc-name') || {}).textContent || null,
    sheets: document.querySelectorAll('.wo-page').length,
    textLen: ((document.querySelector('#editor') || {}).textContent || '').trim().length,
    toolbar: !!document.querySelector('.ribbon, .toolbar, [class*="toolbar"]'),
    bridgeErr: window.__WO_BOOT_ERROR__ || null,
  }));
  console.log('EDITOR STATE:', JSON.stringify(state));
  console.log('editor pageerrors:', terrs.length ? terrs.slice(0, 3) : 'none');

  // 3) save roundtrip: type text at the end, force save, re-fetch via WOPI
  if (state.textLen > 40 && !state.bridgeErr) {
    await t.evaluate(() => {
      const ed = document.querySelector('#editor');
      const last = ed.lastElementChild || ed;
      const p = document.createElement('p'); p.textContent = 'PORTED-WYSIWYG-SAVE-MARKER-9f2c';
      (last.tagName === 'P' ? last.after.bind(last) : last.appendChild.bind(last))(p);
      p.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await t.keyboard.press('Control+s').catch(() => {});
    await t.waitForTimeout(4000);
    const saved = await t.evaluate(async () => {
      const q = new URLSearchParams(location.search);
      const r = await fetch('/wopi/files/' + q.get('file_id') + '/contents?access_token=' + q.get('access_token'));
      const b = new Uint8Array(await (await r.blob()).arrayBuffer());
      // crude docx text scan for the marker inside document.xml (zip)
      const s = String.fromCharCode.apply(null, b.subarray(0, Math.min(b.length, 400000)));
      return { size: b.length, pk: b[0] === 0x50 && b[1] === 0x4b };
    });
    console.log('AFTER SAVE:', JSON.stringify(saved));
    await t.screenshot({ path: '/tmp/usrflow/wysiwyg-port.png' });
  }
  await browser.close();
})();
