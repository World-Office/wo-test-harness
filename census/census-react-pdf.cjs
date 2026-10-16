#!/usr/bin/env node
// census-react-pdf.cjs — DIALOG-DEPTH census of the REACT pdf editor — what
// production ships at /pdf/ (staging: http://192.168.42.42:8086/pdf/). PDF
// twin of census-react-sheet.cjs: the structural census proves buttons exist,
// the interaction census classifies what a click opens; neither measures how
// DEEP the overlay stack goes. WO's editor-common renders every modal as a
// native `<dialog open>` portaled to document.body (components/Window.tsx),
// so a dialog-on-dialog stacks N `<dialog open>` elements at once — that
// number is the dialog depth:
//
//   click every visible control on every surface (REAL Playwright clicks —
//     a synthetic el.click() does NOT open the fluent Menu popovers)
//     → classify the overlay that appears (dialog | menu | panel | widget | none)
//     → dialogDepth  = simultaneous `<dialog open>` layers (modal stack)
//     → overlayDepth = all open overlay layers (dialog+menu+panel+widget)
//     → DRILL: while a layer is open and depth < 3, click the layer's own
//       buttons and re-measure, recording the chain that goes deepest.
//
// Measured truth against the staged pdf build (192.168.42.42:8086/pdf/):
//   - the File menu is REACHABLE but only through a re-render side channel,
//     the pdf twin of the sheet/word File-menu bug: the Viewport
//     (`pdf-viewport`) renders `.pdf-file-menu-panel` from
//     `pdfStore.isFileMenuOpen` WITHOUT being a mobx observer, so the
//     File-tab click flips the store yet paints nothing. The census opens it
//     with the sheet's own trick:
//       real File-tab click → (pick a menu entry) → real keystrokes into the
//       document body (an edit flips pdfStore.isModified, which the App root
//       observer reads → the Viewport re-renders → the panel paints)
//   - the pdf FileMenu renders its entries as PLAIN BUTTONS in a
//     `[role="menubar"]` — no `[role="menuitem"]` anywhere (unlike the
//     word/sheet/slide menus), so the census enumerates the menubar buttons.
//   - the pane box (`panelBox`) is STATICALLY display:none in this build —
//     every pane (Create New / Download as / Advanced Settings / Document
//     Info / Help / Print Preview) ACTIVATES (display:block) but never
//     PAINTS, and the DEFAULT pane content ships no header for the box
//     itself; only the ExportWizard portals a real clickable `<dialog open>`.
//     The census enumerates each pane's shipped controls from the DOM it
//     mounts and fires them with SYNTHETIC domDrill clicks (recorded as
//     `dom`, never as a user path).
//   - Save Copy as... and Rename... activate NO pane and NO dialog — dead
//     entries in this build (measured, not assumed).
//
// HONEST GATE (exit 1 as soon as the CENSUS cannot see the dialog surface —
// the artifact must never be committable with the File menu unread):
//   1. the editor must mount (`.pdf-viewport` + a non-empty toolbar);
//   2. at least one control must open an overlay — if NOTHING opens, the
//      click-through/classifier is broken and the zeros are a census artifact;
//   3. the File menu must actually OPEN (`.pdf-file-menu-panel` visible);
//   4. at least 5 File-menu dialogs must be EXERCISED: entry clicked with the
//      menu open, the entry's dialog surface reached (its pane went
//      display:block — and was NOT active on the no-entry open-check page —
//      or a real `<dialog open>` is up). Whether the surface PAINTS is
//      measured and reported separately;
//   5. the artifact must be written.
// The verdict is not just the exit code: the artifact carries a TOP-LEVEL
// `ok` field plus `gate.checks`, so a reader can tell a passing capture from
// a blind one without re-running the census. `ok === false` MUST never be
// committed — it means the numbers are a census artifact, not a measurement.
//
// Usage (defaults to the staged pdf editor):
//     node census/census-react-pdf.cjs
//     CENSUS_REACT_URL=http://192.168.42.42:8086/pdf/ node census/census-react-pdf.cjs
// Output: census/census-pdf-depth.json (next to this file — the committed
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

const URL_BASE = process.env.CENSUS_REACT_URL || 'http://192.168.42.42:8086/pdf/';
const OUT = path.join(__dirname, 'census-pdf-depth.json');
const VIEWPORT = { width: 1600, height: 1000 };
const MAX_DEPTH = 3; // overlay layers we are willing to stack
const MAX_DRILL_ITEMS = 6; // layer buttons probed per level
const MAX_TABS = 8;
const MIN_DIALOGS = 5; // gate: File-menu dialog surfaces that must be exercised
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the pdf twin boots without crypto.randomUUID today, but the census installs
// the polyfill anyway: it costs nothing and keeps a future build that calls
// it (the slide one does) mountable in headless chromium on http origins.
const UUID_POLYFILL = () => {
  if (!window.crypto || !window.crypto.randomUUID) {
    const u = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    try {
      Object.defineProperty(window.crypto, 'randomUUID', { value: () => u() });
    } catch {
      window.crypto = { ...window.crypto, randomUUID: () => u() };
    }
  }
};

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
    ['.pdf-file-menu-panel', 'file-menu'],
    ['.pdf-about-menu-panel', 'about'],
    // left-menu rail panels: the thumbnails deck and the chat side panel are
    // the only rail contents this build mounts inside .pdf-left-panel-side
    // (search/comments/navigation/about render nothing; the wrapper itself is
    // an always-present DIV, so only its CONTENT counts as a layer)
    ['.pdf-thumbnail-panel', 'thumbnails-panel'],
    ['.pdf-left-panel-chat', 'chat-panel'],
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
      // fui renders captions twice ("CommentComment") — halve a perfect double
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

