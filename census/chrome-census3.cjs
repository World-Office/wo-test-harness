#!/usr/bin/env node
/* chrome-census3.cjs — ribbon VISUAL parity rig (research-backed, v3)
 *
 * census2 measures DOM geometry + computed styles (structure). This layer
 * adds what the software-development-research corpus says structural census
 * cannot see ("Beyond Pixel Diffs" 2607.01728: pixel/geometry comparison is
 * semantically blind; "Does It Render Everywhere?" 2608.12518: most breakage
 * is layout at non-default widths; "You Don't Know Until You Click" 2508.14104:
 * static checks miss interactive behavior; "Snapshot Testing" 2610.29549:
 * review noise is the enemy — diffs must be region-scoped and few).
 *
 * Three new signals per ribbon band:
 *   1. VIEWPORT MATRIX  [1280, 1440, 1680, 1920]
 *   2. RASTER PROFILE   column-ink histogram (64 buckets) + ink% + colored%
 *      -> catches missing icons / empty groups geometry can't see
 *   3. CLICK-THROUGH    per-tab open-state: same raster metrics AFTER tab click
 *
 * Run: node chrome-census3.cjs [--out /tmp/census3.json]
 * OO band captured via the frameEditor element (outer-page clip = demo page).
 */
const fs = require('fs');
const { chromium } = require('/home/weiss/.npm-global/lib/node_modules/playwright/index.mjs');
const { PNG } = require('/home/weiss/node_modules/pngjs/lib/png.js');

const WO_URL = process.env.WO_URL || 'https://editor.cloud.graphwiz.ai/word/';
const OO_DEMO = process.env.OO_DEMO || 'https://world-office.graphwiz.ai/demo';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '/tmp/census3.json';
const VIEWPORTS = [1280, 1440, 1680, 1920];
const TABS = ['home', 'insert'];
const LOCALE = { locale: 'de-DE', extraHTTPHeaders: { 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8' } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── raster profile of a PNG buffer ─────────────────────────────────────
// 64-bucket column-ink histogram + global ink% (dark) + colored% (sat>0.2) +
// neutral% (near-gray). Catches "group present in DOM but renders empty".
function rasterProfile(shot) {
  const img = PNG.sync.read(shot);
  const { width: w, height: h } = img;
  const buckets = 64;
  const colInk = new Array(buckets).fill(0);
  const colAll = new Array(buckets).fill(0);
  let ink = 0, colored = 0, neutral = 0, total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const bIdx = Math.min(buckets - 1, Math.floor((x / w) * buckets));
      total++;
      colAll[bIdx]++;
      if (lum < 120) { ink++; colInk[bIdx]++; }
      if (sat > 0.2) colored++;
      if (sat < 0.05) neutral++;
    }
  }
  // normalized ink per column vs global mean -> density "spikes"
  const globalInk = total ? ink / total : 0;
  const profile = colInk.map((c, i) => ({
    col: i, w: Math.round((i + 1) / buckets * w) - Math.round(i / buckets * w),
    ink: +(c / (colAll[i] || 1)).toFixed(3),
    spike: +((c / (colAll[i] || 1)) / (globalInk + 1e-6)).toFixed(2),
  }));
  return {
    w, h,
    inkPct: +(ink / total * 100).toFixed(2),
    coloredPct: +(colored / total * 100).toFixed(2),
    neutralPct: +(neutral / total * 100).toFixed(2),
    bins: profile,
  };
}

// region diff: compare two raster profiles, report biggest divergence columns
function rasterDiff(a, b) {
  const n = Math.min(a.bins.length, b.bins.length);
  let sum = 0, worst = { idx: -1, d: 0 };
  const details = [];
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a.bins[i].ink - b.bins[i].ink);
    sum += d;
    if (d > worst.d) worst = { idx: i, d };
    if (d > 0.04) details.push({ col: i, d: +d.toFixed(3), x0: a.bins[i].w - (Math.round((i + 1) / n * a.w) - Math.round(i / n * a.w)), x: Math.round(i / n * a.w) });
  }
  // caption: human words per the research prescription (WUICC / Snapshot papers)
  const ink = a.inkPct - b.inkPct;
  const col = a.coloredPct - b.coloredPct;
  let caption;
  if (Math.abs(ink) < 0.3 && Math.abs(col) < 0.3) caption = 'visually equivalent band';
  else if (Math.abs(ink) < 0.8) caption = 'band renders, some visual drift';
  else caption = `band visually SPARSER than OO (ink −${Math.abs(ink).toFixed(1)}pt)${col < -0.4 ? ' and more monochrome (color −' + Math.abs(col).toFixed(1) + 'pt)' : ''} — likely a hidden/collapsed group`;
  return {
    meanColInkΔ: +(sum / n).toFixed(4),
    inkΔ: +(a.inkPct - b.inkPct).toFixed(2),
    coloredΔ: +(a.coloredPct - b.coloredPct).toFixed(2),
    worstCol: worst.idx >= 0 ? { col: worst.idx, d: +worst.d.toFixed(3) } : null,
    detailCols: details.slice(0, 6),
    caption,
  };
}

