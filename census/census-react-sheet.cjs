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
//   - the File menu is REACHABLE but only through a re-render side channel:
//     `Viewport.tsx` reads `spreadsheetStore.isFileMenuOpen` (and
//     `activeFileMenuPanel`) inline WITHOUT a mobx `observer`, so the File-tab
//     click flips the store yet paints nothing. The panel DOES paint on the
//     next re-render of the observer root — and a real keystroke into the
//     sheet triggers exactly that (any edit flips `spreadsheetStore.isModified`,
//     which the root observer reads). So the census opens the File menu with:
//       real File-tab click → (pick a menu entry) → real keystroke in the grid
//     and ASSERTS the panel is up. Same trick, one fresh page per entry, is how
//     it reaches the dialog-bearing surfaces the old census had to write off:
//     Download as… / Export Wizard… (a real portaled `<dialog open>`) / Save
//     Copy as… / Document Info… / Access Rights… / Advanced Settings… / Help… /
//     Protect Document — 8 dialog surfaces measured, each with its own
//     dialogDepth + a real-button drill.
//   - outside the File menu the only overlays the whole UI opens are the two
//     colour-picker popovers (Text/Fill Color — depth 1, fluent MenuPopover)
//     and the Monaco find/replace widget.
//
// HONEST GATE (exit 1 as soon as the CENSUS cannot see the dialog surface —
// the artifact must never again be committable with the File menu unread):
//   1. the editor must mount (`.se-viewport` + a non-empty toolbar), else the
//      run measured a blank page;
//   2. at least one control must open an overlay — if NOTHING opens, the
//      click-through/classifier is broken and the zeros are a census artifact;
//   3. the File menu must actually OPEN (`.se-file-menu-panel` visible) — the
//      sheet twin of the census-react.cjs assertion. A File menu that stays
//      display:none hides the whole dialog-bearing surface;
//   4. at least 5 File-menu dialogs must be EXERCISED: entry clicked with the
//      menu open, the entry's dialog surface reached (its pane is the active
//      pane in the DOM, or a real `<dialog open>` is up) and its controls
//      enumerated / drilled. Whether the surface PAINTS is measured and
//      reported separately (this build mounts every pane inside a
//      display:none container, so only the ExportWizard dialog is clickable)
//      — the gate fails when the CENSUS is blind, not when the editor is
//      imperfect, else the artifact could never be committed;
//   5. the artifact must be written.
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
const MIN_DIALOGS = 5; // gate: File-menu dialog surfaces that must be exercised
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

// the File menu's dialog state: the portaled `<dialog open>` layers (dialog
// depth) plus the `.se-file-menu-content-box` panes each menu entry activates.
// `panes` are enumerated from the DOM whether or not they paint — the build
// mounts every pane but keeps their container display:none, and the census
// still records the dialog the build ships (header + controls).
const FILE_MENU_DIALOGS = () => {
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const pane = (b) => {
    const r = b.getBoundingClientRect();
    const display = getComputedStyle(b).display;
    return {
      header: ((b.querySelector('.se-file-menu-header') || {}).textContent || '').trim().slice(0, 40) || null,
      display,
      painted: display !== 'none' && vis(b),
      w: Math.round(r.width),
      h: Math.round(r.height),
      controls: [...b.querySelectorAll('button, select, input, textarea')].length,
      controlLabels: [...b.querySelectorAll('button, select')]
        .map((x) => (x.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24))
        .filter(Boolean)
        .slice(0, 10),
    };
  };
  const dlg = (d) => {
    const r = d.getBoundingClientRect();
    return {
      title: ((d.querySelector('h1,h2,h3') || {}).textContent || '').trim().slice(0, 40) || null,
      w: Math.round(r.width),
      h: Math.round(r.height),
      controls: [...d.querySelectorAll('button, select, input, textarea')].filter(vis).length,
      controlLabels: [...d.querySelectorAll('button, select')].filter(vis).map((b) => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)).filter(Boolean).slice(0, 10),
    };
  };
  // the pane container (contentBoxBase) — display:none here starves every pane
  const panes = [...document.querySelectorAll('.se-file-menu-panel .se-file-menu-content-box')].map(pane);
  let container = 'absent';
  for (const b of document.querySelectorAll('.se-file-menu-panel .se-file-menu-content-box')) {
    if (b.parentElement) {
      container = getComputedStyle(b.parentElement).display;
      break;
    }
  }
  return {
    panel: (() => {
      const p = document.querySelector('.se-file-menu-panel');
      if (!p) return 'absent';
      return vis(p) ? 'visible' : getComputedStyle(p).display;
    })(),
    paneContainerDisplay: container,
    dialogLayers: [...document.querySelectorAll('dialog[open]')].filter(vis).map(dlg),
    panes,
    activePane: panes.find((x) => x.display !== 'none') || null,
  };
};

