#!/usr/bin/env node
/**
 * census-wo-deep.cjs — mirror of census-oo-deep.cjs for the WorldOffice
 * editor: captures the full WO surface with the SAME section schema so
 * deep-gap.py can join OO vs WO per section.
 *
 *   tabs        per-tab ribbon controls
 *   rightPanel  (WO has none today -> recorded as { present: false })
 *   statusBar   .statusbar buttons
 *   backstage   #btn-file -> #file-menu rows
 *   menus       every span.menu trigger -> visible ul.menu-list rows
 *   contextMenu right-click on #editor -> #ctx-menu rows
 *
 * Env:  WO_URL  (default http://192.168.42.42:8082/word/ — prod; probing is
 *       read-only: menus/ctx never persist anything)
 *       WO_DEEP_OUT  (default census/census-wo-deep.json)
 */
const fs = require("fs")
const path = require("path")
const { chromium } = require("playwright")

const HERE = __dirname
const WO_URL = process.env.WO_URL || "http://192.168.42.42:8082/word/"
const OUT = process.env.WO_DEEP_OUT
  ? path.resolve(process.env.WO_DEEP_OUT)
  : path.join(HERE, "census", "census-wo-deep.json")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(WO_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForSelector(".ribbon-tab", { timeout: 30000 })
  await sleep(1500)

  const deep = {
    engine: "worldoffice",
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

  // ── tabs ──
  await section("tabs", async () => {
    const tabs = {}
    const slugs = await page.evaluate(() =>
      [...document.querySelectorAll(".ribbon-tab")].map((t) => t.getAttribute("data-tab")),
    )
    for (const slug of slugs.filter(Boolean)) {
      await page.evaluate((s) => {
        const el = document.querySelector(`.ribbon-tab[data-tab="${s}"]`)
        if (el) el.click()
      }, slug)
      await sleep(450)
      const buttons = await page.evaluate(() => {
        const out = []
        document
          .querySelectorAll(
            ".ribbon-page.active button, .ribbon-page.active select, .ribbon-page.active input[type=color], .ribbon-page.active input[type=number]",
          )
          .forEach((b) => {
            const r = b.getBoundingClientRect()
            if (r.width <= 5 || r.height <= 5 || b.offsetParent === null) return
            const label =
              b.getAttribute("data-title") ||
              b.getAttribute("aria-label") ||
              b.getAttribute("title") ||
              (b.tagName === "SELECT" ? `select:${b.id || "anon"}` : (b.innerText || "").trim().slice(0, 40))
            out.push({
              id: b.id || null,
              cmd: b.getAttribute("data-cmd") || null,
              icon: "",
              label,
              enabled: !b.disabled,
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            })
          })
        return out
      })
      if (buttons.length) tabs[slug] = { label: slug, contextual: false, buttons }
    }
    return tabs
  })

  // ── right panel: presence + rail sections + per-section controls ──
  await section("rightPanel", async () => {
    const present = await page.evaluate(() => {
      const e = document.querySelector("#right-panel, .right-panel, #inspector, .inspector-panel")
      return e && e.getBoundingClientRect().width > 0
    })
    const toggles = []
    const openedSections = []
    // Open the panel via its real toggle if hidden, then walk each rail
    // section: click it, collect its visible controls (input/select/button
    // with id or name, label text, value/type where meaningful).
    const walk = await page
      .evaluate(() => {
        const rp = document.querySelector("#right-panel")
        const toggle = document.getElementById("btn-right-panel-toggle")
        return { rp: !!rp, toggle: !!toggle, hidden: rp ? rp.hidden : true }
      })
      .catch(() => ({ rp: false, toggle: false, hidden: true }))
    if (walk.rp && walk.hidden && walk.toggle) {
      await page.evaluate(() => document.getElementById("btn-right-panel-toggle").click())
      await page
        .waitForFunction(() => {
          const rp = document.querySelector("#right-panel")
          return rp && !rp.hidden && rp.getBoundingClientRect().width > 0
        }, { timeout: 5000 })
        .catch(() => {})
    }
    if (walk.rp) {
      const sections = await page.$$eval("#right-rail .rail-btn", (btns) =>
        btns.map((b) => ({ panel: b.getAttribute("data-panel"), label: b.getAttribute("title") || b.getAttribute("aria-label") })),
      )
      for (const s of sections) {
        try {
          // Clicking the already-active rail section COLLAPSES the panel
          // (openRightPanelSection toggles). Skip the click when active,
          // and re-open defensively if a prior step collapsed it.
          const state = await page.evaluate(
            (p) => {
              const rp = document.querySelector("#right-panel")
              const btn = document.querySelector(`#right-rail .rail-btn[data-panel="${p}"]`)
              return {
                active: btn ? btn.getAttribute("aria-pressed") === "true" : false,
                panelVisible: rp && !rp.hidden && rp.getBoundingClientRect().width > 0,
              }
            },
            s.panel,
          )
          if (!state.panelVisible) {
            await page.evaluate(() => document.getElementById("btn-right-panel-toggle").click())
            await page.waitForTimeout(250)
          }
          if (!state.active) {
            await page.evaluate((p) => document.querySelector(`#right-rail .rail-btn[data-panel="${p}"]`).click(), s.panel)
          }
          await page.waitForTimeout(250)
          const controls = await page.$$eval(`.rp-section[data-section="${s.panel}"]`, (secs) => {
            const out = []
            for (const sec of secs) {
              for (const c of sec.querySelectorAll("input, select, button")) {
                if (c.closest("[hidden]")) continue
                const r = c.getBoundingClientRect()
                if (r.width === 0 && r.height === 0) continue
                const lbl =
                  (c.id && document.querySelector(`label[for="${c.id}"]`)?.textContent?.trim()) ||
                  c.getAttribute("title") ||
                  c.getAttribute("aria-label") ||
                  ""
                out.push({
                  tag: c.tagName.toLowerCase(),
                  id: c.id || null,
                  label: lbl.trim(),
                  kind: c.getAttribute("type") || (c.tagName === "SELECT" ? "select" : "button"),
                })
              }
            }
            return out
          })
          openedSections.push({ section: s.panel, label: s.label, controls })
        } catch {
          openedSections.push({ section: s.panel, label: s.label, error: "probe failed" })
        }
      }
      toggles.push(...sections.map((s) => s.panel))
    }
    return { present, toggles, openedSections }
  })

  // ── status bar ──
  await section("statusBar", async () => {
    return await page.evaluate(() =>
      [...document.querySelectorAll(".statusbar button, #statusbar button, [class*=status] button")]
        .filter((b) => b.offsetParent !== null)
        .map((b) => {
          const r = b.getBoundingClientRect()
          return {
            label: (b.getAttribute("aria-label") || b.innerText || "").trim().slice(0, 40),
            id: b.id || "",
            x: Math.round(r.x),
            w: Math.round(r.width),
          }
        })
        .filter((i) => i.w > 3),
    )
  })

  // ── backstage (File menu: dropdown rows OR CHROME3 full overlay) ──
  await section("backstage", async () => {
    await page.evaluate(() => document.getElementById("btn-file")?.click())
    await sleep(500)
    const items = await page.evaluate(() => {
      // CHROME3: rows live in the backstage overlay rail; legacy: #file-menu
      const host = document.getElementById("backstage-overlay")
      const sel = host && !host.hidden
        ? "#backstage-overlay .backstage-nav button, #backstage-overlay .backstage-pane button"
        : "#file-menu .menu-item, #file-menu button, #file-menu [role=menuitem]"
      return [...document.querySelectorAll(sel)]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({
          id: b.id || "",
          label: (b.textContent || "").trim(),
          enabled: !b.disabled && !String(b.className).includes("disabled"),
        }))
        .filter((i) => i.label)
    })
    await page.keyboard.press("Escape")
    await sleep(300)
    return items
  })

  // ── menus: every ribbon menu-trigger -> its menu-list rows ──
  await section("menus", async () => {
    const collected = []
    // walk EVERY ribbon tab so hidden-tab menu triggers (Macros etc) are
    // captured too — collect triggers per tab, then open them.
    const slugs = await page.evaluate(() =>
      [...document.querySelectorAll(".ribbon-tab")].map((t) => t.getAttribute("data-tab")),
    )
    const tabMenus = []
    for (const tab of slugs) {
      await page.evaluate((s) => {
        const el = document.querySelector(`.ribbon-tab[data-tab="${s}"]`)
        if (el) el.click()
      }, tab)
      await sleep(350)
      const trig = await page.evaluate(
        (tabSlug) => [...document.querySelectorAll(".menu-trigger")]
          .filter((t) => t.offsetParent !== null && t.id !== "btn-file")
          .map((t) => ({
            tab: tabSlug,
            key: t.getAttribute("aria-label") || t.id ||
              // triggers with only data-i18n (Margins ▾, Size ▾ …) — use text
              (t.textContent || "").trim().slice(0, 30),
          })),
      tab)
      for (const t of trig) {
        if (!tabMenus.some((m) => m.key === t.key)) tabMenus.push(t)
      }
    }
    const out = []
    for (const t of tabMenus) {
      await page.keyboard.press("Escape")
      await sleep(200)
      await page.evaluate((entry) => {
        const tabEl = document.querySelector(`.ribbon-tab[data-tab="${entry.tab}"]`)
        if (tabEl) tabEl.click()
        const el = [...document.querySelectorAll(".menu-trigger")].find(
          (x) => (x.getAttribute("aria-label") || x.id || (x.textContent || "").trim().slice(0, 30)) === entry.key,
        )
        if (el) el.click()
      }, t)
      await sleep(400)
      const items = await page.evaluate(() =>
        [...document.querySelectorAll("ul.menu-list")]
          .filter((ul) => !ul.hidden && ul.getBoundingClientRect().height > 0)
          .flatMap((ul) => [...ul.querySelectorAll("[role=menuitem], button, li")])
          .map((li) => ({
            label: (li.textContent || "").trim().split("\n")[0].slice(0, 40),
            cmd: li.getAttribute("data-cmd") || null,
            enabled: !li.disabled,
          }))
          .filter((i) => i.label),
      )
      if (items.length) out.push({ trigger: t.key, items })
    }
    return out
  })

  // ── context menu: right-click the editor, read #ctx-menu ──
  await section("contextMenu", async () => {
    const geo = await page.evaluate(() => {
      const e = document.getElementById("editor")
      if (!e) return null
      const r = e.getBoundingClientRect()
      return { cx: r.x + r.width / 2, word: r.y + 120 }
    })
    if (!geo) throw new Error("#editor missing")
    await page.evaluate(() => {
      const ed = document.getElementById("editor")
      if (ed) ed.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 700, clientY: 300 }))
    })
    await sleep(500)
    const items = await page.evaluate(() =>
      [...document.querySelectorAll("#ctx-menu [role=menuitem], #ctx-menu button")]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({
          label: (b.textContent || "").trim(),
          ctx: b.getAttribute("data-ctx") || null,
          enabled: !b.disabled,
        }))
        .filter((i) => i.label),
    )
    await page.keyboard.press("Escape")
    return { probed: true, items }
  })

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(deep, null, 1) + "\n", "utf-8")
  console.log(
    `census-wo-deep: tabs=${Object.keys(deep.tabs).length} controls=${Object.values(deep.tabs).reduce((n, t) => n + t.buttons.length, 0)} rightPanel=${deep.rightPanel?.present ? "yes" : "absent"} statusbar=${(deep.statusBar || []).length} backstage=${(deep.backstage || []).length} menus=${deep.menus.length} ctx=${(deep.contextMenu?.items || []).length}`,
  )
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`)
  if (Object.keys(deep.sectionErrors).length) console.log("section errors:", deep.sectionErrors)
  await browser.close()
}

main().catch((e) => {
  console.error("census-wo-deep FAILED:", e.message)
  process.exit(1)
})
