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

  // ── right panel: honest absence check ──
  await section("rightPanel", async () => {
    const present = await page.evaluate(() =>
      ["#right-panel", ".right-panel", "#inspector", ".inspector-panel"].some((s) => {
        const e = document.querySelector(s)
        return e && e.getBoundingClientRect().width > 0
      }),
    )
    return { present, toggles: [], openedSections: [] }
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

  // ── backstage (File menu) ──
  await section("backstage", async () => {
    await page.evaluate(() => document.getElementById("btn-file")?.click())
    await sleep(500)
    const items = await page.evaluate(() =>
      [...document.querySelectorAll("#file-menu .menu-item, #file-menu button, #file-menu [role=menuitem]")]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({
          id: b.id || "",
          label: (b.textContent || "").trim(),
          enabled: !b.disabled && !String(b.className).includes("disabled"),
        }))
        .filter((i) => i.label),
    )
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
          .map((t) => ({ tab: tabSlug, key: t.getAttribute("aria-label") || t.id })),
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
          (x) => (x.getAttribute("aria-label") || x.id) === entry.key,
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
