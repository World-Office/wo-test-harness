#!/usr/bin/env node
/**
 * census-oo-deep.cjs — capture the FULL OnlyOffice surface, not just ribbon
 * buttons. Sections (each independently fault-tolerant; failures are recorded
 * in the output instead of killing the capture):
 *
 *   tabs        per-tab toolbar controls (same schema as census-oo.json)
 *   rightPanel  right tool-menu toggles + opened panel section titles
 *   statusBar   #statusbar items
 *   backstage   File menu items (same logic as census-oo.cjs)
 *   menus       dropdown menus for known menu-bearing triggers, found via a
 *               visibility diff (robust to arbitrary popup class names)
 *   contextMenu right-click menu items (may be empty; `probed` flag marks
 *               whether the probe actually ran)
 *
 * Env:  OO_URL  (default http://127.0.0.1:8735/rig-editor.html)
 *       OO_DEEP_OUT  (default census/census-oo-deep.json)
 *
 * Requires the rig: docker container nc-ooh-onlyoffice-1 (192.168.64.2) +
 * `python3 /tmp/rig-jwt.py` (serves the signed editor page on :8735).
 */
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const HERE = __dirname
const OO_URL = process.env.OO_URL || "http://127.0.0.1:8735/rig-editor.html"
const OUT = process.env.OO_DEEP_OUT
  ? path.resolve(process.env.OO_DEEP_OUT)
  : path.join(HERE, "census", "census-oo-deep.json")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Any small on-screen absolutely/fixed-positioned list container = a popup
