#!/usr/bin/env node
// census-react-sheet.cjs — DIALOG-DEPTH census of the REACT spreadsheet
// editor (what production ships at /editors/spreadsheet/ — the Univer/React
// app the vanilla census-wo.cjs cannot see; sheet twin of census-react.cjs).
//
// WHY THIS DIMENSION. The structural census proves buttons exist; the
// interaction census classifies what a click opens. Neither measures how DEEP
// the overlay stack goes: WO's editor-common renders every modal as a native
// `<dialog open>` portaled to document.body (components/Window.tsx), so a
// dialog-on-dialog (ExportWizard → Send-as-Email window, AlertWindow over a
// window, …) stacks N `<dialog open>` elements in the DOM at once. That number
// is the dialog depth, and it is what this census measures:
//
//   click every visible control on every surface (REAL Playwright clicks —
//     a synthetic el.click() does NOT open the fluent Menu popovers)
//     → classify the overlay that appears (dialog | menu | panel | widget | none)
//     → dialogDepth  = simultaneous `<dialog open>` layers (modal stack)
//     → overlayDepth = all open overlay layers (dialog+menu+panel+widget)
//     → DRILL: while a layer is open and depth < 3, click the layer's own
//       buttons and re-measure, recording the chain that goes deepest.
//
// Measured truth against the staged sheet build (192.168.42.42:8086/sheet/):
//   - the only overlays that open from the whole UI are the two colour-picker
//     popovers (Text/Fill Color — depth 1, fluent MenuPopover) and the Monaco
//     find/replace widget;
//   - dialogDepth is 0 for every control — the sheet React UI ships no
//     reachable modal dialog at all;
//   - the File menu is DEAD: `.se-file-menu-panel` is rendered with the full
//     15-item menu (Download as…/Export Wizard…/Save as…/Print…) but stays
//     `display:none` forever, because `Viewport.tsx` reads
//     `spreadsheetStore.isFileMenuOpen` inline WITHOUT a mobx `observer`
//     (the sheet twin of the documented word-editor File-menu bug), so the
//     whole dialog-bearing surface (ExportWizard + its nested email window)
//     is unreachable and its declared depth cannot be censused. Recorded as a
//     loud FINDING in the artifact, not a gate failure: the census measures,
//     it does not require the editor to be fixed first.
//
// HONEST GATE (exit 1 only when the CENSUS is blind, not when the editor is
// imperfect — otherwise the artifact could never be committed):
//   1. the editor must mount (`.se-viewport` + a non-empty toolbar), else the
//      run measured a blank page;
//   2. at least one control must open an overlay — if NOTHING opens, the
//      click-through/classifier is broken and the zeros are a census artifact;
//   3. the artifact must be written with ≥1 censused control.
//
// Usage (point at an already-running React sheet editor):
//     CENSUS_REACT_URL=http://192.168.42.42:8086/sheet/ node census/census-react-sheet.cjs
// Output: census/census-sheet-depth.json (next to this file — the committed
// artifact; captured with playwright chromium, viewport 1600×1000).
const fs = require('fs');
const path = require('path');

// census/package.json pins playwright, but a fresh clone of this repo may not
// carry census/node_modules (gitignored); fall back to the global npm root so
// the gate runs verbatim anywhere.
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const { execSync } = require('child_process');
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  ({ chromium } = require(path.join(globalRoot, 'playwright')));
}