// the pdf FileMenu renders its entries as plain BUTTONS inside a
// [role="menubar"] — unlike the word/sheet/slide menus there is no
// [role="menuitem"] anywhere, so the items are the menubar's own buttons.
const FILE_MENU = () => {
  const p = document.querySelector('.pdf-file-menu-panel');
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const mb = p ? p.querySelector('[role="menubar"]') : null;
  // items IN THE DOM even while the panel is closed — an unopenable panel
  // still proves which dialog-bearing entries the build ships but never shows
  const items = mb
    ? [...mb.querySelectorAll('button')]
        .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' '))
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
// depth) plus the pane-box children each menu entry activates. The pdf
// FileMenu has no per-pane CSS classes (hashed Griffel styles): the pane box
// is the first child of the menubar's next DIV sibling, and each pane is a
// direct child of that box with an inline display + a header as first child.
// `panes` are enumerated from the DOM whether or not they paint — the build
// mounts every pane but keeps the box display:none, and the census still
// records the dialog the build ships (header + controls).
const FILE_MENU_DIALOGS = () => {
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const norm = (t) => (t || '').trim().replace(/\s+/g, ' ');
  const pane = (b) => {
    const r = b.getBoundingClientRect();
    const display = getComputedStyle(b).display;
    return {
      header: norm((b.firstElementChild || {}).textContent).slice(0, 40) || null,
      display,
      painted: display !== 'none' && vis(b),
      w: Math.round(r.width),
      h: Math.round(r.height),
      controls: [...b.querySelectorAll('button, select, input, textarea')].length,
      controlLabels: [...b.querySelectorAll('button, select')]
        .map((x) => norm(x.textContent).slice(0, 24))
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
      controlLabels: [...d.querySelectorAll('button, select')].filter(vis).map((b) => norm(b.textContent).slice(0, 24)).filter(Boolean).slice(0, 10),
    };
  };
  const p = document.querySelector('.pdf-file-menu-panel');
  const mb = p ? p.querySelector('[role="menubar"]') : null;
  // panelContainer = the menubar's DIV sibling inside the FileMenu root
  const container = mb ? [...mb.parentElement.children].find((c) => c !== mb && c.tagName === 'DIV') : null;
  const box = container ? container.firstElementChild : null; // panelBox (display:none)
  const panes = box ? [...box.children].map(pane) : [];
  return {
    panel: (() => {
      if (!p) return 'absent';
      return vis(p) ? 'visible' : getComputedStyle(p).display;
    })(),
    paneContainerDisplay: box ? getComputedStyle(box).display : 'absent',
    // visible `<dialog open>` layers …
    dialogLayers: [...document.querySelectorAll('dialog[open]')].filter(vis).map(dlg),
    // … and every open one regardless of paint (a DOM click in a hidden pane
    // can still portal a dialog; it must not vanish from the count)
    dialogElementsOpen: document.querySelectorAll('dialog[open]').length,
    panes,
    activePane: panes.find((x) => x.display !== 'none') || null,
    activePanes: panes.filter((x) => x.display !== 'none'),
  };
};

// click a File-menu entry BY CAPTION (a menubar button). The entries live in
// the DOM while the panel is still unrendered (the Viewport has no mobx
// observer), so they are clicked there and the panel — plus the entry's own
// dialog pane — paints on the App-observer re-render the census triggers next
// (a real keystroke into the document body).
const PICK_FILE_MENU_ITEM = (caption) => {
  const norm = (t) => (t || '').trim().replace(/\s+/g, ' ');
  const p = document.querySelector('.pdf-file-menu-panel');
  const mb = p ? p.querySelector('[role="menubar"]') : null;
  if (!mb) return null;
  const el = [...mb.querySelectorAll('button')].find((e) => norm(e.textContent).indexOf(caption) >= 0);
  if (!el) return null;
  el.click();
  return norm(el.textContent);
};

