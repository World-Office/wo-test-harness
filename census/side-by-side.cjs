#!/usr/bin/env node
/* side-by-side.cjs — live OO ↔ WO ribbon parity capture through the public demo
 * compare page (https://world-office.graphwiz.ai/demo/): the SAME .docx opened
 * in the OnlyOffice reference (left frame, lang de, compact header) and in the
 * deployed WO editor (right frame), both at the SAME width — so geometry,
 * labels, group captions and computed styles are comparable like for like.
 *
 * Why a separate capture: census-oo-deep (OO rig) and census-react-deep (live
 * prod) are two boots at two times; the compare page removes that variable and
 * needs no rig. Reuses both censuses' extraction rules, so the output is in
 * layout-diff.py's input shape (OO: tabs[tab].buttons, WO: geometry[tab].ribbon).
 *
 * Usage:
 *   node census/side-by-side.cjs [--width 1600] [--locale de-DE] [--doc Bericht.docx]
 *                                [--out census/side-by-side] [--json census/census]
 *     --width   force BOTH iframes to this width (default: the demo's own 827 px)
 *     --locale  browser locale (the WO ribbon follows navigator.language; OO is
 *               pinned to de by the demo page)      default de-DE
 *     --doc     one of the demo's documents          default Bericht.docx
 *     --oo-timeout / --wo-timeout   ms to wait for each editor's ribbon (several captures in parallel queue on the demo host)
 *     --out     output root (gitignored)          default census/side-by-side
 * Outputs (one self-contained dir per tag, OO and WO from the SAME run):
 *   <out>/<tag>/<tab>-{oo,wo}.png  ribbon strips, same height both sides
 *   <out>/<tag>/full-{oo,wo}.png   whole frames, Home tab
 *   <out>/<tag>/{oo,wo}.json       buttons in layout-diff.py's input shape
 *   <out>/<tag>/{groups,styles}.json
 * Then:    /usr/bin/python3 census/side-by-side-diff.py [--dir <out>/<tag>] [--gate]
 * Exit:    0 ok | 2 the compare page never showed the WO editor
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const W = Number(arg('--width', 0));
const LOCALE = arg('--locale', 'de-DE');
const DOC = arg('--doc', 'Bericht.docx');
const OO_TIMEOUT = Number(arg('--oo-timeout', 150000)); // concurrent OnlyOffice sessions queue on the demo host — raise when capturing several in parallel
const WO_TIMEOUT = Number(arg('--wo-timeout', 60000));  // same for the WO editor's WASM boot
const HERE = __dirname;
const TAG = (W ? `wide${W}` : 'demo827') + '-' + LOCALE;
const OUT = path.join(path.resolve(arg('--out', path.join(HERE, 'side-by-side'))), TAG);
const DEMO = process.env.DEMO_URL || 'https://world-office.graphwiz.ai/demo/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fail loudly WITH the offending code: an embedded helper that is not a plain
// declaration shows up only as a bare SyntaxError inside page.evaluate
// Page-context code goes through template literals: a regex needs `\\s` / `\\d` there (the literal eats one backslash —
// `\s` silently became `/s+/g` once and stripped every "s" from the OO labels)
const ev = (frame, code, arg) => frame.evaluate(code, arg).catch((e) => { if (/SyntaxError|ReferenceError|TypeError/.test(e.message)) console.error(`side-by-side: evaluate failed (${e.message.split('\n')[0]}) in:\n${code}`); throw e; });

// frames are looked up by URL on every poll: the demo (re)creates its iframes,
// so an element's contentFrame() handle can go stale mid-boot
async function frameReady(page, urlRe, selector, timeout) {
  for (const t0 = Date.now(); Date.now() - t0 < timeout; await sleep(1000)) {
    for (const f of page.frames().filter((x) => urlRe.test(x.url()))) { // OO boots several frames (editor, sdk, …): take the one that exposes the selector
      try { await f.waitForSelector(selector, { timeout: 5000 }); return f; } catch { /* next candidate */ }
    }
  }
  throw new Error(`no frame matching ${urlRe} exposing ${selector} within ${timeout / 1000}s`);
}

