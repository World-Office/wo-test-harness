#!/usr/bin/env node
/**
 * census-wo-acts.cjs — L2 ACTS behavior probe (ledger level 2). v2.
 *
 * For every command surface in the live WO editor — data-cmd buttons per
 * ribbon tab, headline  data-cmd items revealed by dropdowns, and ctx-menu
 * data-ctx actions — perform a REAL user click and record whether the action
 * MUTATES the document DOM (#editor innerHTML changes).
 *
 *   mutated  -> the control acts (L2): it changed the document DOM
 *   dialog   -> the control opened a modal (surface change, no doc mutation)
 *   noop     -> nothing observable changed (honest — stays L1)
 *
 * The doc is seeded with real text; formatting commands re-select all before
 * acting (a collapsed caret makes bold/italic/etc a genuine noop). Two
 * byte-equal settled baselines are required before each click and the
 * post-click snapshot must differ from both (kills async re-sync churn).
 *
 * Env: WO_URL (default http://192.168.42.42:8082/word/) · WO_ACTS_OUT
 *   (default census/census-wo-acts.json)
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const WO_URL = process.env.WO_URL || "http://192.168.42.42:8082/word/";
const OUT = process.env.WO_ACTS_OUT || path.join(__dirname, "census/census-wo-acts.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP_CMDS = new Set(["print", "save", "saveAs", "export", "closeFileMenu", "closeDocument", "share", "reload", "openLocal", "download"]);
// commands that only act on a selection (formatting, styles, clipboard-ish)
const SELECT_CMDS = new Set(["bold", "italic", "underline", "strikeThrough", "fontName", "fontSize", "foreColor", "hiliteColor", "removeFormat", "superscript", "subscript", "smallCaps", "allCaps", "code", "formatBlock", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull", "insertUnorderedList", "insertOrderedList", "outdent", "indent", "lineHeight", "textTransform"]);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = new Map();
  let TABLE_PASS = false;

  const openPage = async (mode) => {
    await page.goto(WO_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("[contenteditable='true']", { timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById("editor") && document.execCommand("selectAll") && document.execCommand("insertText", false, "Probe sentence for the acts census. ".repeat(14) + "End."));
    await page.waitForTimeout(1200);
    if (mode === "table") {
      await page.evaluate(() => {
        const btn = document.getElementById("btn-table");
        if (btn) btn.click();
      });
      await sleep(500);
      await page.evaluate(() => {
        const ed = document.getElementById("editor");
        const td = ed && ed.querySelector("td");
        if (!td) return;
        const sel = window.getSelection(); const r = document.createRange();
        r.selectNodeContents(td); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
        document.execCommand("insertText", false, "cell text");
      });
      await sleep(600);
    }
  };
  const caretEnd = async (inCell) => page.evaluate((c) => {
    const ed = document.getElementById("editor");
    if (!ed) return; ed.focus();
    const target = c ? ed.querySelector("td, th") : ed;
    if (!target) return;
    const sel = window.getSelection(); const r = document.createRange();
    r.selectNodeContents(target); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
  }, inCell);
  const selectAll = () => page.evaluate(() => {
    const ed = document.getElementById("editor");
    if (!ed) return; ed.focus(); document.execCommand("selectAll");
  });
  const closeDialog = async (force) => {
    await page.evaluate(() => {
      const open = document.querySelector(".dialog-overlay.open, .modal.open");
      if (open) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        document.querySelectorAll(".dialog-overlay.open, .modal.open").forEach((d) => d.classList.remove("open"));
      }
    });
    await sleep(200);
  };
  const dialogOpen = () => page.evaluate(() => !!document.querySelector(".dialog-overlay.open, .modal.open"));

  const probe = async (kind, name, needsSelect) => {
    if (needsSelect) await selectAll(); else await caretEnd(TABLE_PASS);
    await closeDialog(); await sleep(220);
    // MutationObserver on #editor: catches even transient mutations that the
    // model's async re-sync reverts within ~150ms (innerHTML diff can't).
    let amb = 0;
    await page.evaluate(() => {
      window.__mcount = 0; window.__msample = "";
      const ed = document.getElementById("editor");
      if (window.__mo) window.__mo.disconnect();
      const mo = new MutationObserver((muts) => {
        window.__mcount += muts.length;
        if (!window.__msample && muts.length) {
          const m = muts[0];
          window.__msample = (m.target.nodeName || "") + (m.target.nodeType === 3 ? ":" + m.target.nodeValue.substring(0, 12) : (m.addedNodes[0] ? ":+" + m.addedNodes[0].nodeName : ""));
        }
      });
      window.__mo = mo;
      mo.observe(ed, { childList: true, subtree: true, characterData: true, attributes: true });
    });
    await sleep(260);
    amb = await page.evaluate(() => window.__mcount);
    await page.evaluate(() => { window.__mcount = 0; window.__msample = ""; });
    const openedBefore = await dialogOpen();
    let err = null;
    try {
      if (kind === "key") {
        await page.keyboard.press(name);
      } else {
        await page.evaluate(({ kind: k, name: n }) => {
          if (k === "ctx") {
            const b = document.querySelector(`#ctx-menu button[data-ctx="${n}"]`);
            if (b) b.click(); else throw new Error("no ctx button");
          } else {
            window.dispatchEvent(new CustomEvent("wo-command", { detail: { command: n, value: "" } }));
          }
        }, { kind, name });
      }
    } catch (e) { err = String(e).slice(0, 80); }
    await sleep(320);
    const count = await page.evaluate(() => window.__mcount);
    const dOpen = (await dialogOpen()) && !openedBefore;
    let mutated = !err && count > amb;
    let confirmed = false;
    if (!mutated && dOpen) {
      const clicked = await page.evaluate(() => {
        const dlg = document.querySelector(".dialog-overlay.open, .modal.open");
        if (!dlg) return false;
        const pri = dlg.querySelector("[class*=primary], #ok, [data-ok], button[class*=ok]")
          || [...dlg.querySelectorAll("button")].find((b) => /(insert|apply|ok|add|save|update)/i.test((b.textContent || "").trim().slice(0, 12)));
        if (!pri) return false;
        pri.click();
        return true;
      });
      confirmed = clicked;
      await sleep(320);
      const c2 = await page.evaluate(() => window.__mcount);
      mutated = c2 > amb;
    }
    const ev = await page.evaluate(() => String(window.__msample || "").slice(0, 50));
    if (mutated) results.set(kind + ":" + name, { mutated: true, dialog: dOpen, confirmed, evidence: (ev || "mutation delta " + (count > amb ? count : 0)) + (amb ? " (ambient " + amb + ")" : "") });
    else if (dOpen) results.set(kind + ":" + name, { mutated: false, dialog: true, confirmed, evidence: err ? "dispatch error then dialog: " + err : (confirmed ? "dialog confirmed with no doc mutation" : "opened modal, no confirm route") });
    else results.set(kind + ":" + name, { mutated: false, dialog: false, evidence: err ? "dispatch error: " + err : "no observable change (mutation delta 0)" });
    if (dOpen && !mutated) await closeDialog(true);
  };

  let sinceReload = 0;
  const maybeReload = async (mode) => { sinceReload++; if (sinceReload >= 20) { sinceReload = 0; await openPage(mode); } };

  // a key that already proved it acts never needs re-probing; everything
  // else is re-probed on the next pass (richer document context)
  const alreadyActs = (key) => { const r = results.get(key); return !!(r && r.mutated); };
  const runCmd = async (cmd, needsSelect) => {
    if (SKIP_CMDS.has(cmd) || alreadyActs("cmd:" + cmd)) return;
    await probe("cmd", cmd, needsSelect);
    await maybeReload(TABLE_PASS ? "table" : "text");
  };

  async function sweep(mode) {
    TABLE_PASS = (mode === "table");
    await openPage(mode);
    sinceReload = 0;

    // -------------------------------------------------- A: per-ribbon-tab buttons
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll(".ribbon-tab[data-tab]")].filter((t) => t.offsetParent !== null).map((t) => t.getAttribute("data-tab")));
    for (const tab of tabs) {
      await page.evaluate((t) => {
        const el = document.querySelector(`.ribbon-tab[data-tab="${t}"]`);
        if (el) el.click();
      }, tab);
      await sleep(350);
      const btns = await page.evaluate(() =>
        [...document.querySelectorAll("button[data-cmd]")].filter((b) => b.offsetParent !== null).map((b) => ({ id: b.id || "", cmd: b.getAttribute("data-cmd") })));
      for (const { id, cmd } of btns) {
        if (SKIP_CMDS.has(cmd) || alreadyActs("cmd:" + cmd)) continue;
        await probe("cmd", cmd, SELECT_CMDS.has(cmd));
        if (id && results.has("cmd:" + cmd)) results.set("btn:" + id, results.get("cmd:" + cmd));
        await maybeReload(mode);
      }
      const keys = await page.evaluate(() =>
        [...document.querySelectorAll("[aria-haspopup='true']")].filter((t) => t.offsetParent !== null).map((t) => t.id).filter(Boolean));
      for (const k of keys) {
        await page.evaluate((i) => { const t = document.getElementById(i); if (t) t.click(); }, k);
        await sleep(280);
        const inner = await page.evaluate(() =>
          [...document.querySelectorAll(".menu-list:not([hidden]) button[data-cmd]")].filter((b) => b.offsetParent !== null).map((b) => ({ id: b.id || "", cmd: b.getAttribute("data-cmd") })));
        await page.evaluate(() => document.querySelectorAll(".menu-list").forEach((m) => { m.hidden = true; }));
        await sleep(120);
        for (const { id, cmd } of inner) {
          if (SKIP_CMDS.has(cmd) || alreadyActs("cmd:" + cmd)) continue;
          await probe("cmd", cmd, SELECT_CMDS.has(cmd));
          if (id && results.has("cmd:" + cmd)) results.set("btn:" + id, results.get("cmd:" + cmd));
          await maybeReload(mode);
        }
      }
    }

    // ------------------------------------------------------------ B: ctx actions
    const ctxItems = await page.evaluate(() => {
      const m = document.getElementById("ctx-menu");
      return m ? [...m.querySelectorAll("button[data-ctx]")].map((b) => b.getAttribute("data-ctx")).filter(Boolean) : [];
    });
    const openCtx = async () => {
      await page.evaluate(() => {
        const ed = document.getElementById("editor");
        const r = ed.getBoundingClientRect();
        ed.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 120, clientY: r.top + 120 }));
      });
      await sleep(260);
    };
    for (const ctx of ctxItems) {
      if (alreadyActs("ctx:" + ctx)) continue;
      await openCtx();
      await probe("ctx", ctx, false);
      await maybeReload(mode);
    }
  }

  await sweep("text");
  await sweep("table");
  // ------------------------------------------------------ C: keyboard sweep
  // Trusted key events (Playwright keyboard.press) — the real user action
  // for every shortcut in the OO shortcut census. Browser-reserved P/W
  // (native print / tab-close) and pure-caret nav series are skipped here
  // because they never mutate the document DOM.
  const toCanon = (c) => {
    const map = { Control: "Ctrl", Meta: "Cmd", Option: "Opt", Alt: "Alt", Shift: "Shift" };
    const t = String(c || "").split("+").map((x) => x.trim()).filter(Boolean);
    const mods = t.slice(0, t.length - 1).map((m) => map[m] || m);
    const key = t[t.length - 1] || "";
    return mods.length ? mods.join("+") + "+" + key : key;
  };
  const toPress = (canon) => {
    const map = { Ctrl: "Control", Cmd: "Meta", Opt: "Alt" };
    const parts = canon.split("+");
    const key = parts.pop();
    // title-case census combos (Ctrl+B) must become the lowercase key
    // (Control+b); a capital letter alone would imply an extra Shift.
    const k = /^[A-Za-z]$/.test(key) ? key.toLowerCase() : key;
    return parts.map((m) => map[m] || m).join("+") + (parts.length ? "+" : "") + k;
  };
  const shortcutRows = JSON.parse(
    fs.readFileSync(process.env.SHORTCUTS_ACTS_IN || path.join(__dirname, "census/census-shortcuts.json"), "utf8")
  );
  const combos = (Array.isArray(shortcutRows) ? shortcutRows : shortcutRows.shortcuts || shortcutRows.rows || [])
    .map((r) => r.combo || r.shortcut || r.type).filter(Boolean);
  const SKIP_KEYS = new Set(["W", "w", "P", "p", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);
  for (const combo of combos) {
    const canon = toCanon(combo);
    const lastKey = canon.split("+").pop();
    if (lastKey === "W" || lastKey === "P" || SKIP_KEYS.has(lastKey)) continue;
    if (alreadyActs("shortcut:" + canon)) continue;
    const press = toPress(canon);
    await probe("key", press, true);
    if (results.has("key:" + press)) results.set("shortcut:" + canon, results.get("key:" + press));
    await maybeReload("text");
  }
  await closeDialog(true);
  await browser.close();
  let mutated = 0, dialog = 0, noop = 0;
  const out = { capturedAt: new Date().toISOString(), engine: "worldoffice", url: WO_URL, results: Object.fromEntries(results) };
  for (const r of Object.values(out.results)) { if (r.mutated) mutated++; else if (r.dialog) dialog++; else noop++; }
  out.totals = { probed: Object.keys(out.results).length, mutated, dialog, noop };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`census-wo-acts v2: probed=${out.totals.probed} mutated=${mutated} dialog=${dialog} noop=${noop}`);
})().catch((e) => { console.error("ACTS PROBE FAIL", String(e).slice(0, 300)); process.exit(1); });
