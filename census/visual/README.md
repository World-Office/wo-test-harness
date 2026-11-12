# Visuelle Parity: OO 9.4 ↔ World-Office Side-by-Side

Werkzeuge, um die Ribbon-/Tab-/Statusbar-Parity zwischen dem OnlyOffice-9.4-Demo
(„OO") und dem World-Office-Editor („WO") **sichtbar und messbar** zu machen —
 ohne dass jemand Screenshots im Kopf vergleichen muss.

## Schnellstart

```bash
# 1. Side-by-Side-Shots pro Tab aufnehmen (OO-Demo + WO-prod, DE-Locale)
/usr/bin/node /tmp/visual-sbs.mjs        # -> /tmp/sbs/oo-<Tab>.png, wo-<Tab>.png, *-full.png, *-sb.png

# 2. Pixel-Metriken rechnen (Ink-Anteil, Row-Bands) — kein Bildbetrachter nötig
/usr/bin/node /tmp/visual-metrics.mjs    # liest /tmp/sbs/*.png
```

Voraussetzungen: Playwright unter
`wo-test-harness/census/node_modules/playwright/index.mjs`,
Netz-Zugriff auf `world-office.graphwiz.ai/demo/` und `editor.cloud.graphwiz.ai/word/?UI_LLCC=de-DE`.

## Wichtige Fallen (gelernt)

- **OO rendert in Canvas** — `page.screenshot({clip})` fotografiert die äußere
  Demo-Seite, nicht den Editor. Richtig: `page.locator('iframe').first().screenshot()`.
- **OO-Icon-Sprite ist auth-walled** — Canvas-Crops liefern leere Data-URIs.
  Piktogramme holt man per `element.screenshot()` auf dem `<i class="toolbar__icon …">`
  bei `deviceScaleFactor: 2` (siehe `/tmp/ooicon-*.png`).
- OO-Tabs klickt man mit `mousedown` + `click` auf `.tabs li`.
- WO-Ribbon-Seiten: nur `.ribbon-page.active` ist sichtbar — für Inventuren alle
  `.ribbon-page[data-tab]` im DOM durchlaufen (Reihenfolge = DOM, nicht Sichtbarkeit).

## Artefakte

| Pfad | Inhalt |
|---|---|
| `/tmp/sbs/oo-<Tab>.png` / `wo-<Tab>.png` | Ribbon-Streifen (oben 150 px) pro Tab, DE |
| `/tmp/sbs/*-full.png` | Gesamtseite |
| `/tmp/sbs/*-sb.png` | Statusleiste |
| `/tmp/chrome-diff.json` | OO-vs-WO Chrome-Inventur pro Tab (Labels, Reihenfolge, Icons) |
| `/tmp/wo-chrome.json`, `/tmp/wo-home-visible.json` | WO-Ribbon-Inventuren |
| `/tmp/oo-home-full.json` | OO-Startseite inkl. QAT-Quick-Access (2×4) |
| `/tmp/ooicon-qat-*.png` | Pixel-exakte OO-QAT-Icons (dsf=2) |

## Mess-Methode (`visual-metrics.mjs`)

Pro Bild: Ink-Anteil (Pixel mit Luminanz < 200) und „Row-Bands" (zusammenhängende
Zeilen mit >2 % Breite Tinte). Damit sieht man strukturelle Abweichungen ohne
Bilder: OO-Ribbon hat die Bands Tab-Zeile (~10–30) + zwei Button-Reihen (~50–115);
WO sollte dieselben Bands haben. Große Ink-Differenz = Dichte-/Button-Anzahl-Drift.

Letzter Stand (2026-11-11, nach Chrome-Runden 2–3): Ink pro Tab OO ≈ 4–5 % vs
WO ≈ 2–9 % — WO ist heller (weniger Buttons sichtbar, „Mehr"-Overflow fehlt auf
WO-Seite). Statusleiste: WO ink 8,4 % vs OO 4,1 % (WO hat mehr Text-Buttons).

## Code-Graph (cgc)

```bash
cgc index server/apps/web/apps/documenteditor-wysiwyg
cgc find '<symbol>'        # Vorkommen
cgc callers '<fn>'         # Aufrufer (Dead-Code-Check: 0 Callers = Kandidat)
cgc report                 # CGC_REPORT.md
```

Achtung: Die DB enthält auch Fremdcode (OO-Quellen unter Euro-Office,
docserver-frontend-dist) — Abfragen auf WO-Pfade einschränken.

## Offene Punkte (Stand 2026-11-11)

Alle vier offenen Punkte sind erledigt (Stand 2026-11-12):

1. **„Mehr"-Overflow** ✅ CHROME-G (commit 5309e2fe3): `.wo-ovf`-Kollaps
   (hidden-but-wired) über alle Tabs + `data-menu-cmd`-Spiegel in den
   Mehr-Menüs; Chrome-Dump v6: 0 fehlend (eine dokumentierte Formel-
   Abweichung, s. index.html-Kommentar).
2. **QAT-Piktogramme** ✅ CHROME-E — pixel-exakte OO-PNGs als Base64-
   Data-URIs (`.oo-ic-qat-*`).
3. **Review-Display-Mode** ✅ `#sb-review-display-mode` in der Statusleiste
   (`setReviewDisplay`, Statusbar.DisplayMode-Select).
4. **toc-dialog-L4** ✅ LEDGER-H — 6/6 Checks grün; `link-dialog-l4`
   registriert (covered 2/2); L4-Fidelity bleibt 33.