// ── WO band capture per viewport/tab ───────────────────────────────────
async function woBand(b, vpW, tab) {
  const pg = await b.newPage({ viewport: { width: vpW, height: 950 }, ...LOCALE });
  await pg.goto(WO_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pg.waitForTimeout(5000);
  if (tab) await pg.click(`.ribbon-tab[data-tab="${tab}"]`).catch(() => {});
  await pg.waitForTimeout(1200);
  await pg.waitForSelector('.toolbar', { timeout: 15000 });
  const rr = await pg.evaluate((w) => {
    const el = document.querySelector('.toolbar');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: 0, y: Math.round(r.y - 32), width: w, height: Math.round(r.height + 32) };
  }, vpW);
  if (!rr || !rr.width) { await pg.close(); return null; }
  const shot = await pg.screenshot({ clip: rr });
  await pg.close();
  return rasterProfile(shot);
}

// ── OO band capture via frameEditor element screenshot ─────────────────
async function ooContext(p) {
  const ctx = await p.newContext({ viewport: { width: 1680, height: 950 }, ...LOCALE });
  const op = await ctx.newPage();
  await op.goto(OO_DEMO, { waitUntil: 'load', timeout: 90000 });
  await sleep(6000);
  const fe = await op.$('.file');
  if (fe) await fe.click();
  await sleep(15000);
  const fr = op.frames().find((f) => f.name() === 'frameEditor');
  return { ctx, op, fr };
}

async function ooBand(p, op, fr, tab) {
  if (tab === 'home' && fr) {
    await fr.evaluate(() => { const t = [...document.querySelectorAll('.tabs li a, .ribtab a, .ribtab')].find(x => x.textContent?.includes('Startseite') || x.id === 'home'); if (t) t.click(); });
  } else if (fr) {
    await fr.evaluate(() => { const t = [...document.querySelectorAll('.tabs li a, .ribtab a, .ribtab')].find(x => x.textContent?.includes('Einfügen')); if (t) t.click(); });
  }
  await sleep(1500);
  // element screenshot of the editor TOOLBAR inside the frame -> band only,
  // no canvas/document ink polluting the profile
  const shot = await fr.locator('.toolbar').screenshot();
  return rasterProfile(shot);
}

(async () => {
  const report = { capturedAt: new Date().toISOString(), viewports: VIEWPORTS, tabs: TABS, rows: [] };
  const b = await chromium.launch();

  // OO demo is fixed-size; capture its band ONCE for reference
  const { ctx, op, fr } = await ooContext(b);
  const ooRef = { home: await ooBand(b, op, fr, 'home'), insert: await ooBand(b, op, fr, 'insert') };

  for (const vp of VIEWPORTS) {
    const row = { viewport: vp, tabs: {} };
    for (const tab of TABS) {
      const wo = await woBand(b, vp, tab);
      if (!wo) continue;
      const oo = tab === 'home' ? ooRef.home : ooRef.insert;
      row.tabs[tab] = { wo, oo, diff: rasterDiff(wo, oo) };
    }
    report.rows.push(row);
  }
  await ctx.close();
  await b.close();

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n=== ${OUT} ===`);
  for (const r of report.rows) {
    for (const [tab, d] of Object.entries(r.tabs)) {
      const dd = d.diff;
      const worst = dd.worstCol ? ` worstCol#${dd.worstCol.col}(d=${dd.worstCol.d})` : '';
      console.log(`${r.viewport}px ${tab.padEnd(6)} WO ink=${d.wo.inkPct}% col=${d.wo.coloredPct}% | OO ink=${d.oo.inkPct}% col=${d.oo.coloredPct}% | Δink=${dd.inkΔ} Δcol=${dd.coloredΔ} meanΔ=${dd.meanColInkΔ}${worst} :: ${dd.caption}`);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
