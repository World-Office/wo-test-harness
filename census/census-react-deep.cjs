#!/usr/bin/env node
// census-react-deep.cjs — deep census of the REACT word editor (the
// deployed /word since 2026-11-16): tabs, per-tab ribbon controls,
// File menu, left-panel/statusbar buttons. Capture-only (no gating);
// output census-react-deep.json for diffing against census-oo-deep.json.
//
// Usage:
//   CENSUS_REACT_URL=https://editor.cloud.graphwiz.ai/word/ node census-react-deep.cjs
//   (local: bash run-react-rig.sh first)
// Output: CENSUS_OUT/census-react-deep.json (default: census/census/)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL_BASE = process.env.CENSUS_REACT_URL;
const OUT = process.env.CENSUS_OUT || path.join(__dirname, 'census');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fui-Tab renders the label twice ("HomeHome") — halve when duplicated.
function dedupeTabText(t) {
  t = t.trim();
  if (t.length >= 2 && t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) {
    return t.slice(0, t.length / 2);
  }
  return t;
}

(async () => {
  if (!URL_BASE) throw new Error('CENSUS_REACT_URL is required');
  const browser = await chromium.launch();
  // Match the OO golden's viewport (1600x1000): the ribbon is responsive, so
  // rows/groups are only comparable to census-oo-deep.json at the same size.
  const VW = Number(process.env.CENSUS_VIEWPORT_W) || 1600;
  const VH = Number(process.env.CENSUS_VIEWPORT_H) || 1000;
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(9000); // wasm boot + demo load

  const tabEls = await page.$$('[role=tab]');
  const tabs = [];
  for (const el of tabEls) {
    const vis = await el.evaluate((e) => e.offsetParent !== null);
    if (vis) tabs.push(await el.evaluate((e) => (e.textContent || '').trim()));
  }
  const tabLabels = tabs.map(dedupeTabText).filter(Boolean);

  const perTab = {};
  const geometry = {}; // per-tab layout facts (rows/groups/boxes) — see REACT-BASELINE.md
  const ROW_EPS = 6;   // px: controls within this y-distance share a visual row
  for (const label of tabLabels) {
    if (/^(file)$/i.test(label)) continue; // file = menu, captured below
    try {
      await page.click(`[role=tab]:has-text("${label}")`, { timeout: 5000 });
    } catch { continue; }
    await sleep(700);
    perTab[label] = await page.evaluate((ROW_EPS) => {
      // Geometry (2026-11-25): label SETS cannot see "looks different" —
      // row alignment, group boundaries and left-to-right order are what make
      // a ribbon read as the same ribbon. OO's golden (census-oo-deep.json)
      // already carries x/y/w/h; capture the same here so both are comparable.
      const box = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const btns = [...document.querySelectorAll('button, [role=menuitem], select, input[type=checkbox][aria-label]')]
        .filter((e) => e.offsetParent !== null)
        .map((e) => ({
          label: (e.getAttribute('aria-label') || e.title || e.textContent || '').trim().slice(0, 60),
          disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
          kind: e.tagName === 'SELECT' ? 'select' : 'button',
          ...box(e),
        }))
        .filter((b) => b.label && !/^(Back|Save|Download As|Print|Protect|Info|Help|Suggest a Feature)$/i.test(b.label));
      // ribbon controls only: below the tab row, above the canvas
      const tabs = [...document.querySelectorAll('[role=tab]')].filter((e) => e.offsetParent !== null);
      const tabBottom = tabs.length ? Math.max(...tabs.map((e) => e.getBoundingClientRect().bottom)) : 0;
      const ribbon = btns.filter((b) => b.y >= tabBottom - 1 && b.y < tabBottom + 150);
      // rows: cluster by y (caret buttons sit a few px above their icon, so
      // exact-y would split one visual row into several)
      const sorted = [...ribbon].sort((a, b) => a.y - b.y || a.x - b.x);
      let row = -1, lastY = -Infinity;
      for (const b of sorted) { if (b.y - lastY > ROW_EPS) row++; b.row = row; lastY = b.y; }
      const rows = row + 1;
      // groups: within a row, a horizontal gap > GROUP_GAP px starts a new group
      const GROUP_GAP = 12;
      const groups = [];
      for (let r = 0; r < rows; r++) {
        const inRow = sorted.filter((b) => b.row === r);
        let right = -Infinity;
        for (const b of inRow) {
          const last = groups[groups.length - 1];
          if (!last || b.x - right > GROUP_GAP) groups.push({ row: r, x: b.x, right: b.x + b.w, n: 1 });
          else { last.right = Math.max(last.right, b.x + b.w); last.n++; }
          right = b.x + b.w;
        }
      }
      // Array stays an array (4 consumers iterate it). Geometry rides along as
      // non-index props: page.evaluate JSON-serializes, so return an OBJECT.
      // Keep the FULL button list as `buttons` (unchanged shape for consumers) and
      // carry the label on each ribbon box so geometry is self-describing: the two
      // lists are NOT index-aligned (buttons also holds statusbar/left-panel items).
      ribbon.sort((a, b) => a.row - b.row || a.x - b.x);
      return { buttons: btns, geometry: { rows, groups, ribbon } };
    }, ROW_EPS);
    geometry[label] = perTab[label].geometry;
    perTab[label] = perTab[label].buttons;
  }

  try {
    // Method 1: Try to click Header button in Insert tab
    await page.click('[role=tab]:has-text("Insert")', { timeout: 5000 });
    await sleep(500);
    const hfSelectors = [
      'button[title*="Header" i]',
      'button[aria-label*="Header" i]',
      '[role=menuitem][aria-label*="Header" i]',
      '[role=menuitem]:has-text("Header")',
      '[role=menuitem]:has-text("Header &")',
      'button:text("Header")',
    ];
    let hfLabel = null;
    for (const sel of hfSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click({ timeout: 3000 });
          await sleep(1500);
          await page.mouse.click(400, 300);
          await sleep(1000);
          const tabElsAfter = await page.$$('[role=tab]');
          const tabsAfter = [];
          for (const el of tabElsAfter) {
            const vis = await el.evaluate((e) => e.offsetParent !== null);
            if (vis) {
              const label = await el.evaluate((e) => (e.textContent || '').trim());
              tabsAfter.push(dedupeTabText(label));
            }
          }
          hfLabel = tabsAfter.find(t => /header.*footer|footer.*header/i.test(t));
          if (hfLabel) break;
        }
      } catch {}
    }
    
    // Method 2: If no Header button, try clicking in the header area of the document
    if (!hfLabel) {
      try {
        // Click in the top margin area to create/edit a header
        await page.mouse.click(200, 100);
        await sleep(1500);
        // Click again to ensure focus
        await page.mouse.click(200, 100);
        await sleep(1000);
        // Re-scan tabs
        const tabElsAfter = await page.$$('[role=tab]');
        const tabsAfter = [];
        for (const el of tabElsAfter) {
          const vis = await el.evaluate((e) => e.offsetParent !== null);
          if (vis) {
            const label = await el.evaluate((e) => (e.textContent || '').trim());
            tabsAfter.push(dedupeTabText(label));
          }
        }
        hfLabel = tabsAfter.find(t => /header.*footer|footer.*header/i.test(t));
      } catch {}
    }
    
    if (hfLabel) {
      try {
        await page.click(`[role=tab]:has-text("${hfLabel}")`, { timeout: 5000 });
      } catch {
        // Tab might already be active
      }
      await sleep(700);
      perTab[hfLabel] = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, [role=menuitem], select, input[type=checkbox][aria-label]')]
          .filter((e) => e.offsetParent !== null)
          .map((e) => ({
            label: (e.getAttribute('aria-label') || e.title || e.textContent || '').trim().slice(0, 60),
            disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
            kind: e.tagName === 'SELECT' ? 'select' : 'button',
          }))
          .filter((b) => b.label && !/^(Back|Save|Download As|Print|Protect|Info|Help|Suggest a Feature)$/i.test(b.label));
        return btns;
      });
      console.log(`  Activated contextual tab: ${hfLabel} - ${perTab[hfLabel].length} controls`);
    } else {
      console.log(`  Warning: Header & Footer tab not found after activation attempts`);
    }
  } catch (e) {
    console.log(`  Warning: Could not activate Header & Footer tab: ${e.message}`);
  }

  // Contextual tabs: activate and capture Chart Design
  try {
    // Go to Insert tab and try to insert a chart
    await page.click('[role=tab]:has-text("Insert")', { timeout: 5000 });
    await sleep(500);
    // Try different selectors for chart insertion
    const chartSelectors = [
      'button[title*="Chart" i]',
      'button[aria-label*="Chart" i]',
      '[role=menuitem][aria-label*="Chart" i]',
      '[role=menuitem]:has-text("Chart")',
      'button:text("Chart")',
    ];
    let cdLabel = null;
    for (const sel of chartSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click({ timeout: 3000 });
          await sleep(2000);
          // Click in the document to ensure chart is placed
          await page.mouse.click(300, 400);
          await sleep(1000);
          // Select the chart to activate Chart Design tab
          await page.mouse.click(300, 400);
          await sleep(1500);
          // Re-scan tabs to find Chart Design
          const tabElsAfter = await page.$$('[role=tab]');
          const tabsAfter = [];
          for (const el of tabElsAfter) {
            const vis = await el.evaluate((e) => e.offsetParent !== null);
            if (vis) {
              const label = await el.evaluate((e) => (e.textContent || '').trim());
              tabsAfter.push(dedupeTabText(label));
            }
          }
          cdLabel = tabsAfter.find(t => /chart.*design|design.*chart/i.test(t));
          if (cdLabel) break;
        }
      } catch {}
    }
    if (cdLabel) {
      try {
        await page.click(`[role=tab]:has-text("${cdLabel}")`, { timeout: 5000 });
      } catch {
        // Tab might already be active
      }
      await sleep(700);
      perTab[cdLabel] = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, [role=menuitem], select, input[type=checkbox][aria-label]')]
          .filter((e) => e.offsetParent !== null)
          .map((e) => ({
            label: (e.getAttribute('aria-label') || e.title || e.textContent || '').trim().slice(0, 60),
            disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
            kind: e.tagName === 'SELECT' ? 'select' : 'button',
          }))
          .filter((b) => b.label && !/^(Back|Save|Download As|Print|Protect|Info|Help|Suggest a Feature)$/i.test(b.label));
        return btns;
      });
      console.log(`  Activated contextual tab: ${cdLabel} - ${perTab[cdLabel].length} controls`);
    } else {
      console.log(`  Warning: Chart Design tab not found after activation attempt`);
    }
  } catch (e) {
    console.log(`  Warning: Could not activate Chart Design tab: ${e.message}`);
  }

  // Re-scan all tabs one more time to get the final list
  const finalTabEls = await page.$$('[role=tab]');
  const finalTabs = [];
  for (const el of finalTabEls) {
    const vis = await el.evaluate((e) => e.offsetParent !== null);
    if (vis) finalTabs.push(await el.evaluate((e) => (e.textContent || '').trim()));
  }
  const finalTabLabels = finalTabs.map(dedupeTabText).filter(Boolean);

  // ── status bar (capture BEFORE the file menu: its full-screen panel
  // can cover/hide the bar) — DOM order is already left-to-right ──
  const statusbar = await page.evaluate(() => {
    const bar = document.querySelector(".de-statusbar");
    if (!bar) return [];
    return [...bar.querySelectorAll("button, select, .de-statusbar-label, .de-statusbar-page-label")]
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({
        label: (e.getAttribute("title") || e.getAttribute("aria-label") || e.textContent || "")
          .trim()
          .slice(0, 40),
        kind: e.tagName === "BUTTON" || e.tagName === "SELECT" ? "button" : "text",
      }))
      .filter((i) => i.label);
  });

  // File menu (same probe as census-react.cjs)
  let fileMenu = [];
  try {
    await page.click('[data-tab="file"], [role=tab]:has-text("File")', { timeout: 5000 });
    await sleep(800);
    fileMenu = await page.evaluate(() =>
      [...document.querySelectorAll('.de-file-menu-panel button')]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({ label: (b.getAttribute('aria-label') || b.textContent || '').trim(), enabled: !(b.disabled === true) })));
  } catch {}

  const viewport = page.viewportSize(); // real viewport, not a literal — OO's golden is 1600x1000; geometry is only comparable at the same size
  const out = {
    engine: 'worldoffice-react',
    capturedAt: new Date().toISOString(),
    viewport: { width: viewport.width, height: viewport.height },
    tabs: finalTabLabels,
    ribbon: perTab,
    // Layout facts per tab: { rows, groups:[{row,x,right,n}], ribbon:[{x,y,w,h,row}] }.
    // Additive — `ribbon` above keeps its exact shape for existing consumers.
    geometry,
    fileMenu,
    statusbar,
    pageErrors: errs,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'census-react-deep.json'), JSON.stringify(out, null, 1));
  const total = Object.values(perTab).reduce((n, l) => n + l.length, 0);
  console.log(`tabs: ${finalTabLabels.length} | ribbon controls: ${total} | fileMenu: ${fileMenu.length} | statusbar: ${statusbar.length} | pageErrors: ${errs.length}`);
  for (const [t, l] of Object.entries(perTab)) console.log(`  ${t}: ${l.length}`);
  await browser.close();
})();