const URL_BASE = process.env.CENSUS_REACT_URL;
const OUT = path.join(__dirname, 'census-sheet-depth.json');
const VIEWPORT = { width: 1600, height: 1000 };
const MAX_DEPTH = 3; // overlay layers we are willing to stack
const MAX_DRILL_ITEMS = 6; // layer buttons probed per level
const MAX_TABS = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── page-side probes (REAL functions: a string passed to page.evaluate is
//    parsed as an expression, not a function — it clicks nothing) ──────────
const PROBE_LAYERS = () => {
  const vis = (el) =>
    !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const label = (el) =>
    (el.getAttribute('aria-label') || el.getAttribute('data-hint') || el.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 48);
  const size = (el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };
  const actionable = (root) =>
    [...root.querySelectorAll('button,[role="menuitem"]')]
      .filter(vis)
      .map((b) => label(b))
      .filter(Boolean);
  const layers = [];

  // 1. modal dialogs — editor-common Window.tsx portals `<dialog open>` to body
  for (const d of document.querySelectorAll('dialog[open]')) {
    layers.push({ kind: 'dialog', label: d.getAttribute('aria-label') || label(d) || 'dialog', ...size(d), buttons: actionable(d) });
  }
  // 2. menus / popovers — outermost only (fluent nests [role=menu] inside
  //    .fui-MenuPopover; counting both would double-report one popover)
  for (const el of document.querySelectorAll('.fui-MenuPopover, .wo-menu, [class*="dropdown-menu"], [role="menu"]')) {
    if (!vis(el) || el.closest('dialog')) continue;
    if (el.parentElement && el.parentElement.closest('.fui-MenuPopover, .wo-menu, [role="menu"]')) continue;
    layers.push({ kind: 'menu', label: label(el) || 'menu', ...size(el), buttons: actionable(el) });
  }
  // 3. full-screen / side panels
  for (const [sel, name] of [
    ['.se-file-menu-panel', 'file-menu'],
    ['.se-about-menu-panel', 'about'],
  ]) {
    const el = document.querySelector(sel);
    if (el && vis(el)) {
      layers.push({
        kind: 'panel',
        label: name,
        ...size(el),
        buttons: [...el.querySelectorAll('button')].filter(vis).map((b) => label(b)).filter(Boolean),
      });
    }
  }
  // 4. inline widgets (Monaco find/replace carries role=dialog — NOT a modal)
  for (const el of document.querySelectorAll('.find-widget.visible')) {
    layers.push({ kind: 'widget', label: 'find-widget', ...size(el), buttons: actionable(el) });
  }
  return layers;
};

// enumerate a surface's visible interactive controls (buttons + selects)
const PROBE_CONTROLS = (sel) => {
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const scope = document.querySelector(sel);
  if (!scope) return [];
  return [...scope.querySelectorAll('button, select')]
    .filter(vis)
    .map((el, i) => {
      let label = (
        el.getAttribute('aria-label') ||
        el.getAttribute('data-hint') ||
        el.getAttribute('data-action') ||
        el.getAttribute('title') ||
        el.textContent ||
        ''
      )
        .trim()
        .replace(/\s+/g, ' ');
      // fui renders captions twice ("FormulaFormula") — halve a perfect double
      if (label.length && label.length % 2 === 0 && label.slice(0, label.length / 2) === label.slice(label.length / 2)) {
        label = label.slice(0, label.length / 2);
      }
      return { idx: i, tag: el.tagName.toLowerCase(), id: el.id || null, label: label.slice(0, 40) || null };
    })
    .filter((c) => c.label);
};

const CONTROL_STATE = ([sel, idx]) => {
  const scope = document.querySelector(sel);
  if (!scope) return null;
  const els = [...scope.querySelectorAll('button, select')].filter(
    (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
  );
  const el = els[idx];
  if (!el) return null;
  return {
    expanded: el.getAttribute('aria-expanded'),
    pressed: el.getAttribute('aria-pressed'),
    active: el.classList.contains('active'),
  };
};

const FILE_MENU = () => {
  const p = document.querySelector('.se-file-menu-panel');
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  // items IN THE DOM even while the panel is closed — an unopenable panel
  // still proves which dialog-bearing entries the build ships but never shows
  const items = p
    ? [...p.querySelectorAll('[role="menuitem"]')]
        .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim())
        .filter(Boolean)
    : [];
  return {
    present: !!p,
    display: p ? getComputedStyle(p).display : 'absent',
    visible: vis(p),
    items,
  };
};

const TAB_LIST = () =>
  [...document.querySelectorAll('.se-viewport-toolbar button')]
    .filter((b) => b.classList.contains('se-toolbar-tab') || b.classList.contains('fui-Tab'))
    .map((b) => {
      let t = (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ');
      // fui-Tab renders its caption twice ("FormulaFormula") — halve a perfect double
      if (t.length && t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) {
        t = t.slice(0, t.length / 2);
      }
      return { cls: b.classList.contains('se-toolbar-tab') ? 'se-toolbar-tab' : 'fui-Tab', label: t };
    });

// tab buttons are enumerated by the toolbar scan but censused as `fileMenu`
const RIBBON_TAB_LABELS = ['File', 'Home', 'Formula', 'Insert', 'Layout', 'DataTable', 'Cloud'];
const isRibbonTab = (c) => c.tag === 'button' && RIBBON_TAB_LABELS.includes(c.label);

(async () => {
  if (!URL_BASE) {
    console.error('FAIL: CENSUS_REACT_URL is required (e.g. http://host:8086/sheet/)');
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: VIEWPORT });
  const pageerrors = [];
  page.on('pageerror', (e) => pageerrors.push(String(e.message).slice(0, 160)));

  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const mounted = await page
    .waitForSelector('.se-viewport', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  await page
    .waitForFunction(() => document.querySelectorAll('.se-viewport-toolbar button').length > 3, {
      timeout: 25000,
    })
    .catch(() => {});
  await sleep(1200); // fluent ribbon + univer mount settle

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const layers = () => ev(PROBE_LAYERS);
  const dialogDepthOf = (ls) => ls.filter((l) => l.kind === 'dialog').length;
  // nth(idx) must match the enumeration (which filters invisible controls),
  // else a hidden button shifts the index and the census clicks the wrong row
  const controlLocator = (sel, idx) =>
    page.locator(`${sel} button:visible, ${sel} select:visible`).nth(idx);

  // real click (fluent popovers do not open from a synthetic el.click());
  // fall back to the DOM click only if the locator is not actionable
  const clickControl = async (sel, idx) => {
    try {
      await controlLocator(sel, idx).click({ timeout: 4000 });
      return 'real';
    } catch {
      return (await ev(([s, i]) => {
        const scope = document.querySelector(s);
        if (!scope) return false;
        const els = [...scope.querySelectorAll('button, select')].filter(
          (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        );
        if (!els[i]) return false;
        els[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        els[i].click();
        return 'dom';
      }, [sel, idx])) || 'missing';
    }
  };

  // ── File menu trigger (the sheet twin of the census-react.cjs assertion) ─
  const fileMenuBefore = await ev(FILE_MENU);
  let fileMenuAfter = { ...fileMenuBefore, items: fileMenuBefore.items };
  try {
    await page.click('button.se-toolbar-tab', { timeout: 5000 });
    await sleep(700);
    fileMenuAfter = await ev(FILE_MENU);
    await page.click('button.se-toolbar-tab', { timeout: 5000 }).catch(() => {});
    await sleep(300);
  } catch (e) {
    fileMenuAfter.error = String(e.message).slice(0, 80);
  }

  // ── click-through with depth drill ─────────────────────────────────────
  const rows = [];
  const settle = async () => {
    // outside mousedown dismisses fluent popovers; Escape clears the rest
    await page.mouse.click(760, 520).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(150);
  };

  const layerLocator = (kind) =>
    kind === 'dialog'
      ? page.locator('dialog[open]').last().locator('button,[role="menuitem"]')
      : page.locator('.fui-MenuPopover:visible, .wo-menu:visible, [role="menu"]:visible')
          .last()
          .locator('button,[role="menuitem"]');

  // click the buttons of the topmost `kind` layer; keep the deepest stack found
  const drill = async (row, level) => {
    for (let i = 0; i < MAX_DRILL_ITEMS && level < MAX_DEPTH; i++) {
      let label = null;
      try {
        const loc = layerLocator(row.kind).nth(i);
        label = (await loc.getAttribute('title')) || (await loc.textContent());
        label = (label || '').trim().replace(/\s+/g, ' ').slice(0, 32) || `button#${i}`;
        await loc.click({ timeout: 2500 });
      } catch {
        break; // layer exhausted / not clickable
      }
      await sleep(450);
      const ls = await layers();
      if (ls.length > row.overlayDepth) {
        row.chain.push(label);
        row.overlayDepth = ls.length;
        row.dialogDepth = Math.max(row.dialogDepth, dialogDepthOf(ls));
        row.drilledTo = ls.map((l) => `${l.kind}:${l.label}`);
        await drill(row, level + 1);
        break; // one successful deepening per level is enough for the census
      }
    }
  };

  const censusControl = async (surface, sel, c) => {
    await settle();
    const before = await layers();
    const stateBefore = await ev(CONTROL_STATE, [sel, c.idx]);
    const clicked = await clickControl(sel, c.idx);
    await sleep(500);
    const after = await layers();
    const stateAfter = await ev(CONTROL_STATE, [sel, c.idx]);
    const fresh = after.filter((l) => !before.some((b) => b.kind === l.kind && b.label === l.label));
    const opened = fresh.length > 0 && after.length >= before.length;
    const row = {
      surface,
      control: c.label,
      tag: c.tag,
      clicked,
      opened,
      kind: opened ? fresh[0].kind : 'none',
      dialogDepth: opened ? dialogDepthOf(after) : 0,
      overlayDepth: opened ? after.length : 0,
      toggled: !opened && JSON.stringify(stateAfter) !== JSON.stringify(stateBefore),
      chain: [],
      layer: opened
        ? {
            kind: fresh[0].kind,
            label: fresh[0].label,
            w: fresh[0].w,
            h: fresh[0].h,
            buttons: fresh[0].buttons.length,
          }
        : null,
      note: clicked !== 'real' ? `click:${clicked}` : '',
    };
    if (opened) await drill(row, 1);
    await settle();
    return row;
  };

  // 1. ribbon — one pass per tab, enumerating that tab's visible controls
  const tabs = await ev(TAB_LIST);
  for (const t of tabs.filter((x) => x.cls === 'fui-Tab').slice(0, MAX_TABS)) {
    await ev((label) => {
      const b = [...document.querySelectorAll('.se-viewport-toolbar .fui-Tab')].find((x) => {
        const s = (x.textContent || '').trim();
        return s === label || s === label + label;
      });
      if (b) b.click();
    }, t.label);
    await sleep(450);
    const controls = (await ev(PROBE_CONTROLS, '.se-viewport-toolbar')).filter((c) => !isRibbonTab(c));
    for (const c of controls) {
      rows.push(await censusControl(`toolbar:${t.label}`, '.se-viewport-toolbar', c));
    }
  }

  // 2. left menu, sheet tab bar, status bar
  for (const [surface, sel] of [
    ['left-menu', '.se-left-menu'],
    ['sheet-tab-bar', '.se-statusbar-sheet-nav'],
    ['statusbar', '.se-statusbar'],
  ]) {
    for (const c of await ev(PROBE_CONTROLS, sel)) {
      rows.push(await censusControl(surface, sel, c));
    }
  }

  // ── summary + artifact ─────────────────────────────────────────────────
  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  const domDialogs = await page.evaluate(() => document.querySelectorAll('dialog').length);
  const maxOverlay = rows.reduce((m, r) => Math.max(m, r.overlayDepth), 0);
  const summary = {
    surfaces: [...new Set(rows.map((r) => r.surface))],
    controls: rows.length,
    opened: rows.filter((r) => r.opened).length,
    toggledOnly: rows.filter((r) => !r.opened && r.toggled).length,
    byKind,
    dialogs: rows.filter((r) => r.kind === 'dialog').length,
    domDialogElements: domDialogs,
    maxDialogDepth: rows.reduce((m, r) => Math.max(m, r.dialogDepth), 0),
    maxOverlayDepth: maxOverlay,
    deepest: rows
      .filter((r) => r.overlayDepth === maxOverlay && maxOverlay > 0)
      .map((r) => `${r.surface}/${r.control} -> ${[r.kind, ...r.chain].join(' > ')}`),
  };

  const findings = [];
  if (fileMenuBefore.present && !fileMenuAfter.visible) {
    findings.push(
      `file-menu-dead: .se-file-menu-panel ships ${fileMenuBefore.items.length} menu items in the DOM ` +
        `(${fileMenuBefore.items.slice(0, 5).join(', ')}…) but a real File-tab click leaves it ` +
        `display:${fileMenuAfter.display} — Viewport reads spreadsheetStore.isFileMenuOpen without a mobx ` +
        `observer, so the only dialog-bearing surface (ExportWizard + its nested window) is unreachable ` +
        `and its dialog depth cannot be censused`,
    );
  }
  if (summary.dialogs === 0) {
    findings.push(
      `no-modal-dialogs: dialogDepth is 0 across all ${summary.controls} censused controls — ` +
        `the sheet React UI exposes no reachable modal <dialog>; deepest overlay is a depth-` +
        `${summary.maxOverlayDepth} ${summary.byKind.menu ? 'popover menu' : 'layer'}`,
    );
  }
  const toggledNoOverlay = rows.filter((r) => r.toggled);
  if (toggledNoOverlay.length) {
    findings.push(
      `toggle-without-overlay: ${toggledNoOverlay.length} controls flip their own active/pressed ` +
        `state but open nothing (${toggledNoOverlay.map((r) => `${r.surface}/${r.control}`).join(', ')}) — ` +
        `the left-menu rail has no panels in this build (.se-about-menu-panel is bound in the same ` +
        `non-observer Viewport as the file menu)`,
    );
  }
  const noOverlay = rows.filter((r) => !r.opened && !r.toggled);
  if (noOverlay.length) {
    // no overlay + no exposed toggle state == direct-action from the DOM's point
    // of view; whether the command really mutates the sheet is fx-wo.cjs's job
    findings.push(
      `${noOverlay.length}/${rows.length} controls open no overlay and expose no toggle state ` +
        `(direct-action or no-op — not decidable from the DOM): ` +
        noOverlay.map((r) => `${r.surface}/${r.control}`).slice(0, 12).join(', ') +
        (noOverlay.length > 12 ? ' …' : ''),
    );
  }

  const artifact = {
    engine: 'worldoffice-react-sheet',
    capturedAt: new Date().toISOString(),
    url: URL_BASE,
    viewport: VIEWPORT,
    pageErrors: pageerrors,
    mounted,
    toolbarTabs: tabs.map((t) => t.label),
    fileMenu: {
      tab: tabs.some((t) => t.cls === 'se-toolbar-tab'),
      panelPresent: fileMenuBefore.present,
      panelDisplay: { before: fileMenuBefore.display, after: fileMenuAfter.display },
      panelVisible: fileMenuAfter.visible,
      opened: fileMenuAfter.visible,
      items: fileMenuBefore.items,
    },
    rows,
    summary,
    findings,
  };
  fs.writeFileSync(OUT, JSON.stringify(artifact, null, 1) + '\n');

  // ── report ─────────────────────────────────────────────────────────────
  console.log(
    `census-react-sheet: mounted=${mounted} tabs=[${artifact.toolbarTabs.join(',')}] ` +
      `controls=${summary.controls} opened=${summary.opened} toggledOnly=${summary.toggledOnly} ` +
      `kinds=${JSON.stringify(byKind)} maxDialogDepth=${summary.maxDialogDepth} ` +
      `maxOverlayDepth=${summary.maxOverlayDepth}`,
  );
  for (const r of rows.filter((x) => x.opened)) {
    console.log(
      `  + ${r.surface}/${r.control}: ${r.kind} depth=${r.overlayDepth} dialog=${r.dialogDepth}` +
        (r.chain.length ? ` chain=[${r.chain.join(' > ')}]` : ''),
    );
  }
  for (const f of findings) console.log(`FINDING ${f}`);
  await browser.close();

  let fail = 0;
  if (!mounted || summary.controls < 1) {
    console.error('FAIL: sheet editor never mounted (no .se-viewport / no controls) — census is blind');
    fail = 1;
  } else if (summary.opened < 1) {
    console.error('FAIL: no control opened any overlay — the click-through/classifier measured nothing');
    fail = 1;
  } else if (!fs.existsSync(OUT)) {
    console.error('FAIL: artifact not written');
    fail = 1;
  }
  console.log(`artifact: ${OUT}`);
  process.exit(fail);
})().catch((e) => {
  console.error('FAIL', e && e.message ? e.message : e);
  process.exit(1);
});