// menu. Pick the candidate with the FEWEST rows >= minItems — the menus are
// small; overlays (canvas layers) have hundreds of children.
const POPUP_FN = () => {
  const cands = [...document.querySelectorAll("ul")].filter((e) => {
    const r = e.getBoundingClientRect()
    if (r.width < 60 || r.height < 40 || r.width > 900 || r.height > 900) return false
    if (r.right > innerWidth || r.bottom > innerHeight) return false
    if (getComputedStyle(e).visibility === "hidden" || getComputedStyle(e).display === "none") return false
    return e.querySelectorAll(":scope > li").length >= 3
  })
  const rows = (e) => e.querySelectorAll("li, .item")
  const best = cands
    .filter((e) => rows(e).length >= 3)
    .sort((a, b) => rows(a).length - rows(b).length)[0]
  if (!best) return []
  return [...best.querySelectorAll(":scope > li")]
    .map((li) => ({
      label: (li.innerText || "").trim().split("\n")[0].slice(0, 40),
      enabled: !/disabled|hidden/.test(String(li.className)),
    }))
    .filter((i) => i.label && i.label !== " ")
}

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(OO_URL, { waitUntil: "domcontentloaded", timeout: 40000 })

  let f = null
  for (let i = 0; i < 40; i++) {
    f = page.frames().find((x) => x.url().includes("/web-apps/"))
    if (f) {
      const ready = await f
        .evaluate(() => !!document.querySelector("#toolbar .panel.active"))
        .catch(() => false)
      if (ready) break
    }
    await sleep(2000)
  }
  if (!f) throw new Error("OO editor frame never appeared")

  // Dismiss first-run tooltips overlaying the ribbon.
  for (let i = 0; i < 3; i++) {
    await f
      .evaluate(() => {
        const g = [...document.querySelectorAll("button, a, .btn, .item")].find(
          (b) => /got it/i.test((b.innerText || "").trim()),
        )
        if (g) g.click()
      })
      .catch(() => {})
    await sleep(800)
  }

  const deep = {
    engine: "onlyoffice",
    capturedAt: new Date().toISOString(),
    viewport: { w: 1600, h: 1000 },
    tabs: {},
    rightPanel: null,
    statusBar: null,
    backstage: null,
    menus: [],
    contextMenu: null,
    sectionErrors: {},
  }

  const section = async (name, fn) => {
    try {
      deep[name] = await fn()
    } catch (e) {
      deep.sectionErrors[name] = String(e.message || e).slice(0, 200)
    }
  }

  // ── tabs: click every visible ribbon tab, enumerate its controls ──
  await section("tabs", async () => {
    const tabs = {}
    const tabEls = await f.evaluate(() =>
      [...document.querySelectorAll("#toolbar .tabs [data-tab], #toolbar [data-tab]")].map((e) => ({
        tab: e.getAttribute("data-tab"),
        label: (e.getAttribute("title") || e.innerText || "").trim(),
        contextual: /header|footer|chart|shape|table|picture/i.test(e.getAttribute("data-tab") || ""),
      })),
    )
    const seen = new Set()
    for (const t of tabEls) {
      if (!t.tab || seen.has(t.tab)) continue
      seen.add(t.tab)
      await f.evaluate((tab) => {
        const el = document.querySelector(`#toolbar [data-tab="${tab}"]`)
        if (el) el.click()
      }, t.tab)
      await sleep(700)
      const buttons = await f.evaluate(() => {
        const panel = document.querySelector("#toolbar .panel.active") || document.querySelector("#toolbar")
        const out = []
        panel.querySelectorAll("button, input, [data-title], [title]").forEach((b) => {
          const r = b.getBoundingClientRect()
          if (r.width <= 5 || r.height <= 5) return
          const label =
            b.getAttribute("data-title") ||
            b.getAttribute("title") ||
            b.getAttribute("aria-label") ||
            (b.innerText || "").trim().slice(0, 40)
          out.push({
            id: b.id,
            icon: (b.querySelector('[class*="icon"]')?.className || "").toString().match(/btn-[^\s"]+/)?.[0] || "",
            label,
            enabled: !/disabled|checked-off/.test(b.className) && !b.disabled,
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          })
        })
        return out
      })
      if (buttons.length) tabs[t.tab] = { label: t.label || t.tab, contextual: t.contextual, buttons }
    }
    return tabs
  })

  // ── right panel: toggles on the right tool-menu + opened panel sections ──
  await section("rightPanel", async () => {
    const toggles = await f.evaluate(() =>
      [...document.querySelectorAll("#view-right-menu button, #view-right-menu .tool-menu-btns button")]
        .map((b) => ({
          title: b.getAttribute("data-title") || b.getAttribute("title") || "",
          hint: (b.getAttribute("data-hint") || "").trim(),
        }))
        .filter((t) => t.title || t.hint),
    )
    // open the third toggle (paragraph settings in default layout) if present
    const pt = await f.evaluate(() => {
      const btns = [...document.querySelectorAll("#view-right-menu button")]
      const b = btns[2] || btns[0]
      if (!b) return null
      const r = b.getBoundingClientRect()
      return [r.x + r.width / 2, r.y + r.height / 2]
    })
    let sections = []
    if (pt) {
      await page.mouse.click(pt[0], pt[1])
      await sleep(1200)
      sections = await f.evaluate(() =>
        [...document.querySelectorAll(".right-panel")]
          .flatMap((p) => [...p.querySelectorAll("label, .header-text, .separator")])
          .map((e) => (e.innerText || "").trim())
          .filter(Boolean),
      )
      await page.keyboard.press("Escape")
    }
    return { toggles, openedSections: sections }
  })

  // ── status bar ──
  await section("statusBar", async () => {
    return await f.evaluate(() => {
      const bar = document.querySelector("#statusbar, #status-bar")
      if (!bar) return []
      return [...bar.querySelectorAll("span, button, a, div[id]")]
        .map((e) => {
          const r = e.getBoundingClientRect()
          return {
            label: (e.getAttribute("title") || e.innerText || "").trim().slice(0, 40),
            id: e.id || "",
            x: Math.round(r.x),
            w: Math.round(r.width),
          }
        })
        .filter((i) => i.w > 3 && (i.label || i.id))
    })
  })

  // ── backstage (File menu) — same contract as census-oo.cjs ──
  await section("backstage", async () => {
    await f.evaluate(() => document.querySelector('[id="file"][data-tab="file"]')?.click())
    await sleep(2500)
    const opened = await f
      .evaluate(() => {
        const p = document.querySelector("#file-menu-panel")
        return p && p.getBoundingClientRect().width > 0
      })
      .catch(() => false)
    if (!opened) throw new Error("backstage did not open")
    const items = await f.evaluate(() =>
      [...document.querySelectorAll("#file-menu-panel li.fm-btn")]
        .map((li) => {
          const a = li.querySelector("a.menu-item")
          if (!a) return null
          const r = a.getBoundingClientRect()
          if (r.width <= 0) return null
          return {
            id: li.id || a.id || "",
            label: (a.innerText || a.getAttribute("data-title") || "").trim(),
            enabled: !/disabled/.test(li.className),
          }
        })
        .filter(Boolean),
    )
    await page.keyboard.press("Escape")
    await sleep(600)
    return items
  })

  // ── menus: open label-matched split-buttons on each tab, visibility-diff ──
  await section("menus", async () => {
    const LABELS = [
      "line spacing", "bullets", "numbering", "multilevel", "borders", "shading",
      "change case", "margins", "orientation", "size", "columns", "breaks",
      "line numbers", "hyphenation", "watermark", "page color", "table",
      "shape", "chart", "symbol", "equation", "dropcap", "textart",
      "page number", "text from file", "highlight color", "font color",
      "wrapping", "align", "group",
    ]
    const menus = []
    const tabEls = await f.evaluate(() =>
      [...document.querySelectorAll("#toolbar .tabs [data-tab], #toolbar [data-tab]")].map((e) => e.getAttribute("data-tab")),
    )
    for (const tab of tabEls.filter(Boolean)) {
      await f.evaluate((t) => {
        const el = document.querySelector(`#toolbar [data-tab="${t}"]`)
        if (el) el.click()
      }, tab)
      await sleep(600)
      // Trigger elements: id-less split buttons carry labels in title/text.
      const targets = await f.evaluate(
        (labels) => {
          const panel = document.querySelector("#toolbar .panel.active") || document.querySelector("#toolbar")
          const out = []
          panel.querySelectorAll("*").forEach((e) => {
            if (e.children.length > 6) return
            const t = (e.getAttribute("data-title") || e.getAttribute("title") || e.innerText || "").trim().toLowerCase()
            if (!t || t.length > 40) return
            if (!labels.some((l) => t === l || t.startsWith(l))) return
            const r = e.getBoundingClientRect()
            if (r.width < 10 || r.height < 10) return
            if (out.some((o) => Math.abs(o.x - (r.x + r.width - 6)) < 4 && Math.abs(o.y - (r.y + r.height / 2)) < 4)) return
            out.push({ x: r.x + r.width - 6, y: r.y + r.height / 2, label: t.slice(0, 40) })
          })
          return out.slice(0, 14)
        },
        LABELS,
      )
      for (const pt of targets) {
        await page.keyboard.press("Escape")
        await sleep(250)
        await page.mouse.click(pt.x, pt.y)
        await sleep(800)
        const items = await f.evaluate(POPUP_FN)
        if (items.length && !menus.some((m) => JSON.stringify(m.items) === JSON.stringify(items))) {
          menus.push({ tab, trigger: pt.label, items })
        }
      }
    }
    return menus
  })

  // ── context menu: select text, right-click, visibility-diff (retried) ──
  await section("contextMenu", async () => {
    const geo = await f.evaluate(() => {
      const e = document.querySelector("#editor_sdk") || document.querySelector("canvas")
      if (!e) return null
      const r = e.getBoundingClientRect()
      return { cx: r.x + r.width / 2, word: r.y + 120, blank: r.y + r.height - 60 }
    })
    if (!geo) throw new Error("no canvas")
    let items = []
    for (let attempt = 0; attempt < 3 && !items.length; attempt++) {
      await page.keyboard.press("Escape")
      await sleep(300)
      // dismiss any open dropdown from an earlier section with a blank click
      await page.mouse.click(geo.cx, geo.blank)
      await sleep(500)
      await page.mouse.dblclick(geo.cx, geo.word)
      await sleep(600)
      await page.mouse.click(geo.cx + 4, geo.word, { button: "right" })
      await sleep(1300)
      items = await f.evaluate(POPUP_FN)
    }
    return { probed: true, items }
  })

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(deep, null, 1) + "\n", "utf-8")
  console.log(
    `census-oo-deep: tabs=${Object.keys(deep.tabs).length} controls=${Object.values(deep.tabs).reduce((n, t) => n + t.buttons.length, 0)} rightPanelSections=${(deep.rightPanel?.openedSections || []).length} statusbar=${(deep.statusBar || []).length} backstage=${(deep.backstage || []).length} menus=${deep.menus.length} ctx=${(deep.contextMenu?.items || []).length}`,
  )
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`)
  if (Object.keys(deep.sectionErrors).length) console.log("section errors:", deep.sectionErrors)
  await browser.close()
}

main().catch((e) => {
  console.error("census-oo-deep FAILED:", e.message)
  process.exit(1)
})