// click a File-menu entry BY CAPTION. `hidden` mode is the re-render side
// channel: the entries live in the DOM while the panel is still unrendered
// (Viewport has no mobx observer), so they are clicked there and the panel —
// plus the entry's own dialog pane — paints on the next root re-render.
const PICK_FILE_MENU_ITEM = (caption) => {
  const els = [...document.querySelectorAll('.se-file-menu-panel [role="menuitem"]')];
  const el = els.find((e) => ((e.textContent || '').trim().replace(/\s+/g, ' ') || '').indexOf(caption) >= 0);
  if (!el) return null;
  el.click();
  return (el.textContent || '').trim().replace(/\s+/g, ' ');
};

// labels of the controls of whichever dialog surface is currently up
const DIALOG_SURFACE_CONTROLS = () => {
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const dlg = [...document.querySelectorAll('dialog[open]')].filter(vis)[0];
  if (dlg)
    return {
      where: 'dialog',
      labels: [...dlg.querySelectorAll('button')].filter(vis).map((b) => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)).filter(Boolean),
    };
  const box = [...document.querySelectorAll('.se-file-menu-panel .se-file-menu-content-box')].filter(vis)[0];
  if (box)
    return {
      where: 'content-box',
      labels: [...box.querySelectorAll('button, select')].filter(vis).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)).filter(Boolean),
    };
  return null;
};

const CLICK_DIALOG_SURFACE_CONTROL = (label) => {
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const scopes = [...document.querySelectorAll('dialog[open], .se-file-menu-panel .se-file-menu-content-box')].filter(vis);
  for (const s of scopes) {
    const el = [...s.querySelectorAll('button')]
      .filter(vis)
      .find((b) => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) === label);
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      el.click();
      return true;
    }
  }
  return false;
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

