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
    const out = {};
    const grp = document.querySelector('#slot-field-styles');
    const kids = [];
    const walk = (el, d) => { if (d > 3) return; for (const c of el.children) { const r = c.getBoundingClientRect(); kids.push('  '.repeat(d) + c.tagName.toLowerCase() + (c.id ? '#' + c.id : '') + '.' + (String(c.className.baseVal !== undefined ? c.className.baseVal : c.className || '')).split(' ').filter(Boolean).slice(0, 2).join('.') + ' [' + Math.round(r.x) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ']'); walk(c, d + 1); } };
    walk(grp, 0);
    out.stylesGroup = kids.slice(0, 60);
    // first two groups (clipboard/font)
    const panels = document.querySelector('.panel.active');
    out.tabLabels = [...document.querySelectorAll('li.ribtab')].map(t => t.textContent.trim());
    // doc name + right btn group
    const dn = document.querySelector('#box-doc-name'); const rgt = document.querySelector('#box-right-btn-group');
    out.docname = dn ? dn.textContent.trim().slice(0, 40) : null;
    out.rightBtns = rgt ? [...rgt.querySelectorAll('button, .btn-users, [id*=btn]')].map(b => (b.id || String(b.className).split(' ')[0]) + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)) : null;
    // quick access panel contents
    const qa = document.querySelector('.box-controls > .panel.static');
    out.quickAccess = qa ? [...qa.querySelectorAll('.elset')].map(e => { const r = e.getBoundingClientRect(); const inner = e.querySelector('[id]'); return (inner ? inner.id : e.className) + ' ' + Math.round(r.x) + ',' + Math.round(r.y); }) : null;
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