// OO ribbon tab (data-tab) → the labels the WO editor uses for it (de + en).
// OO's `ai` tab carries a GUID as data-tab, so tabs are matched by label.
const TABS = [
  ['file', ['Datei', 'File']],
  ['home', ['Startseite', 'Start', 'Home']],
  ['ins', ['Einfügen', 'Insert']],
  ['draw', ['Zeichnen', 'Draw']],
  ['layout', ['Layout']],
  ['links', ['Verweise', 'Referenzen', 'References']],
  ['review', ['Zusammenarbeit', 'Colaboration', 'Collaboration']],
  ['protect', ['Schutz', 'Protection']],
  ['view', ['Ansicht', 'View']],
  ['plugins', ['Plugins']],
  ['ai', ['AI']],
  ['charttab', ['Diagrammdesign', 'Chart Design']],
];
const OO_LABEL = { Datei: 'file', Startseite: 'home', Einfügen: 'ins', Zeichnen: 'draw', Layout: 'layout', Verweise: 'links', Zusammenarbeit: 'review', Schutz: 'protect', Ansicht: 'view', Plugins: 'plugins', AI: 'ai', Diagrammdesign: 'charttab' };

// Fluent renders a tab's text twice ("EinfügenEinfügen") — same rule as census-react-deep.cjs.
// Helpers below are function DECLARATIONS on purpose: their .toString() is embedded into page.evaluate.
function dedupeTabText(t) { t = t.trim(); return t.length >= 2 && t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2) ? t.slice(0, t.length / 2) : t; }

