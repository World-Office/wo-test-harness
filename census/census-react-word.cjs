#!/usr/bin/env node
// census-react-word.cjs — DIALOG-DEPTH census of the WORD editor — what
// production actually ships at /word/ (live: http://192.168.42.42:8086/word/).
// Word twin of census-react-pdf.cjs: the structural census proves buttons
// exist, the interaction census classifies what a click opens; neither
// measures how DEEP the overlay stack goes — that number is this census:
//
//   click every visible control on every surface (REAL Playwright clicks —
//     the file menu is wired on CLICK, a dispatched mousedown never opens it)
//     → classify the overlay that appears (dialog | menu | panel | none)
//     → dialogDepth  = simultaneous dialog layers (modal stack)
//     → overlayDepth = all open overlay layers (dialog+menu+panel)
//     → DRILL: while a layer is open and depth < 3, click the layer's own
//       buttons and re-measure, recording the chain that goes deepest.
//
// WHAT IS LIVE AT /word/ (measured, not assumed): the Rust docserver serves
// frontend-dist/word/ = the VANILLA `documenteditor-wysiwyg` (editor.js +
// style.css; grep-proven: no .de-file-menu-panel / no React root) — the same
// UI fx-prod.cjs censused ("editor_ui_dir/word/ has ribbon-row-2, no
// de-file-menu-panel"). The React documenteditor-react (.de-* selectors,
// FileTab [data-tab="file"]) exists in apps/web but is NOT what /word/
// serves today, so this census drives the vanilla DOM model:
//   - modals are `.dialog-overlay[role=dialog]` divs toggled by an `open`
//     class (NOT native <dialog> — dialogDepth counts open dialog-overlay
//     layers + any future native dialog[open] the React build would bring);
//   - menus are `#file-menu` (btn-file toggle) / `.menu-list` ribbon
//     popovers / `.menu-sublist` (the Export submenu) / `#ctx-menu`;
//   - panels are #nav-panel / #chat-panel / #review-panel / #comments-panel;
//   - the File menu opens DIRECTLY on the #btn-file click (no missing-mobx-
//     observer re-render channel is needed — that bug family is React-only).
//
// Measured truth against the live word build (192.168.42.42:8086/word/):
//   - 11 ribbon tabs (Home/Insert/Draw/Layout/References/Collaboration/
//     Protection/View/Plugins/AI/Header & Footer), each censused with its
//     own visible controls + dropdown-menu triggers;
//   - the File menu ships 11 visible entries; 7 of them open a real
//     `.dialog-overlay` (History… / AI changes… / Info… / Protect document… /
//     Settings… / Help & about / Suggest a feature…); Export opens a
//     submenu (PDF/ODT/HTML/DOCX — download entries); New / Open… / Print
//     open NOTHING (measured silent, recorded as findings).
//
// HONEST GATE (exit 1 as soon as the CENSUS cannot see the dialog surface —
// the artifact must never be committable with the File menu unread):
//   1. the editor must mount (#toolbar + ribbon tabs + censused controls);
//   2. at least one control must open an overlay — if NOTHING opens, the
//      click-through/classifier is broken and the zeros are a census artifact;
//   3. the File menu must actually OPEN (#file-menu visible after a REAL
//      #btn-file click — the trigger-regression guard the ledger gate knows);
//   4. at least 5 File-menu dialogs must be EXERCISED: entry clicked with
//      the menu open and the entry's `.dialog-overlay` actually up;
//   5. the artifact must be written.
// The verdict is not just the exit code: the artifact carries a TOP-LEVEL
// `ok` field plus `gate.checks`, so a reader can tell a passing capture from
// a blind one without re-running the census. `ok === false` MUST never be
// committed — it means the numbers are a census artifact, not a measurement.
//
// Usage (defaults to the live word editor):
//     node census/census-react-word.cjs
//     CENSUS_REACT_URL=http://192.168.42.42:8086/word/ node census/census-react-word.cjs
// Output: census/census-word-depth.json (next to this file — the committed
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