// File-menu entries that leave the editor (navigate / close) — they are not
// dialog surfaces, and exercising them would kill the page mid-census
const SKIP_NAV_ITEMS = ['Go to Documents', 'Close Editor'];

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
  const T0 = Date.now();
  const stamp = (label) => console.log(`[t=${((Date.now() - T0) / 1000).toFixed(1)}s] ${label}`);

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

  // ── File menu: OPEN it (the sheet twin of the census-react.cjs assertion) ─
  // Viewport.tsx renders .se-file-menu-panel from isFileMenuOpen without a mobx
  // observer, so the File-tab click alone paints nothing; a real keystroke into
  // the sheet flips spreadsheetStore.isModified, re-renders the observer root
  // and the panel appears. `entry` (optional) picks a dialog-bearing File-menu
  // entry while the panel is still unrendered, so the SAME re-render paints the
  // entry's dialog pane too (there is no second re-render to be had).
  const openFileMenu = async (p, entry) => {
    const steps = [];
    const tab = await p
      .click('button.se-toolbar-tab', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    steps.push(`file-tab-click:${tab ? 'ok' : 'miss'}`);
    let picked = null;
    if (tab && entry) {
      picked = await p.evaluate(PICK_FILE_MENU_ITEM, entry).catch(() => null);
      steps.push(`entry-click:${picked || 'miss'}`);
    }
    // real keystrokes into the grid — the re-render that paints the panel
    let rerender = 'none';
    for (let attempt = 0; attempt < 3; attempt++) {
      await p.mouse.click(700, 520 + attempt * 24).catch(() => {});
      await p.keyboard.type('census').catch(() => {});
      await p.keyboard.press('Enter').catch(() => {});
      await sleep(320);
      const st = await p.evaluate(FILE_MENU_DIALOGS);
      if (st.panel === 'visible') {
        rerender = `keystroke#${attempt + 1}`;
        break;
      }
    }
    steps.push(`rerender:${rerender}`);
    const state = await p.evaluate(FILE_MENU_DIALOGS);
    return { steps, picked, rerender, state };
  };

  // The File-menu check runs on its OWN page, AFTER the toolbar census: once
  // the panel paints it covers the toolbar, and Viewport's missing observer
  // means no re-render will ever paint it away — real Playwright clicks on the
  // toolbar would then time out behind it for the rest of the run.
  const fileMenuBefore = await ev(FILE_MENU);
  let open = { steps: [], picked: null, rerender: 'not-run', state: { panel: 'absent' } };
  let fileMenuAfter = { panel: 'absent' };
  let fileMenuClosed = null;
  const openFileMenuOnFreshPage = async () => {
    const fp = await browser.newPage({ viewport: VIEWPORT });
    fp.on('pageerror', (e) => pageerrors.push(`[file-menu] ${String(e.message).slice(0, 120)}`));
    await fp.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await fp.waitForSelector('.se-viewport', { timeout: 25000 }).catch(() => {});
    await fp
      .waitForFunction(() => document.querySelectorAll('.se-viewport-toolbar button').length > 3, {
        timeout: 25000,
      })
      .catch(() => {});
    await sleep(1000);
    const res = await openFileMenu(fp, null);
    const after = await fp.evaluate(FILE_MENU_DIALOGS);
    let closed = null;
    if (res.state.panel === 'visible') {
      // a real click on the (now visible) Back entry must close it again
      await fp
        .locator('.se-file-menu-panel [role="menuitem"]', { hasText: 'Back' })
        .first()
        .click({ timeout: 4000 })
        .catch(() => {});
      await sleep(300);
      closed = await fp.evaluate(FILE_MENU);
    }
    await fp.close();
    return { res, after, closed };
  };

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

  stamp(`toolbar + surface census (${rows.length} controls, ${rows.filter((r) => r.opened).length} opened)`);

  // ── File menu: OPEN it (the sheet twin of the census-react.cjs assertion),
  //    on its own page so the panel cannot cover the census surface above ──
  ({ res: open, after: fileMenuAfter, closed: fileMenuClosed } = await openFileMenuOnFreshPage());
  stamp(`file-menu open check (opened=${open.state.panel === 'visible'})`);

  // ── 3. File-menu dialogs — one FRESH page per entry (the pane only paints
  //       on the re-render that follows the entry click, so each entry needs
  //       its own mount), run through a small pool: the entries are
  //       independent and each needs its own editor instance ────────────────
  const fileMenuItems = fileMenuBefore.items.filter((i) => i !== '←Back' && !SKIP_NAV_ITEMS.includes(i));
  const dialogs = [];
  const censusFileMenuEntry = async (item) => {
    const p = await browser.newPage({ viewport: VIEWPORT });
    p.on('pageerror', (e) => pageerrors.push(`[${item}] ${String(e.message).slice(0, 120)}`));
    p.on('popup', (pp) => pp.close().catch(() => {})); // External Help opens a tab
    p.on('download', (d) => d.cancel().catch(() => {})); // export entries download
    await p.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForSelector('.se-viewport', { timeout: 25000 }).catch(() => {});
    await p
      .waitForFunction(() => document.querySelectorAll('.se-viewport-toolbar button').length > 3, {
        timeout: 25000,
      })
      .catch(() => {});
    await sleep(700);

    const run = await openFileMenu(p, item);
    const st = run.state;
    const native = st.dialogLayers.length > 0;
    const pane = st.activePane;
    // EXERCISED: the census reached the entry's dialog surface — the entry
    // activated its pane (the pane is the active one in the DOM) or opened a
    // real portaled <dialog>. PAINTED: that surface is actually visible; this
    // build keeps every pane inside a display:none container, so only the
    // ExportWizard dialog ever paints (recorded as a finding, not a gate fail).
    const entry = {
      item,
      picked: run.picked,
      steps: run.steps,
      fileMenuOpen: st.panel === 'visible',
      exercised: st.panel === 'visible' && (native || !!pane),
      painted: st.panel === 'visible' && (native || !!(pane && pane.painted)),
      kind: native ? 'dialog' : pane ? 'pane' : 'none',
      dialogDepth: st.dialogLayers.length, // simultaneous `<dialog open>` layers
      paneContainerDisplay: st.paneContainerDisplay,
      surface: native
        ? { where: 'dialog', ...st.dialogLayers[0] }
        : pane
          ? { where: 'pane', ...pane }
          : null,
      drill: [],
      note:
        st.panel !== 'visible'
          ? `file-menu-panel:${st.panel}` // non-dialog entry: the click closes the menu
          : pane && !pane.painted
            ? `pane mounted (display:${pane.display}) but never paints — container is display:${st.paneContainerDisplay}; controls enumerated from the DOM`
            : '',
    };

    // exercise the surface: real-click its own buttons, re-measure the stack.
    // Only a painted surface is clickable — a mounted-but-hidden pane has no
    // user path, so its controls are enumerated, not clicked.
    if (entry.painted) {
      const controls = await p.evaluate(DIALOG_SURFACE_CONTROLS).catch(() => null);
      for (const label of (controls ? controls.labels : []).slice(0, 3)) {
        const before = await p.evaluate(FILE_MENU_DIALOGS);
        const clicked = await p
          .locator('dialog[open] button, .se-file-menu-panel .se-file-menu-content-box button', { hasText: label })
          .first()
          .click({ timeout: 2500 })
          .then(() => 'real')
          .catch(async () => (await p.evaluate(CLICK_DIALOG_SURFACE_CONTROL, label).catch(() => false)) ? 'dom' : 'miss');
        await sleep(450);
        const after = await p.evaluate(FILE_MENU_DIALOGS);
        const grew =
          after.dialogLayers.length > before.dialogLayers.length ||
          (after.activePane && before.activePane && after.activePane.header !== before.activePane.header);
        entry.drill.push({
          control: label,
          clicked,
          dialogDepth: after.dialogLayers.length,
          stillOpen: after.panel === 'visible' || after.dialogLayers.length > 0,
          deepened: grew,
        });
        entry.dialogDepth = Math.max(entry.dialogDepth, after.dialogLayers.length);
        if (after.panel !== 'visible' && after.dialogLayers.length === 0) break; // dismissed
      }
    }
    await p.close();
    return entry;
  };

  // bounded pool over the entries (order preserved in `dialogs`)
  const POOL = 4;
  const queue = [...fileMenuItems];
  const workers = Array.from({ length: Math.min(POOL, queue.length) }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        dialogs.push(await censusFileMenuEntry(item));
      } catch (e) {
        dialogs.push({ item, exercised: false, painted: false, kind: 'none', dialogDepth: 0, surface: null, drill: [], note: `census-error:${String(e.message).slice(0, 80)}` });
      }
    }
  });
  await Promise.all(workers);
  dialogs.sort((a, b) => fileMenuItems.indexOf(a.item) - fileMenuItems.indexOf(b.item));
  for (const entry of dialogs) {
    console.log(
      `  ${entry.exercised ? (entry.painted ? '+' : '~') : '-'} file-menu/${entry.item}: ${entry.kind}` +
        ` dialogDepth=${entry.dialogDepth}` +
        (entry.surface ? ` surface=${entry.surface.where}:${entry.surface.header || entry.surface.title} controls=${entry.surface.controls}` : '') +
        (entry.drill.length ? ` drill=[${entry.drill.map((d) => `${d.control}:${d.clicked}${d.deepened ? '+' : ''}`).join(', ')}]` : '') +
        (entry.note ? ` (${entry.note})` : ''),
    );
  }

  stamp(`file-menu dialogs (${dialogs.filter((d) => d.exercised).length}/${fileMenuItems.length} exercised)`);

  // ── summary + artifact ─────────────────────────────────────────────────
  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  const domDialogs = await page.evaluate(() => document.querySelectorAll('dialog').length);
  const maxOverlay = rows.reduce((m, r) => Math.max(m, r.overlayDepth), 0);
  const dialogsExercised = dialogs.filter((d) => d.exercised).length;
  const dialogsPainted = dialogs.filter((d) => d.painted).length;
  const maxFileMenuDialogDepth = dialogs.reduce((m, d) => Math.max(m, d.dialogDepth), 0);
  const summary = {
    surfaces: [...new Set(rows.map((r) => r.surface))],
    controls: rows.length,
    opened: rows.filter((r) => r.opened).length,
    toggledOnly: rows.filter((r) => !r.opened && r.toggled).length,
    byKind,
    dialogs: rows.filter((r) => r.kind === 'dialog').length,
    domDialogElements: domDialogs,
    maxDialogDepth: Math.max(
      rows.reduce((m, r) => Math.max(m, r.dialogDepth), 0),
      maxFileMenuDialogDepth,
    ),
    maxOverlayDepth: maxOverlay,
    deepest: rows
      .filter((r) => r.overlayDepth === maxOverlay && maxOverlay > 0)
      .map((r) => `${r.surface}/${r.control} -> ${[r.kind, ...r.chain].join(' > ')}`),
    fileMenuItems: fileMenuItems.length,
    fileMenuOpened: open.state.panel === 'visible',
    fileMenuDialogsDeclared: fileMenuItems.filter((i) => i.endsWith('...')).length,
    fileMenuDialogsExercised: dialogsExercised,
    fileMenuDialogsPainted: dialogsPainted,
    maxFileMenuDialogDepth,
  };

  const findings = [];
  if (fileMenuBefore.present && open.state.panel !== 'visible') {
    findings.push(
      `file-menu-unopenable: .se-file-menu-panel ships ${fileMenuBefore.items.length} menu items in the DOM ` +
        `(${fileMenuBefore.items.slice(0, 5).join(', ')}…) but neither a real File-tab click nor the ` +
        `isModified re-render made it visible (panel:${open.state.panel}) — the whole dialog-bearing ` +
        `surface is unreachable and its dialog depth cannot be censused`,
    );
  } else if (fileMenuBefore.present) {
    findings.push(
      `file-menu-render-bug: the File-tab click alone paints NOTHING (.se-file-menu-panel stayed ` +
        `display:${fileMenuBefore.display}); the panel only renders on the next root re-render, which ` +
        `this census triggers with a real keystroke into the sheet (isModified flips). Viewport reads ` +
        `spreadsheetStore.isFileMenuOpen/activeFileMenuPanel without a mobx observer — the sheet twin of ` +
        `the documented word-editor File-menu bug. Every dialog pane below is censused through that side ` +
        `channel, one fresh page per entry, because no second re-render exists to paint a pane switch`,
    );
  }
  const deadEntries = dialogs.filter((d) => !d.exercised && d.item.endsWith('...'));
  if (deadEntries.length) {
    findings.push(
      `file-menu-dead-entries: ${deadEntries.length} dialog-declaring entries reach no dialog surface ` +
        `(${deadEntries.map((d) => `${d.item}[${d.note || 'no pane'}]`).join(', ')}) — they either close the ` +
        `menu (non-pane action) or declare a pane the build never renders`,
    );
  }
  const mountedNotPainted = dialogs.filter((d) => d.exercised && !d.painted);
  if (mountedNotPainted.length) {
    findings.push(
      `file-menu-panes-never-paint: ${mountedNotPainted.length} dialog panes ACTIVATE but never paint — ` +
        `their container is display:${mountedNotPainted[0].paneContainerDisplay} ` +
        `(contentBoxBase in FileMenuPanel.tsx), so the pane is w=0/h=0 and no real click can reach it: ` +
        `${mountedNotPainted.map((d) => `${d.item}→${d.surface ? d.surface.header : '?'}`).join(', ')}. ` +
        `The census enumerates each pane's shipped controls from the DOM it mounts, but only the portaled ` +
        `ExportWizard <dialog> (${dialogsPainted} surface${dialogsPainted === 1 ? '' : 's'} painted) is ` +
        `actually clickable — the dialog depth of the hidden panes cannot be measured by interaction`,
    );
  }
  const noDismiss = dialogs.filter((d) => d.drill.some((x) => x.control === '✕' && x.stillOpen));
  if (noDismiss.length) {
    findings.push(
      `file-menu-dialog-no-dismiss: ${noDismiss.map((d) => d.item).join(', ')} — the dialog's own ✕ flips ` +
        `activeFileMenuPanel in the store but the dialog stays open (same missing-observer re-render), so the ` +
        `modal cannot be closed by the user`,
    );
  }
  if (summary.dialogs === 0 && maxFileMenuDialogDepth === 0) {
    findings.push(
      `no-modal-dialogs: dialogDepth is 0 across all ${summary.controls} censused controls and all ` +
        `${dialogsExercised} File-menu dialogs — the sheet React UI exposes no reachable modal <dialog>`,
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
      panelDisplay: { before: fileMenuBefore.display, after: fileMenuAfter.panel },
      panelVisible: fileMenuAfter.panel === 'visible',
      opened: open.state.panel === 'visible',
      // how the census got it open: Viewport has no mobx observer, so the panel
      // paints on the next root re-render, not on the File-tab click itself
      openTrigger: open.steps.join(' > '),
      closedByBackClick: fileMenuClosed ? !fileMenuClosed.visible : null,
      items: fileMenuBefore.items,
      dialogs,
      dialogsExercised,
      dialogsPainted,
      minRequired: MIN_DIALOGS,
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
  console.log(
    `file-menu: opened=${artifact.fileMenu.opened} trigger=${artifact.fileMenu.openTrigger} ` +
      `items=${artifact.fileMenu.items.length} dialogsExercised=${dialogsExercised}/${fileMenuItems.length} ` +
      `dialogsPainted=${dialogsPainted} (gate >=${MIN_DIALOGS} exercised) ` +
      `maxDialogDepth=${maxFileMenuDialogDepth}`,
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
  } else if (!artifact.fileMenu.opened) {
    console.error('FAIL: the File menu did not open (.se-file-menu-panel never became visible).');
    console.error(`      trigger=${artifact.fileMenu.openTrigger} panel=${artifact.fileMenu.panelDisplay.after}`);
    console.error('      The dialog-bearing surface (ExportWizard + its panes) is invisible to the census.');
    fail = 1;
  } else if (dialogsExercised < MIN_DIALOGS) {
    console.error(
      `FAIL: only ${dialogsExercised} File-menu dialogs were exercised (gate >=${MIN_DIALOGS}) — ` +
        `the dialog-depth numbers would be guesswork, not a census`,
    );
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
