const { chromium } = require('/home/weiss/actions-runner-opendesk-edu-2/_work/opendesk-edu-website/opendesk-edu-website/node_modules/playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8735/rig-editor.html', { waitUntil: 'domcontentloaded' });
  let f = null, ready = false;
  for (let i = 0; i < 50; i++) {
    await sleep(3000);
    f = page.frames().find(x => x.url().includes('/web-apps/'));
    if (f) ready = await f.evaluate(() => {
      const tb = document.querySelector('#toolbar');
      return !!tb && tb.querySelectorAll('.ribtab, li[data-tab], .group').length > 0;
    }).catch(() => false);
    if (ready) break;
  }
  if (!ready) {
    const err = f ? await f.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 150)).catch(() => '') : 'no frame';
    console.log('NOT READY. err:', err);
    await browser.close(); return;
  }
  await sleep(6000);
  const lines = await f.evaluate(() => {
    const out = [];
    const cls = el => (el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).split(' ').filter(Boolean).slice(0, 2).join('.');
    const skel = (el, depth) => {
      if (depth > 4 || out.length > 400) return;
      for (const c of el.children) {
        const r = c.getBoundingClientRect();
        if (r.width < 1 && r.height < 1) continue;
        out.push('  '.repeat(depth) + c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') + (cls(c) ? '.' + cls(c) : '') + ' [' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ']');
        skel(c, depth + 1);
      }
    };
    skel(document.querySelector('#toolbar'), 0);
    return out;
  }).catch(e => [String(e).slice(0, 150)]);
  require('fs').writeFileSync('/tmp/oo-toolbar-skel.txt', lines.join('\n'));
  console.log('captured', lines.length, 'nodes');
  // styles control specifically
  const st = await f.evaluate(() => {
    const el = document.querySelector('#slot-btn-style, #id-toolbar-field-style, [id*="style"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const inner = [...el.querySelectorAll('.combo, input, button, .item')].slice(0, 3).map(k => { const kr = k.getBoundingClientRect(); return (k.id || String(k.className).split(' ')[0]) + ' ' + Math.round(kr.width) + 'x' + Math.round(kr.height); });
    return { id: el.id, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], inner };
  });
  console.log('STYLES:', JSON.stringify(st));
  await f.evaluate(() => { const tb = document.querySelector('#toolbar'); tb.style.outline = 'none'; }).catch(() => {});
  await page.screenshot({ path: '/tmp/oo-rig.png' }).catch(() => {});
  await browser.close();
})();
