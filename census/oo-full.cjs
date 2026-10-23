const { chromium } = require('/home/weiss/actions-runner-opendesk-edu-2/_work/opendesk-edu-website/opendesk-edu-website/node_modules/playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8735/rig-editor.html', { waitUntil: 'domcontentloaded' });
  let f = null, ready = false;
  for (let i = 0; i < 50; i++) { await sleep(3000); f = page.frames().find(x => x.url().includes('/web-apps/')); if (f) ready = await f.evaluate(() => { const tb = document.querySelector('#toolbar'); return !!tb && tb.querySelectorAll('.group').length > 0; }).catch(() => false); if (ready) break; }
  if (!ready) { console.log('not ready'); await browser.close(); return; }
  await sleep(5000);
  const info = await f.evaluate(() => {
    const panel = document.querySelector('#toolbar .panel.active');
    const btns = [...panel.querySelectorAll('button, input, .elset [id], .combo')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 5; });
    return btns.map(b => {
      const r = b.getBoundingClientRect();
      return (b.id || String(b.className).split(' ').slice(0, 2).join('.')) + ' @' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    });
  });
  console.log(info.join('\n'));
  await browser.close();
})();