const BOX = `const box = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: W ? W * 2 + 300 : 1900, height: 1150 }, locale: LOCALE });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.goto(DEMO, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('.pick .file', { hasText: DOC }).first().click();
  const oo = await frameReady(page, /world-office-demo\.graphwiz\.ai\/.*documenteditor/, '#toolbar .tabs [data-tab="home"]', OO_TIMEOUT);
  // the page uploads the .docx to the WO backend FIRST and only then sets frame.src;
  // onload unhides it — so wait for the frame, never for a fixed sleep
  const shown = await page.waitForFunction(() => { const f = document.querySelector('#wo-frame'); return f && f.style.display === 'block'; }, null, { timeout: 180000 }).then(() => true).catch(() => false);
  if (!shown) { console.error(`side-by-side: the compare page never showed the WO editor — #wo-load says: ${(await page.textContent('#wo-load').catch(() => '?')) || '(empty)'}`); await browser.close(); process.exit(2); }
  const wo = await frameReady(page, /editor\.cloud\.graphwiz\.ai/, '[role=tab]', WO_TIMEOUT);
  await sleep(5000); // wasm boot, document conversion, ribbon settle
  if (W) { // the demo fixes both frames at 827 px; widen BOTH equally for a full-ribbon read
    await page.addStyleTag({ content: `#wo-frame, iframe[name=frameEditor] { width:${W}px !important; height:1000px !important; }` });
    await sleep(4000);
  }
  const ooEl = await page.$('iframe[name=frameEditor]'), woEl = await page.$('#wo-frame');
  const ooBox = await ooEl.boundingBox(), woBox = await woEl.boundingBox();
  console.log(`side-by-side [${TAG}] doc=${DOC} frames OO ${Math.round(ooBox.width)}x${Math.round(ooBox.height)} WO ${Math.round(woBox.width)}x${Math.round(woBox.height)} (locale ${LOCALE})`);

  // ── tab bars ──
  const ooTabs = await ev(oo, () => [...document.querySelectorAll('#toolbar .tabs [data-tab]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return { key: e.dataset.tab, label: (e.title || e.innerText || '').trim(), x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const woTabs = await ev(wo, `(() => { ${dedupeTabText.toString()}
    return [...document.querySelectorAll('[role=tab]')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { label: dedupeTabText(e.textContent || ''), x: r.x, y: r.y, w: r.width, h: r.height }; }); })()`);
  const woCaptured = await ev(wo, `(() => { ${dedupeTabText.toString()} ${BOX}
    const cs = (e) => { const s = getComputedStyle(e); return { font: s.fontFamily.split(',')[0].replace(/["']/g, ''), size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor, h: Math.round(e.getBoundingClientRect().height) }; };
    const tabs = [...document.querySelectorAll('[role=tab]')].filter((e) => e.offsetParent);
    const act = tabs.find((e) => e.getAttribute('aria-selected') === 'true') || tabs[1];
    const tabbar = act.parentElement;
    const bar = tabbar.getBoundingClientRect();
    const btn = [...document.querySelectorAll('button, [role=menuitem], select')].find((e) => e.offsetParent && e.getBoundingClientRect().y >= bar.bottom - 1 && e.getBoundingClientRect().y < bar.bottom + 150);
    const under = getComputedStyle(act);
    return { tabs: tabs.map((e) => ({ label: dedupeTabText(e.textContent || ''), ...box(e) })), style: { tab: cs(act), tabInactive: cs(tabs.find((e) => e !== act) || tabs[0]), tabbar: cs(tabbar), toolbarBg: getComputedStyle(tabbar.parentElement).backgroundColor, tabbarBg: under.backgroundColor, button: btn ? { ...cs(btn), uppercase: getComputedStyle(btn).textTransform } : null, activeTab: { borderBottom: under.borderBottom, borderTop: under.borderTop, background: under.backgroundColor } } }; })()`);
  const ooStyle = await ev(oo, `(() => { ${BOX}
    const cs = (e) => { const s = getComputedStyle(e); return { font: s.fontFamily.split(',')[0].replace(/["']/g, ''), size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor, h: Math.round(e.getBoundingClientRect().height) }; };
    const tabs = [...document.querySelectorAll('#toolbar .tabs [data-tab]')].filter((e) => e.getBoundingClientRect().width > 0);
    const act = tabs.find((e) => e.getAttribute('aria-selected') === 'true' || /active|selected/.test(e.className)) || tabs[1];
    const tabbar = act.parentElement;
    const panel = document.querySelector('#toolbar .panel.active');
    const btn = panel && panel.querySelector('button, [data-title]');
    const under = getComputedStyle(act);
    return { style: { tab: cs(act), tabInactive: cs(tabs.find((e) => e !== act) || tabs[0]), tabbar: cs(tabbar), toolbarBg: getComputedStyle(document.querySelector('#toolbar')).backgroundColor, tabbarBg: getComputedStyle(tabbar).backgroundColor, panelBg: panel ? getComputedStyle(panel).backgroundColor : null, button: btn ? { ...cs(btn), uppercase: getComputedStyle(btn).textTransform } : null, activeTab: { borderBottom: under.borderBottom, borderTop: under.borderTop, background: under.backgroundColor } } }; })()`);
  fs.writeFileSync(path.join(OUT, 'styles.json'), JSON.stringify({ tag: TAG, capturedAt: new Date().toISOString(), oo: ooStyle.style, wo: woCaptured.style }, null, 1));
  console.log('OO tabs:', ooTabs.map((t) => t.label).join(' | '));
  console.log('WO tabs:', woTabs.map((t) => `${t.label}(${Math.round(t.w)})`).join(' | '));

  // ── per tab: click both, extract, screenshot ──
  const census = { oo: { engine: 'onlyoffice-demo', doc: DOC, locale: LOCALE, capturedAt: new Date().toISOString(), viewport: { w: Math.round(ooBox.width), h: Math.round(ooBox.height) }, tabbar: ooTabs, tabs: {} },
                   wo: { engine: 'wo-editor', doc: DOC, locale: LOCALE, capturedAt: new Date().toISOString(), viewport: { width: Math.round(woBox.width), height: Math.round(woBox.height) }, tabbar: woTabs, tabs: woTabs.map((t) => t.label), geometry: {} } };
  const groups = {};
  for (const [key, labels] of TABS) {
    const ooTab = key === 'ai' ? ooTabs.find((t) => OO_LABEL[t.label] === 'ai') : ooTabs.find((t) => t.key === key);
    if (!ooTab) { console.log(`- OO tab ${key}: hidden in this document — skipped`); continue; }
    const woTab = woTabs.find((t) => labels.includes(t.label));
    // a REAL click on both sides: Fluent tabs ignore element.click(), and OO's tabs lose a DOM click right after boot
    // (measured); OO marks nothing on the tab element, so wait for the panel itself to change
    const sig = () => oo.evaluate(() => { const p = document.querySelector('#toolbar .panel.active'); return p ? `${Math.round(p.getBoundingClientRect().width)}|${p.children.length}|${p.innerHTML.length}` : ''; });
    const sig0 = await sig();
    const ooTabSel = `#toolbar .tabs [data-tab="${ooTab.key}"]`;
    try { await oo.locator(ooTabSel).click({ timeout: 8000 }); }
    catch { await oo.locator(ooTabSel).first().dispatchEvent('click'); } // the tab bar can be unactionable right after the file menu closes
    if (woTab) await wo.locator('[role=tab]:visible').nth(woTabs.indexOf(woTab)).click();
    for (let i = 0; i < 40 && ooTab.key !== 'file' && (await sig()) === sig0; i++) await sleep(250);
    if (ooTab.key !== 'file' && (await sig()) === sig0) throw new Error(`OO tab ${ooTab.key} did not switch (panel unchanged)`);
    await sleep(600);
    const ooData = await ev(oo, `(() => { ${BOX}
      const panel = document.querySelector('#toolbar .panel.active') || document.querySelector('#toolbar');
      const buttons = [], hidden = new Set(); // hidden = collapsed behind "Mehr" (0x0): still part of OO's ribbon, so coverage counts them
      const pr = panel.getBoundingClientRect();
      panel.querySelectorAll('button, input, [data-title], [title]').forEach((b) => {
        const r = b.getBoundingClientRect();
        // OO clips the panel (overflow hidden): controls beyond the width keep a non-zero rect but no text — not visible
        const visible = r.width > 5 && r.height > 5 && r.right > pr.left + 1 && r.left < pr.right - 1 && r.bottom > pr.top && r.top < pr.bottom;
        // OO hides button captions below a width threshold (icon-only): innerText is then empty, textContent still has them
        // (innerText can be whitespace-only for unrendered captions — truthy, so normalise each source and take the first non-empty)
        const txt = (v) => (v || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
        const label = [b.getAttribute('data-title'), b.getAttribute('title'), b.getAttribute('aria-label'), b.innerText, b.textContent].map(txt).find(Boolean) || '';
        if (!visible || !label || /^\\d+$/.test(label)) { if (label && !/^\\d+$/.test(label)) hidden.add(label); return; }
        buttons.push({ id: b.id, icon: (b.querySelector('[class*="icon"]')?.className || '').toString().match(/btn-[^\\s"]+/)?.[0] || '', label, enabled: !/disabled|checked-off/.test(b.className) && !b.disabled, ...box(b) });
      });
      // OO's demo toolbar is two 24px rows with no caption row (verified: .group has no title child/attr),
      // so a group is an extent only
      const groups = [...panel.querySelectorAll(':scope > .group, :scope > .more-box > .group')].filter((g) => g.getBoundingClientRect().width > 4)
        .map((g) => ({ cls: String(g.className).trim().slice(0, 30), ...box(g) }));
      return { buttons, hiddenButtons: [...hidden].filter(Boolean), groups, overflow: !!panel.querySelector('.more-box'), toolbar: box(document.querySelector('#toolbar')), panel: box(panel) }; })()`);
    let woData = { buttons: [], groups: [], panel: null, tabBottom: 0, ribbonBottom: 0 };
    if (woTab) woData = await ev(wo, `(() => { ${BOX}
      const tabs = [...document.querySelectorAll('[role=tab]')].filter((e) => e.offsetParent);
      const tabBottom = Math.max(...tabs.map((e) => e.getBoundingClientRect().bottom));
      // deployed ribbon DOM (bundle): section.ribbon-page[data-tab] > div(group: controls + trailing span caption)
      const section = document.querySelector('section.ribbon-page.active');
      const pb = section ? section.getBoundingClientRect() : { top: tabBottom, bottom: tabBottom, left: 0, right: 0 };
      const btns = [...document.querySelectorAll('button, [role=menuitem], select, input[type=checkbox][aria-label]')].filter((e) => e.offsetParent)
        .map((e) => ({ label: (e.getAttribute('aria-label') || e.title || e.textContent || '').trim().slice(0, 60), disabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true', kind: e.tagName === 'SELECT' ? 'select' : 'button', ...box(e) }))
        .filter((b) => b.label && b.y >= pb.top - 1 && b.y < pb.bottom && b.x >= pb.left - 1 && b.x < pb.right && !/^(Back|Save|Download As|Print|Protect|Info|Help|Suggest a Feature)$/i.test(b.label));
      const groups = section ? [...section.children].filter((g) => g.getBoundingClientRect().width > 4).map((g) => { const spans = [...g.children].filter((c) => c.tagName === 'SPAN'); return { caption: (spans[spans.length - 1]?.textContent || '').trim().slice(0, 30), ...box(g) }; }) : [];
      const panel = section ? box(section) : null;
      return { buttons: btns, groups, panel, tabBottom, ribbonBottom: panel ? panel.y + panel.h : tabBottom }; })()`);
    groups[key] = { oo: { groups: ooData.groups, overflow: ooData.overflow, toolbar: ooData.toolbar, panel: ooData.panel }, wo: { groups: woData.groups, panel: woData.panel, tabBottom: woData.tabBottom } };
    if (key !== 'file') { // the File tab is a backstage/menu, not a ribbon — screenshot only
      census.oo.tabs[key] = { label: ooTab.label, buttons: ooData.buttons, hiddenButtons: ooData.hiddenButtons };
      census.wo.geometry[key] = { label: woTab?.label || null, ribbon: woData.buttons.map(({ label, x, y, w, h }) => ({ label, x, y, w, h })) };
    }
    const h = key === 'file' ? Math.round(ooBox.height) : Math.max(ooData.toolbar.h, Math.round(woData.ribbonBottom)) + 8; // same strip height for both
    await page.screenshot({ path: path.join(OUT, `${key}-oo.png`), clip: { x: ooBox.x, y: ooBox.y, width: ooBox.width, height: h } });
    await page.screenshot({ path: path.join(OUT, `${key}-wo.png`), clip: { x: woBox.x, y: woBox.y, width: woBox.width, height: h } });
    console.log(`${key.padEnd(8)} OO "${ooTab.label}" ${String(ooData.buttons.length).padStart(3)} btn ${String(ooData.groups.length).padStart(2)} grp${ooData.overflow ? ' +Mehr' : '     '} (toolbar ${Math.round(ooData.toolbar.h)}px) | WO "${woTab?.label || '— NO TAB —'}" ${String(woData.buttons.length).padStart(3)} btn ${String(woData.groups.length).padStart(2)} grp (ribbon bottom ${Math.round(woData.ribbonBottom)}px)`);
  }
  // back to Home for the full-frame shots (document surface as the demo shows it)
  await oo.locator('#toolbar .tabs [data-tab="home"]').click();
  await wo.locator('[role=tab]:visible').nth(woTabs.findIndex((t) => /start|home/i.test(t.label))).click();
  await sleep(1500);
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `full-oo.png`), clip: ooBox });
  await page.screenshot({ path: path.join(OUT, `full-wo.png`), clip: woBox });
  fs.writeFileSync(path.join(OUT, 'oo.json'), JSON.stringify(census.oo));
  fs.writeFileSync(path.join(OUT, 'wo.json'), JSON.stringify(census.wo));
  fs.writeFileSync(path.join(OUT, 'groups.json'), JSON.stringify({ tag: TAG, groups }, null, 1));
  console.log(`pageerrors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 3).join(' ; ') : ''}`);
  console.log(`wrote ${OUT}/{<tab>-oo,wo}.png, full-*.png, oo/wo/groups/styles.json} — next: /usr/bin/python3 census/side-by-side-diff.py --dir ${OUT}`);
  await browser.close();
})().catch((e) => { console.error('side-by-side: crash', String(e.stack || e).split('\n').slice(0, 3).join(' | ')); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('side-by-side: unhandled', String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); process.exit(1); });
