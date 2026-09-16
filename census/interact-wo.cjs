#!/usr/bin/env node
// interact-wo.cjs — INTERACTION census of the World-Office editor.
//
// The structural census (census-wo.cjs) proves buttons EXIST, but never
// clicks one — so "opens a weird overlay" / "opens nothing where OO opens a
// dialog" are invisible to it. This census clicks every toolbar button and
// classifies what surface appears, so the parity join can compare
// INTERACTION TYPES, not just structure:
//
//   opens: modal   — a .dialog-overlay[role=dialog] became visible
//          menu    — a .menu-list / #file-menu / #ctx-menu appeared
//          panel   — a side panel (#nav-panel, #chat-panel, #review-panel)
//          none    — nothing opened (quiet state toggle, or a MISSING surface)
//   inside_vp / clipped — lets the join flag misplaced "weird" overlays.
//
// Same launch contract as census-wo.cjs: CENSUS_WO_URL points at an already
// running server-mode editor page (reconcile.py spawns it). Output:
// CENSUS_OUT/interact-wo.json
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clearLocks = () => {
  if (process.env.CENSUS_WO_URL) return;
  try { execSync(`docker compose -f ${ROOT}/docker-compose.yml exec -T mariadb sh -c 'mariadb -u root -p"$MYSQL_ROOT_PASSWORD" nextcloud -e "DELETE FROM oc_files_lock; DELETE FROM oc_file_locks;"'`, { cwd: ROOT, stdio: 'pipe' }); } catch {}
};
clearLocks();

// ── page-side logic (real functions: playwright serializes + runs them) ──
const classify = () => {
  const vp = { vw: innerWidth, vh: innerHeight };
  const vis = el => {
    if (!el || el.hidden) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  const modal = [...document.querySelectorAll('.dialog-overlay')].find(e => vis(e) && e.classList.contains('open'));
  const menu = [...document.querySelectorAll('#file-menu, #ctx-menu, .menu-list, [role=menu], .insert-pop')]
    .find(e => vis(e) && !e.hidden);
  const panel = [...document.querySelectorAll('#nav-panel, #chat-panel, #review-panel, #comments-panel')]
    .find(e => vis(e) && !e.hidden);
  let el = null, kind = 'none', boxEl = null;
  if (modal) { el = modal; kind = 'modal'; boxEl = modal.querySelector(':scope > .dialog') || modal; }
  else if (menu) { el = menu; kind = 'menu'; boxEl = menu; }
  else if (panel) { el = panel; kind = 'panel'; boxEl = panel; }
  if (!el) return { opens: 'none' };
  const r = boxEl.getBoundingClientRect();
  return {
    opens: kind, id: el.id || null,
    box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    inside_vp: r.x >= -1 && r.y >= -1 && r.x + r.width <= vp.vw + 1 && r.y + r.height <= vp.vh + 1,
    clipped_x: r.x < -1 || r.x + r.width > vp.vw + 1,
    clipped_y: r.y < -1 || r.y + r.height > vp.vh + 1,
    controls: el.querySelectorAll('button, input, select, [role=menuitem], [class*="item"]').length,
  };
};
const bus = ([cmd, value]) =>
  dispatchEvent(new CustomEvent('wo-command', { detail: { command: cmd, value: value } }));
const closeAll = () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  document.querySelectorAll('.dialog-overlay.open').forEach(d => {
    const b = d.querySelector('button[id$="-close"], .find-close, [data-dialog-close]');
    if (b) b.click();
    else {
      d.classList.remove('open');
      d.style.display = '';
    }
  });
  ['#file-menu', '#ctx-menu', '#nav-panel', '#chat-panel', '#review-panel', '#comments-panel']
    .forEach(s => { const e = document.querySelector(s); if (e) e.hidden = true; });
};
const clickFileItem = label => {
  const els = [...document.querySelectorAll('#file-menu [role=menuitem], #file-menu .menu-item, #file-menu button')]
    .filter(b => b.offsetParent !== null);
  const e = els.find(x => (x.textContent || '').trim() === label);
  if (e) e.click();
  return !!e;
};

