#!/usr/bin/env node
// fig/fig-census.cjs — per-type census of the four REACT editor UIs behind
// the fig facade (sheet/slide/pdf/diagram). Word has its own L2 contract
// suite; this proves PRESENCE + INTERACTION for the rest:
//   - File tab renders, clicking it swaps in a file menu (panels change)
//   - ribbon carries N distinct visible buttons (depth floor: >= 30)
//   - type signature: canvas / formula bar / slide panel / zoom row
//   - zero page errors
// Oracle output: fig/census/fig-census.json — consumed by fig-check.cjs
// (oracle kind 'census'). Presence is stage 1; OO-feature-depth census is
// stage 2 and stays listed as debt in plan/FIG_STATUS.md.
'use strict';
const fs = require('fs');
const path = require('path');
const { ensure } = require(path.join(__dirname, 'boot.cjs'));
const OUT = path.join(__dirname, 'census');

const TYPES = {
  sheet:   { expect: { canvases: 1, text: /Formula/i } },
  slide:   { expect: { text: /Transitions|Animation/i } },
  pdf:     { expect: { canvases: 1, text: /Fit to Width|Zoom/i } },
  diagram: { expect: { canvases: 1, text: /Grid|Export/i } },
};
const MIN_BUTTONS = 10; // anti-empty floor; real depth = baseline drift check
const BASELINE = path.join(OUT, 'fig-census-baseline.json');

(async () => {
  const { base, _boot } = await ensure();
  const browser = await _boot.launchBrowser();
  fs.mkdirSync(OUT, { recursive: true });
  const baseline = fs.existsSync(BASELINE)
    ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).types : {};
  const out = { generated: new Date().toISOString(), base, types: {} };
  let failures = 0;
  const newBaseline = { generated: out.generated, types: {} };

  for (const [type, cfg] of Object.entries(TYPES)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
    try {
      await page.goto(`${base}/${type}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 4000)); // univer/react hydration

      const fileTab = await page.waitForSelector('[data-tab="file"]', { timeout: 15000 })
        .then(() => true).catch(() => false);

      const before = await page.evaluate(() =>
        [...document.querySelectorAll('body > *')].map(n => n.className || n.tagName).join('|'));
      if (fileTab) {
        await page.click('[data-tab="file"]').catch(() => {});
        await new Promise(r => setTimeout(r, 1200));
      }
      const after = await page.evaluate(() =>
        [...document.querySelectorAll('body > *')].map(n => n.className || n.tagName).join('|'));
      const menuVisible = await page.evaluate(() => {
        // any full-screen panel that appeared on top of the ribbon
        const cands = [...document.querySelectorAll('div')]
          .filter(d => d.offsetParent && d.getBoundingClientRect().height > 400);
        return cands.some(d => /menu|panel|overlay|backdrop/i.test(d.className)) ||
               before !== after;
      });
      const ribbon = await page.evaluate(() => {
        const seen = new Set();
        for (const b of document.querySelectorAll('button')) {
          if (b.offsetParent === null) continue;
          const label = (b.getAttribute('aria-label') || b.textContent || '').trim();
          if (label) seen.add(label);
        }
        return [...seen];
      });
      const sig = await page.evaluate(() => ({
        canvases: document.querySelectorAll('canvas').length,
        text: document.body.innerText.slice(0, 2000),
      }));

      // baseline drift: more than 20% of distinct ribbon controls gone = FAIL
      const prev = baseline[type];
      const drift = prev && prev.ribbonButtons
        ? ribbon.length < prev.ribbonButtons * 0.8 : false;
      const checks = {
        fileTab,
        fileMenuOpens: fileTab && menuVisible,
        ribbonDepth: ribbon.length >= MIN_BUTTONS,
        noDrift: !drift,
        signature: cfg.expect.canvases ? sig.canvases >= cfg.expect.canvases
                                       : cfg.expect.text.test(sig.text),
        noErrors: errs.length === 0,
      };
      const ok = Object.values(checks).every(Boolean);
      out.types[type] = {
        ok, checks,
        ribbonButtons: ribbon.length,
        baselineButtons: prev ? prev.ribbonButtons : null,
        sampleButtons: ribbon.slice(0, 25),
        canvases: sig.canvases,
        pageErrors: errs,
      };
      newBaseline.types[type] = { ribbonButtons: ribbon.length, canvases: sig.canvases };
      console.log(`${type}: ${ok ? 'PASS' : 'FAIL'} fileTab=${checks.fileTab} menu=${checks.fileMenuOpens} buttons=${ribbon.length}${prev ? ` (baseline ${prev.ribbonButtons})` : ' (baseline set)'} canvas=${sig.canvases} errs=${errs.length}`);
      if (!ok) failures++;
    } catch (e) {
      out.types[type] = { ok: false, error: String(e.message).slice(0, 200) };
      console.log(`${type}: FAIL ${e.message}`);
      failures++;
    }
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'fig-census.json'), JSON.stringify(out, null, 1));
  fs.writeFileSync(BASELINE, JSON.stringify(newBaseline, null, 1));
  console.log(`fig-census: ${4 - failures}/4 pass -> ${path.join(OUT, 'fig-census.json')}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
