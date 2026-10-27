#!/usr/bin/env node
/*
 * census-oo-dialogs.cjs — OO feature inventory, dialog layer.
 *
 * For every ribbon control that opens a modal (from the interactions census:
 * opens=modal) plus the settings/context entries that open OO's big
 * multi-tab settings dialogs, this walk captures the dialog STRUCTURE:
 *   title, tab pages, every labeled field (label + tag + type + options),
 *   footer buttons. That field inventory is what a port must match —
 * "button exists" (census-oo-deep) is L0; "dialog has the same fields" is
 * the real surface of the feature.
 *
 * Env: OO_URL (default http://127.0.0.1:8735/rig-editor.html)
 * Out: census/census-oo-dialogs.json
 */
"use strict";
const { writeFileSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { chromium } = require("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OO_URL = process.env.OO_URL || "http://127.0.0.1:8735/rig-editor.html";

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const _browser = browser;
  let page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (e) => process.stderr.write("pageerror: " + e.message.slice(0, 120) + "\n"));
  await page.goto(OO_URL, { waitUntil: "domcontentloaded", timeout: 40000 });

  // OO runs in a /web-apps/ iframe on the rig page
  let page0 = null;
  for (let i = 0; i < 40; i++) {
    page0 = page.frames().find((x) => x.url().includes("/web-apps/"));
    if (page0) {
      const ready = await page0.evaluate(() => !!document.querySelector("#toolbar .panel.active")).catch(() => false);
      if (ready) break;
    }
    await sleep(2000);
  }
  if (!page0) throw new Error("OO editor frame never appeared");
  await page0.evaluate(() => {
    for (let i2 = 0; i2 < 3; i2++) {
      const g = [...document.querySelectorAll("button, a, .btn, .item")].find((b) => /got it/i.test((b.innerText || "").trim()));
      if (g) g.click();
    }
    const x = document.querySelector(".modal .tool.close, .close:not(.disabled)");
    if (x) x.click();
  });
  await sleep(1000);
  const hostPage = page; // outer Page (keyboard lives here, not on frames)
  page = page0; // rebind: all further `page` references target the OO frame

  // ---- dialog structure extractor (OO uses ASC dialogs: .asc-window etc.)
  const DLG_SEL = [
    ".modal.system-modal",
    ".asc-window:not(.tool-window)",
    "[id^=window-]",
  ].join(", ");

  // OO renders modals in their own iframe (url contains /modal/) — the
  // dialog structure lives there, not in the toolbar frame.
  // One-shot check (no polling): the caller sleeps before calling.
  async function findDialogFrame() {
    const frames = hostPage.frames().filter((x) => /\/modal\//.test(x.url()));
    for (const df2 of frames) {
      const ok = await df2.evaluate(() => !!document.querySelector("label, input, select, .checkbox")).catch(() => false);
      if (ok) return df2;
    }
    // same-frame modal fallback (newer OO builds)
    const same = await page0.evaluate(() => {
      const vis = (el) => el && (el.offsetParent !== null || getComputedStyle(el).visibility !== "hidden");
      return !!(vis(document.querySelector(".modal.system-modal")) || vis(document.querySelector(".asc-window:not(.tool-window)")));
    }).catch(() => false);
    if (same) return page0;
    return null;
  }

  async function extractDialog() {
    const df = await findDialogFrame();
    if (!df) return null;
    return df.evaluate(() => {
      const dlg = document.querySelector(".modal.system-modal") ||
        [...document.querySelectorAll(".asc-window")].find((w) => !w.className.includes("tool-window")) ||
        document.querySelector("[id^=window-]") || document.body;
      if (!dlg) return null;
      const vis = (el) => el.offsetParent !== null || getComputedStyle(el).visibility !== "hidden";
      const title = (dlg.querySelector(".modal-header .title, .header .title, [class*=caption], .asc-window-header") || {}).textContent || "";
      // tab strip inside settings dialogs
      const tabs = [...dlg.querySelectorAll(".settings li:not(.deftab):not(.nl), .nav-tabs .nav-item, [role=tab]")]
        .filter(vis).map((t) => (t.textContent || "").trim()).filter(Boolean);
      // fields: label-ish elements paired with their control
      const fields = [];
      const labels = [...dlg.querySelectorAll("label:not(.input-label-nofocus), .info-box label")].filter(vis);
      for (const lab of labels) {
        const text = (lab.textContent || "").trim().replace(/:$/, "");
        if (!text || text.length > 60) continue;
        // control: label's for= element, else next sibling input/select
        let ctl = null;
        if (lab.htmlFor) ctl = dlg.querySelector("#" + CSS.escape(lab.htmlFor));
        if (!ctl) ctl = lab.parentElement.querySelector("input, select, textarea");
        if (!ctl) {
          let n = lab.nextElementSibling;
          while (n && !ctl) { ctl = n.matches?.("input, select, textarea") ? n : n.querySelector?.("input, select, textarea"); n = n.nextElementSibling; }
        }
        if (!ctl) continue;
        const f = { label: text, tag: ctl.tagName.toLowerCase(), type: ctl.getAttribute("type") || ctl.getAttribute("data-type") || "" };
        if (ctl.tagName === "SELECT") {
          f.options = [...ctl.querySelectorAll("option")].map((o) => (o.textContent || "").trim()).slice(0, 40);
        } else if (ctl.getAttribute("contenteditable") === "true" || ctl.classList.contains("input-field")) {
          f.type = f.type || "text";
        }
        fields.push(f);
      }
      // checkboxes (OO custom: .checkbox-indicator + label text)
      for (const cb of [...dlg.querySelectorAll("input[type=checkbox], .checkbox-indicator")].filter(vis).slice(0, 60)) {
        const wrap = cb.closest("label, .checkbox-indeterminate, div");
        const text = ((wrap && wrap.textContent) || "").trim().slice(0, 60);
        if (text && !fields.some((f) => f.label === text)) fields.push({ label: text, tag: "input", type: "checkbox" });
      }
      // spinners (OO number inputs are custom .spinner-field)
      for (const sp of [...dlg.querySelectorAll(".spinner-field")].filter(vis).slice(0, 40)) {
        const labEl = sp.previousElementSibling;
        const text = (labEl && (labEl.textContent || "").trim()) || "";
        if (text && !fields.some((f) => f.label === text)) fields.push({ label: text.slice(0, 60), tag: "div", type: "spinner" });
      }
      // footer buttons
      const buttons = [...dlg.querySelectorAll("footer .btn-normal, .footer .btn-normal, .asc-window-footer button, .btn:not(.dropdown-item), footer button, .dlg-btn:not(.dropdown-item)")]
        .filter(vis).map((b) => (b.textContent || "").trim()).filter((t) => t && t.length < 30).slice(0, 12);
      return {
        frame: location.pathname.split("/").pop().slice(0, 40),
        title: title.trim().slice(0, 80),
        tabs: [...new Set(tabs)].slice(0, 20),
        fields: fields.slice(0, 120),
        buttons: [...new Set(buttons)],
        rect: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(dlg.getBoundingClientRect()),
      };
    });
  }

  async function closeDialog() {
    await hostPage.keyboard.press("Escape");
    await sleep(350);
    // modal iframes close via their footer Cancel/X in the toolbar frame
    await hostPage.evaluate(() => {}).catch(() => {});
    await page0.evaluate(() => {
      const x = document.querySelector(".modal .tool.close, .asc-window .close:not(.disabled), [id^=window-] .tool.close");
      if (x) x.click();
    });
    await sleep(400);
    // last resort: hit Cancel inside the modal frame
    const mf = hostPage.frames().filter((x) => /\/modal\//.test(x.url()))[0];
    if (mf) {
      await mf.evaluate(() => {
        const c = [...document.querySelectorAll(".btn-normal, .dlg-btn, footer button")].find((b) => /cancel/i.test((b.textContent || "")));
        if (c) c.click();
      }).catch(() => {});
      await sleep(300);
    }
  }

  // ---- driver: walk tabs, click controls that look dialog-opening ----
  const results = [];
  const tabEls = await page.evaluate(() =>
    [...document.querySelectorAll("#toolbar .tabs [data-tab], #toolbar [data-tab]")].map((e) => e.getAttribute("data-tab")));
  const tabNames = [...new Set(tabEls.filter(Boolean))];
  process.stderr.write(`tabs found: ${tabNames.length}: ${tabNames.join(", ")}\n`);

  // click each tab, then every control once; if a dialog appears, extract it
  // menu-bearing split buttons (same recipe as census-oo-deep): coordinate
  // click on the arrow, then click each POPUP item by its li rect
  const MENU_LABELS = [
    "line spacing", "bullets", "numbering", "multilevel", "borders", "shading",
    "change case", "margins", "orientation", "size", "columns", "breaks",
    "line numbers", "hyphenation", "watermark", "page color", "table",
    "shape", "chart", "symbol", "equation", "dropcap", "textart",
    "page number", "text from file", "wrapping", "align", "group", "select",
  ]

  for (const name of tabNames) {
    if (!name || name === "file") continue; // backstage navigates away — out of scope here
    try {
    await page.evaluate((n) => {
      const el = document.querySelector(`#toolbar [data-tab="${n}"]`);
      if (el) el.click();
    }, name);
    await sleep(700);

    // ---- (a) top-level toolbar buttons ----
    const ctrls = await page.evaluate(() =>
      [...document.querySelectorAll("#toolbar .panel.active .btn-toolbar:not(.disabled), #toolbar .panel.active button[id^=id-toolbar]")]
        .filter((c) => c.offsetParent !== null && (c.offsetWidth > 4))
        .map((c, i) => ({ i, id: c.id || "", txt: (c.textContent || "").trim().slice(0, 30), datatip: c.getAttribute("data-tip") || "" })));
    for (const c of ctrls) {
      const had = await page.evaluate(() => !!document.querySelector(".modal.system-modal, .asc-window"));
      if (had) await closeDialog();
      try {
        await page.evaluate((i) => {
          const list = [...document.querySelectorAll("#toolbar .panel.active .btn-toolbar:not(.disabled), #toolbar .panel.active button[id^=id-toolbar]")]
            .filter((c2) => c2.offsetParent !== null && c2.offsetWidth > 4);
          if (list[i]) list[i].click();
        }, c.i);
      } catch (e) { continue; }
      await sleep(550);
      const appeared = await findDialogFrame();
      if (appeared) {
        const struct = await extractDialog();
        if (struct && (struct.fields.length || struct.tabs.length)) {
          results.push({ tab: name, trigger: { id: c.id, label: c.txt, tip: c.datatip }, dialog: struct });
        }
        await closeDialog();
      }
      await hostPage.keyboard.press("Escape").catch(() => {});
      await sleep(150);
    } // for ctrls

    // ---- (b) split-button menus -> every item ----
    const targets = await page.evaluate(
      (labels) => {
        const panel = document.querySelector("#toolbar .panel.active") || document.querySelector("#toolbar");
        const out = [];
        panel.querySelectorAll("*").forEach((e) => {
          if (e.children.length > 6) return;
          const t = (e.getAttribute("data-title") || e.getAttribute("title") || e.innerText || "").trim().toLowerCase();
          if (!t || t.length > 40) return;
          if (!labels.some((l) => t === l || t.startsWith(l))) return;
          const r = e.getBoundingClientRect();
          if (r.width < 10 || r.height < 10) return;
          if (out.some((o) => Math.abs(o.x - (r.x + r.width - 6)) < 4 && Math.abs(o.y - (r.y + r.height / 2)) < 4)) return;
          out.push({ x: r.x + r.width - 6, y: r.y + r.height / 2, label: t.slice(0, 40) });
        });
        return out.slice(0, 14);
      },
      MENU_LABELS);
    for (const pt of targets) {
      await hostPage.keyboard.press("Escape");
      await sleep(250);
      await hostPage.mouse.click(pt.x, pt.y);
      await sleep(700);
      // enumerate popup rows + their rects
      const items = await page.evaluate(() => {
        const cands = [...document.querySelectorAll("ul")].filter((e) => {
          const r = e.getBoundingClientRect();
          if (r.width < 60 || r.height < 40 || r.width > 900 || r.height > 900) return false;
          if (getComputedStyle(e).visibility === "hidden" || getComputedStyle(e).display === "none") return false;
          return e.querySelectorAll(":scope > li").length >= 2;
        });
        const rows = (e) => e.querySelectorAll("li, .item");
        const best = cands.filter((e) => rows(e).length >= 2).sort((a, b) => rows(a).length - rows(b).length)[0];
        if (!best) return [];
        return [...best.querySelectorAll(":scope > li")].map((li) => {
          const r = li.getBoundingClientRect();
          return { label: (li.innerText || "").trim().split("\n")[0].slice(0, 45), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }).filter((i) => i.label);
      }).catch(() => []);
      for (const it of items) {
        await hostPage.mouse.click(it.x, it.y);
        await sleep(500);
        const dlgF = await findDialogFrame();
        if (dlgF) {
          const struct = await extractDialog();
          if (struct && (struct.fields.length || struct.tabs.length)) {
            results.push({ tab: name, trigger: { id: "", label: pt.label, tip: "", via: "menu-item:" + it.label }, dialog: struct });
          }
          await closeDialog();
        } else {
          // the click may have consumed the popup — reopen for the next item
          await hostPage.keyboard.press("Escape").catch(() => {});
          await hostPage.mouse.click(pt.x, pt.y);
          await sleep(500);
        }
      }
      await hostPage.keyboard.press("Escape").catch(() => {});
      await sleep(250);
    } // for targets
    } catch (e) { process.stderr.write("tab " + name + " skip: " + String((e && e.message) || e).slice(0, 60) + "\n"); try { await closeDialog(); } catch (e2) {} }
  }

  mkdirSync(resolve(__dirname, "census"), { recursive: true });
  writeFileSync(resolve(__dirname, "census/census-oo-dialogs.json"),
    JSON.stringify({ engine: "oo-rig", capturedAt: new Date().toISOString(), dialogs: results }, null, 1));
  process.stderr.write(`captured ${results.length} dialogs\n`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
