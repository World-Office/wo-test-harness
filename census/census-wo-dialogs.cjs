#!/usr/bin/env node
/**
 * census-wo-dialogs.cjs — mirror of census-oo-dialogs.cjs for the WorldOffice
 * word editor. Captures the WO dialog layer with the SAME structure schema as
 * the OO dialog census so ledger/build.py can join them:
 *
 *   id        WO dialog element id
 *   title     <header>/<h1/h2> or aria-label / [data-title] text
 *   openedBy  how the census opened it (command or direct openDlg)
 *   fields    every labeled control: label + tag + type + options
 *   buttons   footer / action buttons present
 *   rect      size (so we can compare window geometry)
 *
 * The WO editor exposes dialogs via its `DIALOG_IDS` registry (editor.js)
 * and an `openDlg(id)`/`openOverlayDialog(id)` helper, plus per-dialog
 * openers. This census walks every entry so the dialog layer is measurable —
 * today the ledger counts 0 WO dialogs because none were ever censused.
 *
 * Strategy: each dialog is opened the way a user opens it (best-effort via
 * its data-cmd route by emitting an internal command), then captured and
 * closed. Dialogs without a route are opened by directly toggling the dialog
 * element's `.open` class via evaluate (same visual result).
 *
 * Env:
 *   WO_URL  (default http://192.168.42.42:8082/word/ — prod; read-only probing)
 *   WO_DLG_OUT (default census/census-wo-dialogs.json)
 *
 * Out schema (matches census-oo-dialogs.json):
 *   { capturedAt, engine, dialogs: [ {id,title,openedBy,tabs:[],fields:[],buttons:[],rect} ] }
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const WO_URL = process.env.WO_URL || "http://192.168.42.42:8082/word/";
const OUT = process.env.WO_DLG_OUT || path.join(__dirname, "census/census-wo-dialogs.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every dialog in WO's DIALOG_IDS registry. `open` is how we open it:
//   - "cmd:<name>"  -> call window dispatch of the internal command
//   - "dlg:<id>"    -> element.getAttribute openDlg (class .open)
//   - "get:<id>"    -> querySelector('#<id>').classList.add('open')
//   - "js:<fn>"     -> run a snippet that calls the named opener if global
// `requiresDoc`: some dialogs (comment, crossref, mailmerge, trackchanges,
//   pagenumber) need selection/content — they still open, just with fewer
//   fields; we record what's present.
const DIALOGS = [
  // (id, open)
  ["find-dialog", "cmd:find"],
  ["link-dialog", "cmd:insertLink"],
  ["symbol-dialog", "cmd:insertSymbol"],
  ["table-ops-dialog", "cmd:insertTable"],
  ["version-history-dialog", "cmd:versionHistory"],
  ["ai-review-dialog", "cmd:aiReview"],
  ["ai-propose-dialog", "cmd:aiPropose"],
  ["page-setup-dialog", "cmd:pageSetup"],
  ["borders-dialog", "cmd:openBorders"],
  ["protect-dialog", "cmd:protect"],
  ["photo-editor-dialog", "cmd:photoEditor"],
  ["notes-dialog", "cmd:insertFootnote"],
  ["pagenumber-dialog", "cmd:insertPageNumber"],
  ["headerfooter-dialog", "cmd:insertHeader"],
  ["trackchanges-dialog", "cmd:trackChanges"],
  ["dropcap-dialog", "cmd:toggleDropcap"],
  ["linenumbers-dialog", "cmd:toggleLineNumbers"],
  ["hyphenation-dialog", "cmd:toggleHyphenation"],
  ["watermark-dialog", "cmd:toggleWatermark"],
  ["pagecolor-dialog", "cmd:pageColor"],
  ["colors-dialog", "cmd:colors"],
  ["addtext-dialog", "cmd:insertTextart"],
  ["updatetoc-dialog", "cmd:updateToc"],
  ["displaymode-dialog", "cmd:displayMode"],
  ["bookmark-dialog", "cmd:bookmark"],
  ["cc-dialog", "cmd:insertContentControl"],
  ["chart-dialog", "cmd:insertChart"],
  ["columns-dialog", "cmd:columns"],
  ["comment-dialog", "cmd:insertComment"],
  ["crossref-dialog", "cmd:openCrossref"],
  ["equation-dialog", "cmd:insertEquation"],
  ["field-dialog", "cmd:insertField"],
  ["help-dialog", "cmd:help"],
  ["info-dialog", "cmd:info"],
  ["mailmerge-dialog", "cmd:mailMerge"],
  ["object-dialog", "cmd:insertObject"],
  ["plugins-dialog", "cmd:plugins"],
  ["settings-dialog", "cmd:settings"],
  ["smartart-dialog", "cmd:insertSmartart"],
  ["suggest-dialog", "cmd:suggest"],
  ["toc-dialog", "cmd:toc"],
  ["image-alt-dialog", "cmd:imageAlt"],
  // backstage is an overlay, captured by census-wo-deep; skip here.
];

// known emitter: dispatch a CommandEvent that the editor's routeMap handles.
// editor.js listens for 'wo:command' (or similar) with detail {command}.
async function emitCommand(page, cmd) {
  return await page.evaluate((c) => {
    // The WO editor routes ALL commands through the 'wo-command' CustomEvent
    // bus: window.addEventListener('wo-command', ev => runCommand(ev.detail.command, ...)).
    window.dispatchEvent(new CustomEvent("wo-command", { detail: { command: c, value: "" } }));
    // also click a matching toolbar button if one is visible and mapped
    const btn = [...document.querySelectorAll(`[data-cmd="${c}"]`)].find((b) => b.offsetParent !== null);
    if (btn) btn.click();
    return !!btn;
  }, cmd);
}

// If command didn't open it, force-open the dialog id (structural census —
// we're measuring the surface, not proving the opener).
async function forceOpen(page, id) {
  return await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return "missing";
    el.classList.add("open");
    return "forced";
  }, id);
}

async function extract(page, id, openedBy) {
  return await page.evaluate(({ id, openedBy }) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const visible = (getComputedStyle(el).display || "") !== "none";
    const titleEl =
      el.querySelector("[id$='-title']") ||
      el.querySelector("h1, h2, h3, [class*=title], [class*=caption], header");
    const title =
      (titleEl && (titleEl.getAttribute("data-i18n") ? String(titleEl.getAttribute("data-i18n")) : (titleEl.textContent || "").trim())) ||
      el.getAttribute("aria-label") ||
      "";
    const fields = [];
    for (const lab of el.querySelectorAll("label, .dialog-field > label, [class*=label], [class*=field] > span, th")) {
      const text = (lab.textContent || "").trim();
      if (!text) continue;
      const idFor = lab.getAttribute("for");
      const ctrl = idFor ? el.querySelector("#" + CSS.escape(idFor)) : lab.closest(".field")?.querySelector("input,select,textarea,button,[role=checkbox],[role=combobox]");
      const tag = ctrl ? ctrl.tagName.toLowerCase() : "text";
      const type = ctrl ? (ctrl.getAttribute("type") || (ctrl.tagName === "SELECT" ? "select" : "text")) : "text";
      const opts = ctrl && ctrl.nodeName === "SELECT"
        ? [...ctrl.querySelectorAll("option")].map((o) => (o.textContent || "").trim()).slice(0, 30)
        : [];
      fields.push({ label: text, tag, type, options: opts });
    }
    // buttons: visible action buttons inside the dialog
    const buttons = [...el.querySelectorAll("button, .btn, [role=button], a[class*=btn]")]
      .filter((b) => b.offsetParent !== null)
      .map((b) => (b.textContent || "").trim() || b.getAttribute("aria-label") || b.id)
      .filter(Boolean)
      .slice(0, 20);
    return {
      id,
      openedBy,
      visible,
      title,
      fields,
      buttons,
      rect: { w: el.offsetWidth, h: el.offsetHeight },
    };
  }, { id, openedBy });
}

async function closeAll(page) {
  return await page.evaluate(() => {
    // best-effort close: remove .open from every registered dialog + press Esc via event
    document.querySelectorAll('[id$="-dialog"], [class*=dialog]').forEach((el) => el.classList.remove("open"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (e) => process.stderr.write("pageerror: " + e.message.slice(0, 120) + "\n"));
  await page.goto(WO_URL, { waitUntil: "domcontentloaded", timeout: 40000 });
  await sleep(5000); // let editor boot

  const dialogs = [];
  for (const [id, open] of DIALOGS) {
    await closeAll(page);
    await sleep(150);
    let openedBy = open;
    if (open.startsWith("cmd:")) {
      const cmd = open.slice(4);
      await emitCommand(page, cmd);
      await sleep(500);
      // if not visible, force-open (structural census)
      const vis = await page.evaluate((id) => { const e = document.getElementById(id); return e && e.offsetParent !== null; }, id);
      if (!vis) {
        const how = await forceOpen(page, id);
        openedBy = `forced:${how} (cmd ${cmd})`;
        await sleep(200);
      }
    } else {
      await forceOpen(page, id);
      await sleep(200);
    }
    const snap = await extract(page, id, openedBy);
    if (snap) dialogs.push(snap);
    else process.stderr.write(`(no element for dialog id '${id}')\n`);
  }

  await browser.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ capturedAt: new Date().toISOString(), engine: "wo-docserver", dialogs }, null, 2));
  const withFields = dialogs.filter((d) => d.fields.length);
  const withTitle = dialogs.filter((d) => d.title);
  console.log(`census-wo-dialogs: ${dialogs.length}/${DIALOGS.length} dialog elements found`);
  console.log(`  with title: ${withTitle.length} · with labeled fields: ${withFields.length}`);
  console.log(`  wrote ${OUT}`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
