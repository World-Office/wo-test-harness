#!/usr/bin/env node
// census-wo.cjs — mechanical census of every World-Office control, same
// schema as census-oo.cjs so the parity diff is a JSON join.
// Per ribbon tab: activate, enumerate every button (id, label, data-stub,
// enabled) and select combos. Also: file menu, find dialog, comments panel,
// statusbar, context menu rows.
//
// Output: compose/visual/census/census-wo.json
// Usage: NODE_PATH=$(npm root -g) node compose/visual/census-wo.cjs
//
// CENSUS_WO_URL mode (no docker, no rig, no bridge): point at an already
// running server-mode editor page, e.g. a docserver spawned by
// reconcile.py: CENSUS_WO_URL=http://127.0.0.1:8000/editor/new-... node census-wo.cjs
// The census only enumerates DOM on the editor page, so a store-backed doc
// renders the identical toolbar as the WOPI-hosted one.
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
// reconcile.py sets CENSUS_OUT to keep the fresh capture out of the committed
// data dir in --check mode; normal runs default to census/ next to this file.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clearLocks = () => {
  if (process.env.CENSUS_WO_URL) return; // local server-mode run: nothing to unlock
  try { execSync(`docker compose -f ${ROOT}/docker-compose.yml exec -T mariadb sh -c 'mariadb -u root -p"$MYSQL_ROOT_PASSWORD" nextcloud -e "DELETE FROM oc_files_lock; DELETE FROM oc_file_locks;"'`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
};
clearLocks();

(async () => {
  const { chromium } = require('playwright');
  let LAUNCH;
  if (process.env.CENSUS_WO_URL) {
    LAUNCH = process.env.CENSUS_WO_URL;
  } else {
    const MINT = execSync(`node ${ROOT}/compose/worldoffice/mint.mjs fixture`, { cwd: ROOT, encoding: 'utf8' });
    const g = k => (MINT.match(new RegExp(`${k}=(\S+)`)) || [])[1];
    const fileId = g('fileId'), token = g('token');
    const br = spawn('node', [`${ROOT}/compose/worldoffice/bridge.mjs`],
      { env: { ...process.env, BRIDGE_TOKEN: token, BRIDGE_FILE: fileId, PORT: '8891' }, detached: true, stdio: 'ignore' });
    await sleep(1500);
    LAUNCH = `http://worldoffice.test:8080/editor?access_token=${token}&WOPISrc=192.168.42.42%3A8891%2Fwopi%2Ffiles%2F${fileId}`;
  }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(LAUNCH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#toolbar', { timeout: 30000 });
  await page.waitForTimeout(4000);

  const census = { engine: 'worldoffice', capturedAt: new Date().toISOString(), viewport: '1440x900', tabs: {}, surfaces: {} };

  const ENUM = () => ({
    buttons: [...document.querySelectorAll('.ribbon-page.active button')].map(b => {
      const r = b.getBoundingClientRect();
      return {
        id: b.id || null,
        stub: b.dataset.stub || undefined,
        cmd: b.dataset.cmd || undefined,
        hidden: b.offsetParent === null || undefined,
        label: ((b.textContent || '').trim() || b.getAttribute('aria-label') || undefined),
        enabled: !b.disabled,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      };
    }),
    combos: [
      ...[...document.querySelectorAll('.ribbon-page select')].filter(c => c.offsetParent !== null).map(c => ({
        id: c.id || null, label: (c.getAttribute('aria-label') || undefined), w: Math.round(c.getBoundingClientRect().width),
      })),
      // Color pickers are real surfaces too (text/highlight/shading); capture
      // them even when hidden (the shading picker lives off the toolbar).
      ...[...document.querySelectorAll('.ribbon-page input[type=color]')].map(c => ({
        id: c.id || null, label: (c.getAttribute('aria-label') || undefined), w: Math.round(c.getBoundingClientRect().width),
      })),
    ],
  });

  const tabs = await page.evaluate(() => [...document.querySelectorAll('.ribbon-tab')].map(t => ({
    slug: t.dataset.tab, label: (t.textContent || '').trim(), hidden: t.hidden,
  })));
  for (const t of tabs) {
    if (t.hidden) continue; // contextual H&F censused via its activation flow below
    await page.evaluate(s => document.querySelector(`.ribbon-tab[data-tab="${s}"]`).click(), t.slug);
    await sleep(350);
    census.tabs[t.slug] = { label: t.label, ...(await page.evaluate(ENUM)) };
    console.log(`censused ${t.slug}: ${census.tabs[t.slug].buttons.length} buttons`);
  }

  // contextual H&F: insert header, dblclick it, census the revealed tab.
  // btn-header now opens the header/footer options modal (OO parity), so
  // the census applies it (btn-headerfooter-ok emits insertHeader/Footer)
  // before dblclicking the created element.
  await page.evaluate(() => document.getElementById('btn-header')?.click());
  await sleep(400);
  await page.evaluate(() => document.getElementById('btn-headerfooter-ok')?.click());
  await sleep(700);
  await page.evaluate(() => document.querySelector('.page-header')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  await sleep(800);
  const hfShown = await page.evaluate(() => { const t = document.querySelector('.ribbon-tab[data-tab="header-footer"]'); return !!t && !t.hidden; });
  if (hfShown) {
    census.tabs['header-footer'] = { label: 'Header & Footer', contextual: true, ...(await page.evaluate(ENUM)) };
    console.log(`censused header-footer (contextual): ${census.tabs['header-footer'].buttons.length} buttons`);
    await page.evaluate(() => document.getElementById('btn-hf-close')?.click());
    await sleep(400);
  }
  // any option modal left open intercepts real clicks (file menu, dropdowns)
  await page.evaluate(() => document.querySelectorAll('.dialog-overlay.open').forEach(d => d.classList.remove('open')));
  await sleep(150);

  // file menu dropdown — the editor toggles it on CLICK, not mousedown
  // (a dispatched MouseEvent('mousedown') never opens it -> 0 rows forever)
  const fileTrigger = await page.$('#btn-file');
  if (fileTrigger) { await fileTrigger.click(); await sleep(500); }
  census.surfaces['menu-file'] = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll('#file-menu .menu-item, #file-menu button, #file-menu [role=menuitem]')]
      .filter(b => b.offsetParent !== null).map(b => ({
        id: b.id || null, label: ((b.textContent || '').trim() || undefined),
        enabled: !b.disabled && !((b.className + '').includes('disabled')),
      })),
  }));
  await page.keyboard.press('Escape');
  console.log(`censused menu-file: ${census.surfaces['menu-file'].buttons.length} rows`);

  // statusbar + zoom controls
  census.surfaces['statusbar'] = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll('.statusbar button, #statusbar button, [class*=status] button')]
      .filter(b => b.offsetParent !== null).map(b => {
        const r = b.getBoundingClientRect();
        return { id: b.id || null, label: ((b.getAttribute('aria-label') || b.textContent || '').trim() || undefined), enabled: !b.disabled, x: Math.round(r.x) };
      }),
    combos: [],
  }));

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/census-wo.json`, JSON.stringify(census, null, 1));
  const tb = Object.values(census.tabs).reduce((n, t) => n + t.buttons.length, 0);
  const sb = Object.values(census.surfaces).reduce((n, s) => n + s.buttons.length, 0);
  console.log(`census-wo.json: ${Object.keys(census.tabs).length} tabs (${tb} buttons) + ${sb} surface controls -> ${OUT}`);
  await browser.close();
  try { if (typeof br !== 'undefined') process.kill(-br.pid); } catch {}
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