// labels of the controls of whichever dialog surface is currently up
const DIALOG_SURFACE_CONTROLS = () => {
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const norm = (t) => (t || '').trim().replace(/\s+/g, ' ');
  const dlg = [...document.querySelectorAll('dialog[open]')].filter(vis)[0];
  if (dlg)
    return {
      where: 'dialog',
      labels: [...dlg.querySelectorAll('button')].filter(vis).map((b) => norm(b.textContent).slice(0, 24)).filter(Boolean),
    };
  // the pdf pane box: any pane that is somehow visible
  const p = document.querySelector('.pdf-file-menu-panel');
  const mb = p ? p.querySelector('[role="menubar"]') : null;
  const container = mb ? [...mb.parentElement.children].find((c) => c !== mb && c.tagName === 'DIV') : null;
  const box = container && vis(container) ? container : null;
  if (box)
    return {
      where: 'pane-box',
      labels: [...box.querySelectorAll('button, select')].filter(vis).map((b) => norm(b.textContent || b.getAttribute('aria-label')).slice(0, 24)).filter(Boolean),
    };
  return null;
};

const CLICK_DIALOG_SURFACE_CONTROL = (label) => {
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const norm = (t) => (t || '').trim().replace(/\s+/g, ' ');
  const p = document.querySelector('.pdf-file-menu-panel');
  const mb = p ? p.querySelector('[role="menubar"]') : null;
  const container = mb ? [...mb.parentElement.children].find((c) => c !== mb && c.tagName === 'DIV') : null;
  const scopes = [...document.querySelectorAll('dialog[open]')].filter(vis);
  if (container && vis(container)) scopes.push(container);
  for (const s of scopes) {
    const el = [...s.querySelectorAll('button')]
      .filter(vis)
      .find((b) => norm(b.textContent).slice(0, 24) === label);
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      el.click();
      return true;
    }
  }
  return false;
};

// captions of the ACTIVE pane's own buttons, visible or not — a pane inside a
// display:none box still mounts its controls, and the census enumerates them
// so the shipped surface is on record even when no pointer can reach it
const PANE_CONTROL_LABELS = () => {
  const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const p = document.querySelector('.pdf-file-menu-panel');
  const mb = p ? p.querySelector('[role="menubar"]') : null;
  const container = mb ? [...mb.parentElement.children].find((c) => c !== mb && c.tagName === 'DIV') : null;
  const box = container ? container.firstElementChild : null;
  const out = [];
  if (box) {
    for (const b of box.children) {
      if (getComputedStyle(b).display === 'none') continue;
      for (const el of b.querySelectorAll('button')) {
        const l = norm(el.textContent).slice(0, 24);
        if (l && !out.includes(l)) out.push(l);
      }
    }
  }
  return out;
};

// SYNTHETIC DOM click on a control of the active (but unpainted) pane. This
// is NOT a user path — the pane lives in a display:none box, so no real
// pointer can reach it — but firing the handler is the only way to learn
// whether the pane's own controls portal a real `<dialog open>` (dialog
// depth). Never counted as a user path, never as a `real` click.
const DOM_CLICK_PANE_CONTROL = (label) => {
  const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const p = document.querySelector('.pdf-file-menu-panel');
  const mb = p ? p.querySelector('[role="menubar"]') : null;
  const container = mb ? [...mb.parentElement.children].find((c) => c !== mb && c.tagName === 'DIV') : null;
  const box = container ? container.firstElementChild : null;
  if (!box) return false;
  for (const b of box.children) {
    if (getComputedStyle(b).display === 'none') continue;
    const el = [...b.querySelectorAll('button')].find((x) => norm(x.textContent).slice(0, 24) === label);
    if (el) {
      el.click();
      return true;
    }
  }
  return false;
};

