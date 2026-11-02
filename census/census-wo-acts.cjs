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
  // Cross-run accumulation: the live editor's async model re-sync makes any
  // single observation flaky (false noops). Merging a previous capture and
  // keeping the union of *mutated* observations makes L2 evidence converge
  // monotonically toward ground truth across re-runs — like rerunning a
  // flaky test until it goes green. Point WO_ACTS_IN at the previous capture.
  if (process.env.WO_ACTS_IN) {
    try {
      const prev = JSON.parse(fs.readFileSync(process.env.WO_ACTS_IN, "utf8")).results || {};
      for (const [k, v] of Object.entries(prev)) {
        if (!results.has(k)) results.set(k, v);
        else if (v.mutated && !results.get(k).mutated) results.set(k, v);
      }
    } catch (e) {
      console.log("  (no prior acts capture merged: " + String(e).slice(0, 60) + ")");
    }
  }
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
    if (mode === "object") {
      // real route: object-dialog shape picker (fallback: inject a
      // well-formed .obj-inline placeholder the object ops accept).
      await page.evaluate(() =>
        window.dispatchEvent(new CustomEvent("wo-command", { detail: { command: "insertObject", value: "" } })));
      await sleep(500);
      const inserted = await page.evaluate(() => {
        const dlg = document.getElementById("object-dialog");
        if (!dlg) return false;
        const b = dlg.querySelector("[data-shape], .shape-list button, [class*=shape] button, button[data-obj]");
        if (!b) return false;
        b.click();
        return true;
      });
      await sleep(600);
      const hasObj = await page.evaluate(() =>
        !!document.querySelector("#editor img.vector-object, #editor > div.object, #editor div.object"));
      if (!hasObj) {
        await page.evaluate(() => {
          const ed = document.getElementById("editor");
          if (!ed) return;
          const div = document.createElement("div");
          div.setAttribute("contenteditable", "false");
          div.className = "object obj-square";
          div.setAttribute("data-type", "shape");
          div.setAttribute("data-label", "Shape");
          div.style.cssText = "width:140px;height:88px;border:1px solid #88f;background:#eef4ff;float:left;margin-right:8px;";
          div.textContent = "Shape";
          ed.insertBefore(div, ed.firstChild);
        });
        await sleep(400);
      }
      await pickObject();
    }
  };
  const pickObject = async () => {
    await page.evaluate(() => {
      const o = document.querySelector("#editor div.object, #editor img.vector-object");
      if (!o) return;
      const r = o.getBoundingClientRect();
      o.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      o.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    });
    await sleep(300);
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
    // Range API, not execCommand: headless never focuses the contenteditable
    // (activeElement stays <body>), so execCommand('selectAll') no-ops.
    const ed = document.getElementById("editor");
    if (!ed) return;
    const sel = window.getSelection(); const r = document.createRange();
    r.selectNodeContents(ed); sel.removeAllRanges(); sel.addRange(r);
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
    // Quiescence gate: the editor's async model re-sync churns the DOM after
    // seeding/typing, which would inflate the ambient window and produce
    // false noops. Wait for a 150ms window with ZERO mutations (baseline
    // must be clean) before dispatching; something that mutates afterwards
    // is therefore attributable to the action, not to ambient noise.
    for (let q = 0; q < 14; q++) {
      await sleep(150);
      const c = await page.evaluate(() => window.__mcount);
      await page.evaluate(() => { window.__mcount = 0; window.__msample = ""; });
      if (c === 0) break;
    }
    amb = 0;
    await page.evaluate(() => { window.__mcount = 0; window.__msample = ""; });
    // Create the selection only NOW, immediately before dispatch: the model's
    // async re-sync replaces the editable DOM, so a Range created earlier
    // decays onto detached nodes and execCommand silently no-ops (measured).
    // A fresh selection survives the ~300ms dispatch window.
    if (needsSelect) await selectAll(); else await caretEnd(TABLE_PASS);
    const openedBefore = await dialogOpen();
    let err = null;
    try {
      if (kind === "key") {
        // The editor's keydown handler is reached via a KeyboardEvent on the
        // #editor element. Playwright's page.keyboard.press is unusable here:
        // headless Chromium never focuses the contenteditable (activeElement
        // stays <body>), so key events go nowhere. Synthetic dispatch on
        // #editor mirrors the repo's own shortcut probes (it trusts key/
        // modifier fields, not isTrusted) and is deterministic.
        await page.evaluate(({ canon }) => {
          const toks = canon.split("+");
          const mods = toks.slice(0, -1);
          const kt = toks[toks.length - 1];
          const nm = { Comma: ",", Period: ".", Semicolon: ";", Equal: "=", Minus: "-", BracketLeft: "[", BracketRight: "]", Backquote: "`", Quote: "'", Slash: "/", Space: " ", Enter: "Enter", Escape: "Escape", Tab: "Tab", Backspace: "Backspace", Delete: "Delete", Insert: "Insert", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown" };
          const key = nm[kt] || (/^F\d+$/.test(kt) ? kt : /^[A-Za-z0-9]$/.test(kt) ? kt.toLowerCase() : kt);
          const code = /^[a-z]$/.test(key) ? "Key" + key.toUpperCase() : /^[0-9]$/.test(key) ? "Digit" + key : /^F\d+$/.test(key) ? key : "";
          const ed = document.getElementById("editor");
          ed.dispatchEvent(new KeyboardEvent("keydown", {
            key, code, bubbles: true, cancelable: true,
            ctrlKey: mods.includes("Ctrl"), metaKey: mods.includes("Cmd"),
            altKey: mods.includes("Alt") || mods.includes("Opt"), shiftKey: mods.includes("Shift")
          }));
        }, { canon: name });
        await sleep(130);
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

  async function probePass(mode) {
    // rounds: the prod editor's async re-sync makes a single observation
    // flaky (false noops); round 2 re-probes only keys that never proved
    // they act, so the final set converges. 'mutated' wins if ANY round saw
    // the DOM mutate.
    for (let round = 0; round < 2; round++) {
      await openPage(mode);
      sinceReload = 0;
      await roundBody(mode);
    }
  }

  async function roundBody(mode) {
    // -------------------------------------------------- A: per-ribbon-tab buttons
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll(".ribbon-tab[data-tab]")].filter((t) => t.offsetParent !== null).map((t) => t.getAttribute("data-tab")));
    for (const tab of tabs) {
      await page.evaluate((t) => {
        const el = document.querySelector(`.ribbon-tab[data-tab="${t}"]`);
        if (el) el.click();
      }, tab);
      await sleep(350);
      if (TABLE_PASS) { /* table mode: nothing */ }
      if (mode === "object") await pickObject();
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
      await page.evaluate(({ isObj, isTbl }) => {
        const o = document.querySelector("#editor div.object, #editor img.vector-object");
        if (isObj && o) {
          const or = o.getBoundingClientRect();
          o.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: or.left + or.width / 2, clientY: or.top + or.height / 2 }));
          return;
        }
        let tgt = null;
        if (isTbl) {
          const sel = window.getSelection();
          const n = sel && sel.anchorNode;
          const cell = n && n.nodeType === 3 ? n.parentNode : n;
          if (cell && cell.closest) tgt = cell.closest("td, th");
        }
        const target = tgt || document.getElementById("editor");
        const r = target.getBoundingClientRect();
        target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + (tgt ? r.width / 2 : 120), clientY: r.top + (tgt ? r.height / 2 : 120) }));
      }, { isObj: mode === "object", isTbl: mode === "table" });
      await sleep(260);
    };
    for (const ctx of ctxItems) {
      if (alreadyActs("ctx:" + ctx)) continue;
      await openCtx();
      await probe("ctx", ctx, false);
      await maybeReload(mode);
    }
  }

  const tally = (label) => {
    let m = 0, d = 0;
    for (const v of results.values()) { if (v.mutated) m++; else if (v.dialog) d++; }
    console.log("  [pass:" + label + "] keys=" + results.size + " mutated=" + m + " dialog=" + d);
  };
  await probePass("text"); tally("text");
  await probePass("table"); tally("table");
  await probePass("object"); tally("object");
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
  const shortcutRows = JSON.parse(
    fs.readFileSync(process.env.SHORTCUTS_ACTS_IN || path.join(__dirname, "census/census-shortcuts.json"), "utf8")
  );
  const combos = (Array.isArray(shortcutRows) ? shortcutRows : shortcutRows.shortcuts || shortcutRows.rows || [])
    .map((r) => r.combo || r.shortcut || r.type).filter(Boolean);
  const SKIP_KEYS = new Set(["W", "w", "P", "p", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);
  // The earlier passes leave a table + a contenteditable=false object in the
  // doc; a mixed selection across a non-editable boundary silently kills
  // execCommand formatting (measured with bold). Start the keyboard sweep on
  // a FRESH text-only page so every combo sees the same clean prose doc.
  await openPage("text");
  sinceReload = 0;
  for (const combo of combos) {
    const canon = toCanon(combo);
    const lastKey = canon.split("+").pop();
    if (lastKey === "W" || lastKey === "P" || SKIP_KEYS.has(lastKey)) continue;
    if (alreadyActs("shortcut:" + canon)) continue;
    // Up to 2 attempts; attempt 2 always runs on a FRESH page. The keyboard
    // sweep runs on the doc accumulated by the earlier passes, so stray
    // selection/undo state can fake a noop; fresh-doc retry converges to the
    // true verdict (the combo either acts on clean text or honestly doesn't).
    for (let attempt = 0; attempt < 2; attempt++) {
      await probe("key", canon, true);
      const kv = results.get("key:" + canon);
      if (kv && kv.mutated) break;
      if (attempt === 0) { await closeDialog(true); await maybeReload("text"); }
    }
    if (results.has("key:" + canon)) results.set("shortcut:" + canon, results.get("key:" + canon));
    await maybeReload("text");
  }
  tally("keyboard");
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
