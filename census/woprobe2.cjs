const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await ctx.newPage();
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
    for (const f of page.frames()) { const m = /[?&](access_token=[^&]+&file_id=[^&]+|file_id=[^&]+&access_token=[^&]+)/.exec(f.url()); if (m) wopiQuery = m[1]; }
    if (!wopiQuery) await page.waitForTimeout(500);
  }
  const t = await ctx.newPage();
  const netlog = []; t.on('response', r => { if (r.url().includes('/api/conversion')) netlog.push(r.status() + ' ' + r.url().slice(0, 60)); });
  await t.goto('http://192.168.42.42:8088/editors/document/?' + wopiQuery, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await t.waitForTimeout(4000);
  const probe = await t.evaluate(async () => {
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
    const q = new URLSearchParams(location.search);
    const r1 = await fetch('/wopi/files/' + q.get('file_id') + '/contents?access_token=' + q.get('access_token'));
    const buf = new Uint8Array(await (await r1.blob()).arrayBuffer());
    const r = await fetch('/api/conversion/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: b64(buf), source_format: 'docx', target_format: 'html' }) });
    const j = await r.json();
    return { convStatus: r.status, status: j.status, dataLen: j.data ? j.data.length : 0, error: j.error, frag: j.data ? atob(j.data).slice(0, 200) : null };
  });
  console.log('CONV:', JSON.stringify(probe, null, 1));
  console.log('netlog:', netlog);
  await browser.close();
})();