const URL_BASE = process.env.CENSUS_REACT_URL || 'http://192.168.42.42:8086/word/';
const OUT = path.join(__dirname, 'census-word-depth.json');
const VIEWPORT = { width: 1600, height: 1000 };
const MAX_DEPTH = 3; // overlay layers we are willing to stack
const MAX_DRILL_ITEMS = 6; // layer buttons probed per level
const MIN_DIALOGS = 5; // gate: File-menu dialogs that must be exercised
// the drill pokes the layer's own buttons to measure dialog-on-dialog depth;
// outbound side effects are not depth signals — Send posts a suggestion
// ticket, so it is enumerated but never drill-clicked
const DRILL_DENY = /^(send|sign out|log ?out|go to documents)$/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── page-side probes (REAL functions: a string passed to page.evaluate is
//    parsed as an expression, not a function — it clicks nothing) ──────────
const PROBE_LAYERS = () => {
  const vis = (el) => {
    if (!el || el.hidden) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  const norm = (t) => (t || '').trim().replace(/\s+/g, ' ');
  const label = (el) =>
    norm(el.getAttribute('aria-label') || el.id || (el.querySelector('h2,h3,.dialog-title') || {}).textContent || el.textContent)
      .slice(0, 48);
  const size = (el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };
  const actionable = (root) =>
    [...root.querySelectorAll('button,[role="menuitem"],a')]
      .filter(vis)
      .map((b) => norm(b.getAttribute('aria-label') || b.textContent || b.id))
      .filter(Boolean);
  const layers = [];

  // 1. modal dialogs — the vanilla editor toggles `.dialog-overlay`
  //    [role=dialog] divs with an `open` class; #table-dialog is an
  //    `.insert-pop` that still declares role=dialog. A future React build
  //    would portal native <dialog open> — counted too.
  for (const el of document.querySelectorAll('.dialog-overlay, dialog[open], .insert-pop')) {
    if (!vis(el)) continue;
    const isDialog =
      el.tagName === 'DIALOG' || el.classList.contains('dialog-overlay') || el.getAttribute('role') === 'dialog';
    if (!isDialog) continue;
    layers.push({ kind: 'dialog', label: label(el) || 'dialog', ...size(el), buttons: actionable(el) });
  }
  // 2. menus — #file-menu itself IS a .menu-list, and .menu-sublist nests
  //    inside it: count the OUTERMOST visible one only (a submenu open on
  //    top of the file menu is one stack level deeper, which the drill
  //    measures as depth, not as two sibling layers)
  const menuCands = [...document.querySelectorAll('#file-menu, #ctx-menu, .menu-list, .menu-sublist')].filter(vis);
  for (const el of menuCands) {
    if (menuCands.some((other) => other !== el && other.contains(el))) continue;
    if (el.closest('.dialog-overlay')) continue;
    layers.push({ kind: 'menu', label: label(el) || 'menu', ...size(el), buttons: actionable(el) });
  }
  // 3. side panels
  for (const el of document.querySelectorAll('#nav-panel, #chat-panel, #review-panel, #comments-panel')) {
    if (!vis(el)) continue;
    layers.push({ kind: 'panel', label: el.id, ...size(el), buttons: actionable(el) });
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
        el.getAttribute('title') ||
        el.textContent ||
        el.id ||
        ''
      )
        .trim()
        .replace(/\s+/g, ' ');
      return {
        idx: i,
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        label: label.slice(0, 40) || null,
        disabled: el.tagName === 'BUTTON' ? el.disabled : false,
      };
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
    hidden: el.hidden,
  };
};

// the File menu: #btn-file (a .menu-trigger) toggles #file-menu on a REAL
// click. `items` are the visible entry buttons (the hidden PDF/ODT/… export
// subentries only paint once Export opens its .menu-sublist).
const FILE_MENU = () => {
  const vis = (el) => {
    if (!el || el.hidden) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  const fm = document.querySelector('#file-menu');
  const btn = document.querySelector('#btn-file');
  const items = fm
    ? [...fm.querySelectorAll(':scope > li > button, :scope > button')]
        .filter((b) => vis(b))
        .map((b) => (b.textContent || '').trim().replace(/\s+/g, ' '))
        .filter(Boolean)
    : [];
  return {
    present: !!fm,
    display: fm ? (vis(fm) ? 'visible' : getComputedStyle(fm).display) : 'absent',
    visible: vis(fm),
    trigger: !!btn,
    items,
  };
};

// click a File-menu entry BY CAPTION (the visible top-level entries; the
// Export submenu items live in .menu-sublist and are reached through the
// drill after Export opens it)
const PICK_FILE_MENU_ITEM = (caption) => {
  const norm = (t) => (t || '').trim().replace(/\s+/g, ' ');
  const fm = document.querySelector('#file-menu');
  if (!fm) return null;
  const els = [...fm.querySelectorAll('button')].filter(
    (b) => !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length),
  );
  const el = els.find((e) => norm(e.textContent) === caption) || els.find((e) => norm(e.textContent).indexOf(caption) >= 0);
  if (!el) return null;
  el.click();
  return norm(el.textContent);
};

// the dialog surface currently up (first open dialog-overlay): id, title,
// its own visible controls — the census drills those to measure
// dialog-on-dialog depth
const DIALOG_SURFACE_CONTROLS = () => {
  const vis = (el) => {
    if (!el || el.hidden) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  const norm = (t) => (t || '').trim().replace(/\s+/g, ' ');
  const dlg = [...document.querySelectorAll('.dialog-overlay, dialog[open]')].filter(vis)[0];
  if (!dlg) return null;
  return {
    where: 'dialog',
    id: dlg.id || null,
    title: norm((dlg.querySelector('h2,h3,.dialog-title') || {}).textContent).slice(0, 40) || null,
    labels: [...dlg.querySelectorAll('button, select')]
      .filter(vis)
      .map((b) => norm(b.getAttribute('aria-label') || b.textContent || b.id).slice(0, 24))
      .filter(Boolean),
  };
};

const CLICK_DIALOG_SURFACE_CONTROL = (label) => {
  const vis = (el) => {
    if (!el || el.hidden) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  const norm = (t) => (t || '').trim().replace(/\s+/g, ' ');
  for (const s of [...document.querySelectorAll('.dialog-overlay, dialog[open]')].filter(vis)) {
    const el = [...s.querySelectorAll('button')]
      .filter(vis)
      .find((b) => norm(b.getAttribute('aria-label') || b.textContent || b.id).slice(0, 24) === label);
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      el.click();
      return true;
    }
  }
  return false;
};

// the ribbon tabs (data-tab slugs + visible captions)
const TAB_LIST = () =>
  [...document.querySelectorAll('.ribbon-tab')].map((t) => ({
    slug: t.dataset.tab || null,
    label: (t.textContent || '').trim().replace(/\s+/g, ' '),
  }));

// dropdown-menu triggers inside the ACTIVE ribbon page: split-button carets
// (`.rb-menu` wrappers) and aria-haspopup controls whose popover is a
// `.menu-list` of [role=menuitem] rows
const MENU_TRIGGERS = () => {
  const vis = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const page = document.querySelector('.ribbon-page.active');
  if (!page) return [];
  return [...page.querySelectorAll('.menu-trigger, [aria-haspopup="true"]')]
    .filter(vis)
    .map((el) => ({
      id: el.id || null,
      label:
        (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.id || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40) || null,
    }))
    .filter((t) => t.label);
};

// File-menu entries that would leave the editor / block on native UI — they
// are not dialog surfaces; Open… parks on a cancelled file chooser
const SKIP_NAV_ITEMS = [];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
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
  browser.on('disconnected', () => {
    if (!closing) console.log('!!! BROWSER DISCONNECTED');
  });
  // side channels the census must not follow: image inserts open a file
  // chooser, export entries download, Help/plugins may open tabs
  page.on('filechooser', (f) => f.cancel().catch(() => {}));
  page.on('popup', (pp) => pp.close().catch(() => {}));
  page.on('download', (d) => d.cancel().catch(() => {}));

  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const mounted = await page
    .waitForSelector('#toolbar', { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  await page
    .waitForFunction(() => document.querySelectorAll('.ribbon-tab').length > 3, { timeout: 25000 })
    .catch(() => {});
  await sleep(1200); // ribbon + first page paint settle
  const T0 = Date.now();
  const stamp = (label) => console.log(`[t=${((Date.now() - T0) / 1000).toFixed(1)}s] ${label}`);

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const layers = () => ev(PROBE_LAYERS);
  const dialogDepthOf = (ls) => ls.filter((l) => l.kind === 'dialog').length;

  // nth(idx) must match the enumeration (which filters invisible controls),
  // else a hidden button shifts the index and the census clicks the wrong row
  const controlLocator = (sel, idx) => page.locator(`${sel} button:visible, ${sel} select:visible`).nth(idx);

  // real click (the file menu and ribbon popovers are wired on CLICK); fall
  // back to the DOM click only if the locator is not actionable. The vanilla
  // editor wires every ribbon control on el.click() too (interact-wo.cjs
  // proved it), so a short real-click budget + DOM fallback is both fast and
  // faithful.
  const clickControl = async (sel, idx) => {
    try {
      await controlLocator(sel, idx).click({ timeout: 1200 });
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

  // ── settle: dismiss whatever the previous click left open (Escape + the
  //    dialogs' own close buttons + hide the menus/panels). This is
  //    housekeeping, never a measured click — but it MUST actually clear the
  //    stack: a leftover overlay intercepts pointer events and turns every
  //    later real click into a timeout (interact-wo.cjs's closeAll list).
  const settle = async () => {
    await ev(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.querySelectorAll('.dialog-overlay.open').forEach((d) => {
        const b = d.querySelector('button[id$="-close"], [data-dialog-close]');
        if (b) b.click();
        else d.classList.remove('open');
      });
      for (const s of [
        '#ctx-menu',
        '#nav-panel',
        '#chat-panel',
        '#review-panel',
        '#comments-panel',
        '#user-chip-panel',
        '.insert-pop',
      ]) {
        document.querySelectorAll(s).forEach((e) => {
          e.hidden = true;
        });
      }
      // the editor's own closeAllMenus(): every dropdown (file menu, export
      // sublist, ribbon caret menus) is a .menu-list — #file-menu included
      document.querySelectorAll('.menu-list').forEach((m) => {
        m.hidden = true;
      });
      document.querySelectorAll("[aria-haspopup='true']").forEach((t) => t.setAttribute('aria-expanded', 'false'));
    }).catch(() => {});
    await sleep(120);
  };

  const layerLocator = (kind) =>
    kind === 'dialog'
      ? page.locator('.dialog-overlay:visible, dialog[open]:visible, .insert-pop:visible').last().locator('button,[role="menuitem"]')
      : page
          .locator('#file-menu:visible, #ctx-menu:visible, .menu-list:visible, .menu-sublist:visible')
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
        if (DRILL_DENY.test(label)) continue; // outbound side effect, not a depth signal
        await loc.click({ timeout: 1200 });
      } catch {
        break; // layer exhausted / not clickable
      }
      await sleep(400);
      const ls = await layers();
      if (!ls.length) break; // the click dismissed the whole stack
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
    if (c.disabled) {
      // a disabled control is enumerated (the surface ships it) but no click
      // is attempted — it cannot open anything by definition
      await settle();
      return {
        surface,
        control: c.label,
        tag: c.tag,
        id: c.id || null,
        clicked: 'disabled',
        opened: false,
        kind: 'none',
        dialogDepth: 0,
        overlayDepth: 0,
        toggled: false,
        chain: [],
        layer: null,
        note: 'control is disabled',
      };
    }
    const clicked = await clickControl(sel, c.idx);
    await sleep(350);
    const after = await layers();
    const stateAfter = await ev(CONTROL_STATE, [sel, c.idx]);
    const fresh = after.filter((l) => !before.some((b) => b.kind === l.kind && b.label === l.label));
    const opened = fresh.length > 0 && after.length >= before.length;
    const row = {
      surface,
      control: c.label,
      tag: c.tag,
      id: c.id || null,
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

  // ── 1. ribbon — one pass per tab: its visible controls, then its
  //       dropdown-menu triggers (whose popovers the drill walks)
  const rows = [];
  const tabs = await ev(TAB_LIST);
  for (const t of tabs) {
    if (!t.slug) continue;
    await page.click(`.ribbon-tab[data-tab="${t.slug}"]`, { timeout: 4000 }).catch(() => {});
    // the freshly-activated page's buttons settle late (they are 0x0 until
    // the page paints) — wait for the first visible one so no click budget is
    // burned on a not-yet-painted surface
    await page
      .waitForFunction(
        () => !!document.querySelector('.ribbon-page.active') &&
          [...document.querySelectorAll('.ribbon-page.active button')].some(
            (b) => b.offsetParent !== null && b.getBoundingClientRect().width > 4,
          ),
        { timeout: 4000 },
      )
      .catch(() => {});
    await sleep(250);
    // dedupe split-button fragments: an id-less caret repeats the same
    // command many times — one row per (id || label) is the honest census
    const seen = new Set();
    const controls = (await ev(PROBE_CONTROLS, '.ribbon-page.active')).filter((c) => {
      const key = c.id || `${c.tag}:${c.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    for (const c of controls) rows.push(await censusControl(`toolbar:${t.label}`, '.ribbon-page.active', c));
    for (const trig of await ev(MENU_TRIGGERS)) {
      const before = await layers();
      const ok = await ev((id) => {
        const e = document.getElementById(id);
        if (!e) return false;
        e.click();
        return true;
      }, trig.id).catch(() => false);
      await sleep(400);
      const after = await layers();
      const fresh = after.filter((l) => !before.some((b) => b.kind === l.kind && b.label === l.label));
      const opened = ok && fresh.length > 0 && after.length >= before.length;
      const row = {
        surface: `toolbar:${t.label}`,
        control: trig.label,
        tag: 'button',
        id: trig.id || null,
        clicked: ok ? 'real' : 'missing',
        opened,
        kind: opened ? fresh[0].kind : 'none',
        dialogDepth: opened ? dialogDepthOf(after) : 0,
        overlayDepth: opened ? after.length : 0,
        toggled: false,
        chain: [],
        layer: opened
          ? { kind: fresh[0].kind, label: fresh[0].label, w: fresh[0].w, h: fresh[0].h, buttons: fresh[0].buttons.length }
          : null,
        note: ok ? '' : 'trigger missing',
      };
      if (opened) await drill(row, 1);
      rows.push(row);
      await settle();
    }
    stamp(`ribbon ${t.label} (${rows.length} controls so far, ${rows.filter((r) => r.opened).length} opened)`);
  }

  // ── 2. menu bar (File trigger + quick actions + user chip), status bar
  for (const [surface, sel] of [
    ['menu-bar', '#menu-bar'],
    ['user-chip', '#user-chip'],
    ['statusbar', '.statusbar'],
  ]) {
    for (const c of await ev(PROBE_CONTROLS, sel)) {
      rows.push(await censusControl(surface, sel, c));
    }
  }

  stamp(`toolbar + surface census (${rows.length} controls, ${rows.filter((r) => r.opened).length} opened)`);

  // ── 3. File menu — the dialog-bearing surface. Unlike the React editors
  //       there is no re-render side channel: the REAL #btn-file click opens
  //       #file-menu directly, so every entry is exercised on THIS page.
  const fileMenuBefore = await ev(FILE_MENU);
  await settle();
  await page.click('#btn-file', { timeout: 5000 }).catch(() => {});
  await sleep(400);
  const fileMenuAfter = await ev(FILE_MENU);
  const fileMenuOpened = fileMenuAfter.visible === true;

  const ensureFileMenuOpen = async () => {
    const st = await ev(FILE_MENU);
    if (st.visible) return true;
    await page.click('#btn-file', { timeout: 4000 }).catch(() => {});
    await sleep(300);
    return (await ev(FILE_MENU)).visible;
  };

  const fileMenuItems = [...new Set(fileMenuAfter.items.filter((i) => !SKIP_NAV_ITEMS.includes(i)))];
  const dialogs = [];
  for (const item of fileMenuItems) {
    const steps = [];
    const menuOpen = await ensureFileMenuOpen();
    steps.push(`menu-open:${menuOpen ? 'ok' : 'miss'}`);
    const picked = menuOpen ? await ev(PICK_FILE_MENU_ITEM, item).catch(() => null) : null;
    steps.push(`entry-click:${picked || 'miss'}`);
    await sleep(500);
    const ls = await layers();
    const dlg = ls.find((l) => l.kind === 'dialog') || null;
    const menu = ls.find((l) => l.kind === 'menu') || null;
    const surface = await ev(DIALOG_SURFACE_CONTROLS).catch(() => null);
    const entry = {
      item,
      picked,
      steps,
      fileMenuOpen: menuOpen,
      kind: dlg ? 'dialog' : menu ? 'menu' : 'none',
      exercised: !!dlg,
      dialogDepth: dialogDepthOf(ls),
      overlayDepth: ls.length,
      surface: dlg && surface ? { where: 'dialog', ...surface } : menu ? { where: 'menu', label: menu.label } : null,
      drill: [],
      note: '',
    };
    if (!dlg && !menu) {
      entry.note = 'entry opens NO overlay — silent in this build (measured, not assumed)';
    }
    // exercise the dialog: REAL-click its own buttons, re-measure the stack
    if (dlg) {
      const controls = await ev(DIALOG_SURFACE_CONTROLS).catch(() => null);
      for (const label of (controls ? controls.labels : []).slice(0, 3)) {
        if (DRILL_DENY.test(label)) {
          entry.drill.push({ control: label, clicked: 'skipped', dialogDepth: entry.dialogDepth, stillOpen: true, deepened: false });
          continue;
        }
        const before = await layers();
        const clicked = await page
          .locator('.dialog-overlay:visible button, dialog[open]:visible button', { hasText: label })
          .first()
          .click({ timeout: 2500 })
          .then(() => 'real')
          .catch(async () => ((await ev(CLICK_DIALOG_SURFACE_CONTROL, label).catch(() => false)) ? 'dom' : 'miss'));
        await sleep(450);
        const after = await layers();
        const grew = after.length > before.length || dialogDepthOf(after) > dialogDepthOf(before);
        entry.drill.push({
          control: label,
          clicked,
          dialogDepth: dialogDepthOf(after),
          stillOpen: dialogDepthOf(after) > 0,
          deepened: grew,
        });
        entry.dialogDepth = Math.max(entry.dialogDepth, dialogDepthOf(after));
        if (dialogDepthOf(after) === 0) break; // dismissed
      }
      // dismissal: the dialog's close control must clear the overlay
      const closed = await ev(() => {
        const vis = (el) => {
          if (!el || el.hidden) return false;
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') return false;
          const r = el.getBoundingClientRect();
          return r.width > 4 && r.height > 4;
        };
        const d = [...document.querySelectorAll('.dialog-overlay, dialog[open]')].filter(vis)[0];
        if (!d) return 'already-closed';
        const b = d.querySelector('button[id$="-close"], [data-dialog-close], button[aria-label="Close"]');
        if (!b) return 'no-close-control';
        b.click();
        return 'close-clicked';
      }).catch(() => 'error');
      await sleep(400);
      const afterClose = await layers();
      entry.closedByCloseClick =
        closed === 'already-closed' ? true : dialogDepthOf(afterClose) === 0 ? true : `${closed}:still-open`;
    }
    dialogs.push(entry);
    console.log(
      `  ${entry.exercised ? '+' : entry.kind === 'menu' ? '~' : '-'} file-menu/${entry.item}: ${entry.kind}` +
        ` dialogDepth=${entry.dialogDepth}` +
        (entry.surface ? ` surface=${entry.surface.where}:${entry.surface.title || entry.surface.label || entry.surface.id}` : '') +
        (entry.drill.length ? ` drill=[${entry.drill.map((d) => `${d.control}:${d.clicked}${d.deepened ? '+' : ''}`).join(', ')}]` : '') +
        (entry.note ? ` (${entry.note})` : ''),
    );
    await settle();
  }

  stamp(`file-menu dialogs (${dialogs.filter((d) => d.exercised).length}/${fileMenuItems.length} exercised)`);

  // ── summary + artifact ─────────────────────────────────────────────────
  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  const domDialogs = await page.evaluate(() => document.querySelectorAll('.dialog-overlay').length);
  const maxOverlayRows = rows.reduce((m, r) => Math.max(m, r.overlayDepth), 0);
  const dialogsExercised = dialogs.filter((d) => d.exercised).length;
  const maxFileMenuDialogDepth = dialogs.reduce((m, d) => Math.max(m, d.dialogDepth), 0);
  const summary = {
    surfaces: [...new Set(rows.map((r) => r.surface))],
    controls: rows.length,
    opened: rows.filter((r) => r.opened).length,
    toggledOnly: rows.filter((r) => !r.opened && r.toggled).length,
    byKind,
    dialogs: rows.filter((r) => r.kind === 'dialog').length,
    domDialogOverlays: domDialogs,
    maxDialogDepth: Math.max(
      rows.reduce((m, r) => Math.max(m, r.dialogDepth), 0),
      maxFileMenuDialogDepth,
    ),
    maxOverlayDepth: Math.max(maxOverlayRows, dialogs.reduce((m, d) => Math.max(m, d.overlayDepth), 0)),
    deepest: rows
      .filter((r) => r.overlayDepth === maxOverlayRows && maxOverlayRows > 0)
      .map((r) => `${r.surface}/${r.control} -> ${[r.kind, ...r.chain].join(' > ')}`),
    fileMenuItems: fileMenuItems.length,
    fileMenuOpened,
    fileMenuDialogsDeclared: fileMenuItems.filter((i) => i.endsWith('…') || i.endsWith('...')).length,
    fileMenuDialogsExercised: dialogsExercised,
    maxFileMenuDialogDepth,
  };

  const findings = [];
  if (!fileMenuBefore.trigger) {
    findings.push('file-menu-no-trigger: #btn-file is absent — the file menu cannot be opened at all');
  }
  if (fileMenuBefore.trigger && !fileMenuOpened) {
    findings.push(
      `file-menu-unopenable: a REAL #btn-file click left #file-menu ${fileMenuAfter.display} — the whole ` +
        `dialog-bearing surface is unreachable and its dialog depth cannot be censused (trigger-regression ` +
        `class the ledger gate knows as menu-file == 0)`,
    );
  }
  const silentEntries = dialogs.filter((d) => d.kind === 'none');
  if (silentEntries.length) {
    findings.push(
      `file-menu-silent-entries: ${silentEntries.length} entries open NO overlay ` +
        `(${silentEntries.map((d) => d.item).join(', ')}) — New resets the document, Open… parks on a native ` +
        `file chooser (cancelled by the census), Print opens no dialog in headless chromium (measured, not assumed)`,
    );
  }
  const dialogEntries = dialogs.filter((d) => d.item.endsWith('…') || d.item.endsWith('...'));
  const deadEntries = dialogEntries.filter((d) => !d.exercised);
  if (deadEntries.length) {
    findings.push(
      `file-menu-dead-entries: ${deadEntries.length} dialog-declaring entries reach no dialog surface ` +
        `(${deadEntries.map((d) => `${d.item}[${d.note || d.kind}]`).join(', ')})`,
    );
  }
  const noDismiss = dialogs.filter((d) => d.exercised && d.closedByCloseClick !== true);
  if (noDismiss.length) {
    findings.push(
      `file-menu-dialog-no-dismiss: ${noDismiss.map((d) => `${d.item}(${d.closedByCloseClick})`).join(', ')} — ` +
        `the dialog's own close control left a dialog layer up`,
    );
  }
  if (summary.dialogs === 0 && maxFileMenuDialogDepth === 0) {
    findings.push(
      `no-modal-dialogs: dialogDepth is 0 across all ${summary.controls} censused controls and all ` +
        `${dialogsExercised} File-menu dialogs — the word UI exposes no reachable modal overlay`,
    );
  }
  const toggles = rows.filter((r) => !r.opened && r.toggled);
  if (toggles.length) {
    findings.push(
      `toggle-without-overlay: ${toggles.length} controls flip their own active/pressed state but open nothing ` +
        `(${toggles.map((r) => `${r.surface}/${r.control}`).slice(0, 8).join(', ')}${toggles.length > 8 ? '…' : ''})`,
    );
  }
  const undecided = rows.filter((r) => !r.opened && !r.toggled && r.clicked === 'real');
  if (undecided.length) {
    findings.push(
      `${undecided.length}/${rows.length} controls open no overlay and expose no toggle state (direct-action or ` +
        `no-op — not decidable from the DOM; whether the command really mutates the document is fx-wo.cjs's job): ` +
        `${undecided.map((r) => `${r.surface}/${r.control}`).slice(0, 10).join(', ')}${undecided.length > 10 ? '…' : ''}`,
    );
  }

  const checks = [
    {
      check: 'mounted',
      ok: mounted && tabs.length > 0 && summary.controls > 0,
      detail: `#toolbar mounted, ${tabs.length} ribbon tabs, ${summary.controls} controls censused`,
      fail: ['FAIL: word editor never mounted (no #toolbar / no ribbon tabs / no controls) — census is blind'],
    },
    {
      check: 'overlay-opened',
      ok: summary.opened >= 1,
      detail: `${summary.opened} controls opened an overlay (${JSON.stringify(byKind)})`,
      fail: ['FAIL: no control opened any overlay — the click-through/classifier measured nothing'],
    },
    {
      check: 'file-menu-open',
      ok: fileMenuOpened,
      detail: `#file-menu ${fileMenuAfter.display} via real #btn-file click`,
      fail: [
        'FAIL: the File menu did not open (#file-menu never became visible).',
        `      trigger=#btn-file panel=${fileMenuAfter.display}`,
        '      The dialog-bearing surface is invisible to the census.',
      ],
    },
    {
      check: `file-menu-dialogs>=${MIN_DIALOGS}`,
      ok: dialogsExercised >= MIN_DIALOGS,
      detail: `${dialogsExercised}/${fileMenuItems.length} entries opened their .dialog-overlay`,
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
    engine: 'worldoffice-word',
    ui: 'vanilla-documenteditor-wysiwyg', // what /word/ serves today — see header
    capturedAt: new Date().toISOString(),
    url: URL_BASE,
    viewport: VIEWPORT,
    pageErrors: pageerrors,
    mounted,
    toolbarTabs: tabs.map((t) => t.label),
    fileMenu: {
      trigger: fileMenuBefore.trigger,
      panelPresent: fileMenuBefore.present,
      panelDisplay: { before: fileMenuBefore.display, after: fileMenuAfter.display },
      panelVisible: fileMenuAfter.visible,
      opened: fileMenuOpened,
      openTrigger: 'real #btn-file click',
      items: fileMenuAfter.items,
      dialogs,
      dialogsExercised,
      minRequired: MIN_DIALOGS,
    },
    rows,
    summary,
    findings,
  };
  fs.writeFileSync(OUT, JSON.stringify(artifact, null, 1) + '\n');

  // ── report ─────────────────────────────────────────────────────────────
  console.log(
    `census-react-word: mounted=${mounted} tabs=[${artifact.toolbarTabs.join(',')}] ` +
      `controls=${summary.controls} opened=${summary.opened} toggledOnly=${summary.toggledOnly} ` +
      `kinds=${JSON.stringify(byKind)} maxDialogDepth=${summary.maxDialogDepth} ` +
      `maxOverlayDepth=${summary.maxOverlayDepth}`,
  );
  console.log(
    `file-menu: opened=${artifact.fileMenu.opened} items=${artifact.fileMenu.items.length} ` +
      `dialogsExercised=${dialogsExercised}/${fileMenuItems.length} (gate >=${MIN_DIALOGS} exercised) ` +
      `maxDialogDepth=${maxFileMenuDialogDepth}`,
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