const TAB_LIST = () =>
  [...document.querySelectorAll('.pdf-viewport-toolbar button')]
    .filter((b) => b.classList.contains('pdf-toolbar-tab') || b.classList.contains('fui-Tab'))
    .map((b) => {
      let t = (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ');
      // fui-Tab renders its caption twice ("CommentComment") — halve a double
      if (t.length && t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) {
        t = t.slice(0, t.length / 2);
      }
      return { cls: b.classList.contains('pdf-toolbar-tab') ? 'pdf-toolbar-tab' : 'fui-Tab', label: t };
    });

// tab buttons are enumerated by the toolbar scan but censused as `fileMenu`
const RIBBON_TAB_LABELS = ['File', 'Home', 'Comment', 'View'];
const isRibbonTab = (c) => c.tag === 'button' && RIBBON_TAB_LABELS.includes(c.label);

// File-menu entries that leave the editor (navigate / close) — they are not
// dialog surfaces, and exercising them would kill the page mid-census
const SKIP_NAV_ITEMS = ['Go to Documents'];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    await ctx.addInitScript(UUID_POLYFILL);
    return ctx.newPage();
  };
  const page = await newPage();
  const pageerrors = [];
  page.on('pageerror', (e) => pageerrors.push(String(e.message).slice(0, 160)));
  // a renderer crash / browser disconnect mid-census looks exactly like a hang
  // from the outside — say which one it was instead of dying silently (the
  // deliberate close() at the end is NOT a disconnect)
  let closing = false;
  page.on('crash', () => console.log('!!! PAGE CRASH EVENT (renderer gone)'));
  browser.on('disconnected', () => { if (!closing) console.log('!!! BROWSER DISCONNECTED'); });

  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const mounted = await page
    .waitForSelector('.pdf-viewport', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  await page
    .waitForFunction(() => document.querySelectorAll('.pdf-viewport-toolbar button').length > 3, {
      timeout: 25000,
    })
    .catch(() => {});
  await sleep(1200); // fluent ribbon + pdf.js canvas settle
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
        return true;
      }, [sel, idx])) || 'missing';
    }
  };

  // ── File menu: OPEN it (the pdf twin of the census-react.cjs assertion) ──
  // The Viewport renders .pdf-file-menu-panel from isFileMenuOpen without a
  // mobx observer, so the File-tab click alone paints nothing; a real
  // keystroke into the document body flips pdfStore.isModified, re-renders
  // the App root observer (which reads it) and the panel appears. `entry`
  // (optional) picks a dialog-bearing File-menu entry while the panel is
  // still unrendered, so the SAME re-render paints the entry's dialog pane
  // too (there is no second re-render to be had).
  const openFileMenu = async (p, entry) => {
    const steps = [];
    const tab = await p
      .click('.pdf-toolbar-tab', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    steps.push(`file-tab-click:${tab ? 'ok' : 'miss'}`);
    let picked = null;
    if (tab && entry) {
      picked = await p.evaluate(PICK_FILE_MENU_ITEM, entry).catch(() => null);
      steps.push(`entry-click:${picked || 'miss'}`);
    }
    // real keystrokes into the document body — the re-render that paints the
    // panel (an edit flips pdfStore.isModified, which the App observer reads)
    let rerender = 'none';
    let state = await p.evaluate(FILE_MENU_DIALOGS);
    for (let attempt = 0; attempt < 3 && state.panel !== 'visible'; attempt++) {
      await p.mouse.click(820, 480 + attempt * 26).catch(() => {});
      await p.keyboard.type('census', { delay: 25 }).catch(() => {});
      await p.keyboard.press('Enter').catch(() => {});
      await sleep(320);
      state = await p.evaluate(FILE_MENU_DIALOGS);
      if (state.panel === 'visible') rerender = `keystroke#${attempt + 1}`;
    }
    steps.push(`rerender:${rerender}`);
    return { steps, picked, rerender, state };
  };

  // The File-menu check runs on its OWN page, AFTER the toolbar census: once
  // the panel paints it covers the toolbar, and the Viewport's missing
  // observer means no re-render will ever paint it away — real Playwright
  // clicks on the toolbar would then time out behind it for the rest of the
  // run.
  const fileMenuBefore = await ev(FILE_MENU);
  let open = { steps: [], picked: null, rerender: 'not-run', state: { panel: 'absent' } };
  let fileMenuAfter = { panel: 'absent' };
  let fileMenuClosed = null;
  const openFileMenuOnFreshPage = async () => {
    const fp = await newPage();
    fp.on('pageerror', (e) => pageerrors.push(`[file-menu] ${String(e.message).slice(0, 120)}`));
    await fp.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await fp.waitForSelector('.pdf-viewport', { timeout: 25000 }).catch(() => {});
    await fp
      .waitForFunction(() => document.querySelectorAll('.pdf-viewport-toolbar button').length > 3, {
        timeout: 25000,
      })
      .catch(() => {});
    await sleep(1000);
    const res = await openFileMenu(fp, null);
    const after = await fp.evaluate(FILE_MENU_DIALOGS);
    let closed = null;
    if (res.state.panel === 'visible') {
      // a real click on the (now visible) Back button must close it again
      await fp
        .locator('.pdf-file-menu-panel [role="menubar"] button', { hasText: 'Back' })
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
      const b = [...document.querySelectorAll('.pdf-viewport-toolbar .fui-Tab')].find((x) => {
        const s = (x.textContent || '').trim();
        return s === label || s === label + label;
      });
      if (b) b.click();
    }, t.label);
    await sleep(450);
    const controls = (await ev(PROBE_CONTROLS, '.pdf-viewport-toolbar')).filter((c) => !isRibbonTab(c));
    for (const c of controls) {
      rows.push(await censusControl(`toolbar:${t.label}`, '.pdf-viewport-toolbar', c));
    }
  }

  // 2. left menu rail, status bar
  for (const [surface, sel] of [
    ['left-menu', '.pdf-left-menu-btns'],
    ['statusbar', '.pdf-statusbar'],
  ]) {
    for (const c of await ev(PROBE_CONTROLS, sel)) {
      rows.push(await censusControl(surface, sel, c));
    }
  }

  stamp(`toolbar + surface census (${rows.length} controls, ${rows.filter((r) => r.opened).length} opened)`);

  // ── File menu: OPEN it (the pdf twin of the census-react.cjs assertion),
  //    on its own page so the panel cannot cover the census surface above ──
  ({ res: open, after: fileMenuAfter, closed: fileMenuClosed } = await openFileMenuOnFreshPage());
  stamp(`file-menu open check (opened=${open.state.panel === 'visible'})`);
  // BASELINE: which panes (if any) the panel activates when it opens with NO
  // entry clicked. An entry only proves it reached its own dialog surface if
  // it activates a pane that was NOT already active here.
  const baselinePaneHeaders = ((fileMenuAfter && fileMenuAfter.activePanes) || []).map((x) => x.header);

  // ── 3. File-menu dialogs — one FRESH page per entry (the pane only paints
  //       on the re-render that follows the entry click, so each entry needs
  //       its own mount), run through a small pool: the entries are
  //       independent and each needs its own editor instance ────────────────
  const fileMenuItems = [
    ...new Set(
      fileMenuBefore.items.filter((i) => !/^(←)?Back$/.test(i) && !SKIP_NAV_ITEMS.includes(i)),
    ),
  ];
  const dialogs = [];
  const censusFileMenuEntry = async (item) => {
    const p = await newPage();
    p.on('pageerror', (e) => pageerrors.push(`[${item}] ${String(e.message).slice(0, 120)}`));
    p.on('popup', (pp) => pp.close().catch(() => {})); // Help opens a tab
    p.on('download', (d) => d.cancel().catch(() => {})); // export entries download
    await p.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForSelector('.pdf-viewport', { timeout: 25000 }).catch(() => {});
    await p
      .waitForFunction(() => document.querySelectorAll('.pdf-viewport-toolbar button').length > 3, {
        timeout: 25000,
      })
      .catch(() => {});
    await sleep(700);

    const run = await openFileMenu(p, item);
    const st = run.state;
    const native = st.dialogLayers.length > 0;
    // panes THIS ENTRY activated: display:block panes that were not active on
    // the no-entry open-check page — proof the click mounted the surface, not
    // the panel's default pane
    const freshPanes = (st.activePanes || []).filter((x) => !baselinePaneHeaders.includes(x.header));
    const pane = freshPanes[0] || null;
    // EXERCISED: the census reached the entry's dialog surface — the entry
    // activated its own pane, or opened a real portaled <dialog>. PAINTED:
    // that surface is actually visible; this build keeps the pane box
    // display:none, so only the ExportWizard dialog ever paints (recorded as
    // a finding, not a gate fail).
    const entry = {
      item,
      picked: run.picked,
      steps: run.steps,
      fileMenuOpen: st.panel === 'visible',
      paneHeader: pane ? pane.header : null,
      paneActivated: !!pane,
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
      domDrill: [],
    };
    if (st.panel !== 'visible') {
      // non-dialog entry: the click closes the menu again
      entry.note = `file-menu-panel:${st.panel}`;
    } else if (!native && !pane) {
      entry.note = 'menu stayed open but the entry activated no pane and no <dialog> — a dialog-declaring entry whose pane this build never renders';
    } else if (pane && !pane.painted) {
      entry.note = `pane mounted (display:${pane.display}) but never paints — pane box is display:${st.paneContainerDisplay}; controls enumerated from the DOM`;
    }

    // exercise the surface: real-click its own buttons, re-measure the stack.
    // Only a painted surface is clickable — a mounted-but-hidden pane has no
    // user path, so its controls are enumerated, not clicked.
    if (entry.painted) {
      const controls = await p.evaluate(DIALOG_SURFACE_CONTROLS).catch(() => null);
      for (const label of (controls ? controls.labels : []).slice(0, 3)) {
        const before = await p.evaluate(FILE_MENU_DIALOGS);
        const clicked = await p
          .locator('dialog[open] button', { hasText: label })
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
          // Only the dialog itself counts: the file-menu panel behind it stays
          // open after a successful dismiss, so including `panel === 'visible'`
          // here misreported every working ✕ as a stuck dialog.
          stillOpen: after.dialogLayers.length > 0,
          deepened: grew,
        });
        entry.dialogDepth = Math.max(entry.dialogDepth, after.dialogLayers.length);
        if (after.dialogLayers.length === 0) break; // dismissed
      }
    }

    // hidden-pane DOM drill (SYNTHETIC, recorded as `domDrill`): the pane is
    // mounted inside a display:none box, so no real pointer can reach it —
    // but firing its buttons' handlers is the only way to learn whether the
    // pane's own controls portal a real `<dialog open>` (dialog depth). Never
    // counted as a user path, never as a `real` click.
    if (entry.exercised && !entry.painted && entry.paneHeader) {
      const labels = await p.evaluate(PANE_CONTROL_LABELS).catch(() => null);
      for (const label of (labels || []).slice(0, 3)) {
        const before = await p.evaluate(FILE_MENU_DIALOGS).catch(() => null);
        if (!before) break;
        const clicked = await p.evaluate(DOM_CLICK_PANE_CONTROL, label).catch(() => false);
        await sleep(400);
        const after = await p.evaluate(FILE_MENU_DIALOGS).catch(() => null);
        if (!after) break; // the click navigated / killed the page
        entry.domDrill.push({
          control: label,
          clicked: clicked ? 'dom' : 'miss',
          dialogLayers: after.dialogLayers.length,
          dialogElementsOpen: after.dialogElementsOpen,
          deepened: after.dialogElementsOpen > before.dialogElementsOpen,
        });
        entry.dialogDepth = Math.max(entry.dialogDepth, after.dialogLayers.length);
        if (after.dialogElementsOpen > 0) break; // a real dialog is up — stop
      }
    }
    await p.close();
    return entry;
  };

  // bounded pool over the entries (order preserved: results land at their
  // queue index, so `dialogs` mirrors the menu's own order)
  const POOL = 4;
  const runPool = async (items) => {
    const out = new Array(items.length).fill(null);
    const queue = items.map((_, i) => i);
    const workers = Array.from({ length: Math.min(POOL, queue.length) }, async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
        try {
          out[i] = await censusFileMenuEntry(items[i]);
        } catch (e) {
          out[i] = {
            item: items[i],
            exercised: false,
            painted: false,
            kind: 'none',
            dialogDepth: 0,
            surface: null,
            drill: [],
            domDrill: [],
            note: `census-error:${String(e.message).slice(0, 80)}`,
          };
        }
      }
    });
    await Promise.all(workers);
    return out;
  };
  dialogs.push(...(await runPool(fileMenuItems)));
  for (const entry of dialogs) {
    console.log(
      `  ${entry.exercised ? (entry.painted ? '+' : '~') : '-'} file-menu/${entry.item}: ${entry.kind}` +
        ` dialogDepth=${entry.dialogDepth}` +
        (entry.surface ? ` surface=${entry.surface.where}:${entry.surface.header || entry.surface.title} controls=${entry.surface.controls}` : '') +
        (entry.drill.length ? ` drill=[${entry.drill.map((d) => `${d.control}:${d.clicked}${d.deepened ? '+' : ''}`).join(', ')}]` : '') +
        (entry.domDrill.length ? ` domDrill=[${entry.domDrill.map((d) => `${d.control}:${d.clicked}${d.deepened ? '+' : ''}`).join(', ')}]` : '') +
        (entry.note ? ` (${entry.note})` : ''),
    );
  }

  stamp(`file-menu dialogs (${dialogs.filter((d) => d.exercised).length}/${fileMenuItems.length} exercised)`);

  // bounded retry, ONLY when the gate would otherwise fail: an entry that
  // reached no surface because the isModified re-render never fired is flake,
  // not a property of the build, and the >=5 gate must not fail on it. One
  // extra pass over the unexercised entries; deterministic misses (entries
  // that close the menu) simply fail again and are reported as measured.
  if (dialogs.filter((d) => d.exercised).length < MIN_DIALOGS) {
    const retryItems = dialogs.filter((d) => !d.exercised).map((d) => d.item);
    stamp(`retry: ${retryItems.length} entries reached no dialog surface (gate >=${MIN_DIALOGS})`);
    for (const entry of (await runPool(retryItems)).entries()) {
      if (!entry) continue;
      const at = dialogs.findIndex((d) => d.item === entry.item && !d.exercised);
      if (at >= 0) {
        entry.retried = true;
        dialogs[at] = entry;
        console.log(
          `  ${entry.exercised ? (entry.painted ? '+' : '~') : '-'} retry/${entry.item}: ${entry.kind}` +
            ` dialogDepth=${entry.dialogDepth}` +
            (entry.note ? ` (${entry.note})` : ''),
        );
      }
    }
  }

  // ── summary + artifact ─────────────────────────────────────────────────
  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  const domDialogs = await page.evaluate(() => document.querySelectorAll('dialog').length);
  const maxOverlay = rows.reduce((m, r) => Math.max(m, r.overlayDepth), 0);
  const dialogsExercised = dialogs.filter((d) => d.exercised).length;
  const dialogsPainted = dialogs.filter((d) => d.painted).length;
  const maxFileMenuDialogDepth = dialogs.reduce((m, d) => Math.max(m, d.dialogDepth), 0);
  const domDrillDeepened = dialogs.filter((d) => (d.domDrill || []).some((x) => x.deepened));
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
    fileMenuDialogsDomDrilled: domDrillDeepened.length,
    maxFileMenuDialogDepth,
  };

  const findings = [];
  if (fileMenuBefore.present && open.state.panel !== 'visible') {
    findings.push(
      `file-menu-unopenable: .pdf-file-menu-panel ships ${fileMenuBefore.items.length} menu items in the DOM ` +
        `(${fileMenuBefore.items.slice(0, 5).join(', ')}…) but neither a real File-tab click nor the ` +
        `isModified re-render made it visible (panel:${open.state.panel}) — the whole dialog-bearing ` +
        `surface is unreachable and its dialog depth cannot be censused`,
    );
  } else if (fileMenuBefore.present) {
    findings.push(
      `file-menu-render-bug: the File-tab click alone paints NOTHING (.pdf-file-menu-panel stayed ` +
        `display:${fileMenuBefore.display}); the panel only renders on the next App-observer re-render, which ` +
        `this census triggers with real keystrokes into the document body (an edit flips pdfStore.isModified, ` +
        `which the App root observer reads). The Viewport that owns the panel does not observe ` +
        `isFileMenuOpen/activeFileMenuPanel — the pdf twin of the documented word/sheet File-menu bug. Every ` +
        `dialog pane below is censused through that side channel, one fresh page per entry, because no second ` +
        `re-render exists to paint a pane switch`,
    );
  }
  if (open.state.panel === 'visible' && fileMenuClosed && fileMenuClosed.visible) {
    findings.push(
      `file-menu-no-close: a real click on the now-visible Back entry flips isFileMenuOpen in the store but ` +
        `the panel STAYS painted (${fileMenuClosed.display}) — the same missing-observer re-render that made ` +
        `the File-tab click paint nothing also makes the menu impossible to close for the user`,
    );
  }
  const deadEntries = dialogs.filter((d) => !d.exercised && d.item.endsWith('...'));
  if (deadEntries.length) {
    findings.push(
      `file-menu-dead-entries: ${deadEntries.length} dialog-declaring entries reach no dialog surface ` +
        `(${deadEntries.map((d) => `${d.item}[${d.note || 'no pane'}]`).join(', ')}) — they either close the ` +
        `menu (non-pane action) or declare a pane the build never renders (the pdf FileMenu ships no ` +
        `save-copy/rename pane at all)`,
    );
  }
  const mountedNotPainted = dialogs.filter((d) => d.exercised && !d.painted);
  if (mountedNotPainted.length) {
    findings.push(
      `file-menu-panes-never-paint: ${mountedNotPainted.length} dialog panes ACTIVATE but never paint — ` +
        `their pane box is statically display:${mountedNotPainted[0].paneContainerDisplay} (panelBox in the ` +
        `pdf FileMenu), so the pane is w=0/h=0 and no real click can reach it: ` +
        `${mountedNotPainted.map((d) => `${d.item}→${d.surface ? d.surface.header : '?'}`).join(', ')}. ` +
        `The census enumerates each pane's shipped controls from the DOM it mounts and fires them with ` +
        `SYNTHETIC domDrill clicks (${domDrillDeepened.length ? `${domDrillDeepened.map((d) => d.item).join(', ')} portal a real <dialog>` : 'none portals a real <dialog>'}), ` +
        `but only the portaled ExportWizard <dialog> (${dialogsPainted} surface${dialogsPainted === 1 ? '' : 's'} painted) is ` +
        `actually clickable by a user`,
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
        `${dialogsExercised} File-menu dialogs — the pdf React UI exposes no reachable modal <dialog>`,
    );
  }
  const toggledNoOverlay = rows.filter((r) => r.toggled);
  if (toggledNoOverlay.length) {
    findings.push(
      `toggle-without-overlay: ${toggledNoOverlay.length} controls flip their own active/pressed ` +
        `state but open nothing (${toggledNoOverlay.map((r) => `${r.surface}/${r.control}`).join(', ')})`,
    );
  }
  const noOverlay = rows.filter((r) => !r.opened && !r.toggled);
  if (noOverlay.length) {
    // no overlay + no exposed toggle state == direct-action from the DOM's
    // point of view; whether the command really mutates the pdf is fx-wo's job
    findings.push(
      `${noOverlay.length}/${rows.length} controls open no overlay and expose no toggle state ` +
        `(direct-action or no-op — not decidable from the DOM): ` +
        noOverlay.map((r) => `${r.surface}/${r.control}`).slice(0, 12).join(', ') +
        (noOverlay.length > 12 ? ' …' : ''),
    );
  }
  if (fileMenuBefore.present && !(fileMenuBefore.items || []).length) {
    findings.push(
      'file-menu-no-menuitem-role: the pdf FileMenu renders its entries as plain BUTTONS inside a ' +
        '[role="menubar"] — no [role="menuitem"] anywhere, unlike the word/sheet/slide menus — so generic ' +
        'menuitem-targeted tooling finds an empty menu',
    );
  }

  // ── gate: the checks the artifact itself reports (`ok` + `gate.checks`) ──
  // Computed BEFORE the artifact is written so the committed JSON carries its
  // own verdict: a reader can tell a passing capture from a blind one without
  // re-running the census. `ok: false` must never be committed — it means the
  // numbers above are a census artifact, not a measurement.
  const fileMenuOpened = open.state.panel === 'visible';
  const checks = [
    {
      check: 'editor-mounted',
      ok: !!(mounted && summary.controls >= 1),
      detail: `.pdf-viewport mounted + ${summary.controls} toolbar/surface controls censused`,
      fail: ['FAIL: pdf editor never mounted (no .pdf-viewport / no controls) — census is blind'],
    },
    {
      check: 'overlay-seen',
      ok: summary.opened >= 1,
      detail: `${summary.opened} controls opened an overlay (${JSON.stringify(byKind)})`,
      fail: ['FAIL: no control opened any overlay — the click-through/classifier measured nothing'],
    },
    {
      check: 'file-menu-open',
      ok: fileMenuOpened,
      detail: `panel=${fileMenuAfter.panel} via ${open.steps.join(' > ')}`,
      fail: [
        'FAIL: the File menu did not open (.pdf-file-menu-panel never became visible).',
        `      trigger=${open.steps.join(' > ')} panel=${fileMenuAfter.panel}`,
        '      The dialog-bearing surface (ExportWizard + its panes) is invisible to the census.',
      ],
    },
    {
      check: `file-menu-dialogs>=${MIN_DIALOGS}`,
      ok: dialogsExercised >= MIN_DIALOGS,
      detail: `${dialogsExercised}/${fileMenuItems.length} entries reached their dialog surface (${dialogsPainted} painted)`,
      fail: [
        `FAIL: only ${dialogsExercised} File-menu dialogs were exercised (gate >=${MIN_DIALOGS}) — `,
        '      the dialog-depth numbers would be guesswork, not a census',
      ],
    },
  ];
  const failedChecks = checks.filter((c) => !c.ok);
  const ok = failedChecks.length === 0;

  const artifact = {
    ok, // top-level verdict of the gate below — never commit ok:false
    gate: {
      ok,
      minDialogs: MIN_DIALOGS,
      checks: checks.map(({ check, ok: pass, detail }) => ({ check, ok: pass, detail })),
      failedChecks: failedChecks.map((c) => c.check),
    },
    engine: 'worldoffice-react-pdf',
    capturedAt: new Date().toISOString(),
    url: URL_BASE,
    viewport: VIEWPORT,
    pageErrors: pageerrors,
    mounted,
    toolbarTabs: tabs.map((t) => t.label),
    fileMenu: {
      tab: tabs.some((t) => t.cls === 'pdf-toolbar-tab'),
      panelPresent: fileMenuBefore.present,
      panelDisplay: { before: fileMenuBefore.display, after: fileMenuAfter.panel },
      panelVisible: fileMenuAfter.panel === 'visible',
      opened: fileMenuOpened,
      // how the census got it open: the Viewport has no mobx observer, so the
      // panel paints on the next App-observer re-render (isModified flip),
      // not on the File-tab click itself
      openTrigger: open.steps.join(' > '),
      closedByBackClick: fileMenuClosed ? !fileMenuClosed.visible : null,
      // panes the panel activates with NO entry clicked — an entry only proves
      // it reached its own dialog surface if it activates a pane beyond these
      baselinePanes: baselinePaneHeaders,
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
    `census-react-pdf: mounted=${mounted} tabs=[${artifact.toolbarTabs.join(',')}] ` +
      `controls=${summary.controls} opened=${summary.opened} toggledOnly=${summary.toggledOnly} ` +
      `kinds=${JSON.stringify(byKind)} maxDialogDepth=${summary.maxDialogDepth} ` +
      `maxOverlayDepth=${summary.maxOverlayDepth}`,
  );
  console.log(
    `file-menu: opened=${artifact.fileMenu.opened} trigger=${artifact.fileMenu.openTrigger} ` +
      `items=${artifact.fileMenu.items.length} dialogsExercised=${dialogsExercised}/${fileMenuItems.length} ` +
      `dialogsPainted=${dialogsPainted} domDrilled=${summary.fileMenuDialogsDomDrilled} ` +
      `(gate >=${MIN_DIALOGS} exercised) maxDialogDepth=${maxFileMenuDialogDepth}`,
  );
  for (const r of rows.filter((x) => x.opened)) {
    console.log(
      `  + ${r.surface}/${r.control}: ${r.kind} depth=${r.overlayDepth} dialog=${r.dialogDepth}` +
        (r.chain.length ? ` chain=[${r.chain.join(' > ')}]` : ''),
    );
  }
  for (const f of findings) console.log(`FINDING ${f}`);
  closing = true;
  await browser.close();

  let fail = 0;
  for (const c of failedChecks) {
    for (const line of c.fail) console.error(line);
    fail = 1;
  }
  // the write is the one check that cannot be evaluated before the artifact
  // exists; it still flips the exit code (and ok:false would never be written)
  let written = false;
  try {
    written = JSON.parse(fs.readFileSync(OUT, 'utf8')).ok === ok;
  } catch {
    written = false;
  }
  if (!written) {
    console.error('FAIL: artifact not written / unreadable');
    fail = 1;
  }
  console.log(`artifact: ${OUT} ok=${ok} (${checks.length - failedChecks.length}/${checks.length} gate checks)`);
  process.exit(fail);
})().catch((e) => {
  console.error('FAIL', e && e.message ? e.message : e);
  process.exit(1);
});