(async () => {
  const { chromium } = require('playwright');
  let LAUNCH;
  if (process.env.CENSUS_WO_URL) {
    LAUNCH = process.env.CENSUS_WO_URL;
  } else {
    const MINT = execSync(`node ${ROOT}/compose/worldoffice/mint.mjs fixture`, { cwd: ROOT, encoding: 'utf8' });
    const g = k => (MINT.match(new RegExp(`${k}=(\\S+)`)) || [])[1];
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
  await page.waitForTimeout(3500);

  const interactions = [];
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.ribbon-tab')].map(t => t.dataset.tab));
  for (const slug of tabs) {
    await page.evaluate(s => { const t = document.querySelector(`.ribbon-tab[data-tab="${s}"]`); if (t) t.click(); }, slug);
    await sleep(320);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.ribbon-page.active button')]
      .filter(b => b.offsetParent !== null && !b.disabled)
      .map(b => {
        const r = b.getBoundingClientRect();
        return { id: b.id || null, cmd: b.dataset.cmd || null, label: ((b.textContent || '').trim() || b.getAttribute('aria-label') || null),
                 x: Math.round(r.x), y: Math.round(r.y) };
      })
      // dedupe: id-less split-buttons repeat the same command many times
      .filter((b, i, arr) => arr.findIndex(x => (x.cmd && x.cmd === b.cmd) || (x.id && x.id === b.id)) === i));
    for (const b of rows) {
      if (!b.cmd && !b.id) continue;   // nothing to click (separator/structural)
      let res = null;
      try {
        if (b.cmd) await page.evaluate(bus, [b.cmd, undefined]);   // command-wired: bus dispatch
        else await page.evaluate(id => { const e = document.getElementById(id); if (e) e.click(); }, b.id); // id-wired: real click
        await sleep(140);
        res = await page.evaluate(classify);
      } catch (e) {
        res = { opens: 'error', msg: String(e.message).slice(0, 60) };
      }
      interactions.push({ tab: slug, ...b,
        opens: res.opens, surface_id: res.id, box: res.box,
        inside_vp: res.inside_vp, clipped_x: res.clipped_x, clipped_y: res.clipped_y,
        controls: res.controls, msg: res.msg });
      await page.evaluate(closeAll).catch(() => {});
      await sleep(60);
      if (interactions.length % 40 === 0) console.log(`  interact ${interactions.length} …`);
    }
    console.log(`interacted ${slug}: ${rows.length} buttons`);
  }

  // file-menu rows (top-left menu): open, enumerate, click each visible item
  // the editor toggles the menu on CLICK — a dispatched mousedown never opens it
  const fileTrigger = await page.$('#btn-file');
  if (fileTrigger) { await fileTrigger.click(); await sleep(400); }
  const items = await page.evaluate(() => [...document.querySelectorAll('#file-menu [role=menuitem], #file-menu .menu-item, #file-menu button')]
    .filter(b => b.offsetParent !== null).map(b => ({ label: ((b.textContent || '').trim() || null) })));
  for (const it of items) {
    let res = null;
    try {
      const ok = await page.evaluate(clickFileItem, it.label);
      await sleep(160);
      res = ok ? await page.evaluate(classify) : { opens: 'none' };
    } catch (e) { res = { opens: 'error', msg: String(e.message).slice(0, 60) }; }
    interactions.push({ tab: 'menu-file', id: null, cmd: null, label: it.label,
      opens: res.opens, surface_id: res.id, box: res.box, msg: res.msg });
    await page.evaluate(closeAll).catch(() => {});
    await sleep(80);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const byType = {};
  for (const i of interactions) byType[i.opens] = (byType[i.opens] || 0) + 1;
  const json = { engine: 'worldoffice', capturedAt: new Date().toISOString(), viewport: '1440x900', interactions };
  fs.writeFileSync(`${OUT}/interact-wo.json`, JSON.stringify(json, null, 1));
  console.log(`interact-wo.json: ${interactions.length} interactions ${JSON.stringify(byType)} -> ${OUT}`);
  await browser.close();
  try { if (typeof br !== 'undefined') process.kill(-br.pid); } catch {}
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
