#!/usr/bin/env python3
"""deep-gap.py — join census-oo-deep.json vs census-wo-deep.json into a ranked
parity gap report (census/census/oo-deep-gap.md).

Per section (tabs, menus, contextMenu, backstage, statusBar, rightPanel):
  - OO surface size vs WO surface size
  - item-level deficit: OO rows whose normalized label has no WO counterpart
    (exact match on lowercase alnum-only labels, plus first-3-words prefix
    match for long labels)

The report is the implementation backlog, not a gate — promotion into the
feature register stays a human/ai-contract act.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
OO = HERE / "census" / "census-oo-deep.json"
WO = HERE / "census" / "census-wo-deep.json"
OUT = HERE / "census" / "oo-deep-gap.md"


# OO tab slug -> WO tab slug (OO 9.4 uses short slugs; WO uses full names)
SLUG_MAP = {
    "ins": "insert",
    "file": None,
    "charttab": "chart-design",
    "links": "references",
    "review": "collaboration",
    "protect": "protection",
    "headerfooter": "header-footer",
    "8713d619-4e06-ab2c-09da-f8ce4a3a70e0": "ai",
}


def norm(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "")
    s = (s or "").lower()
    s = re.sub(r"\(.*?\)", "", s)  # drop parenthesized shortcuts
    return re.sub(r"[^a-z0-9]+", "", s).strip()


def oo_clean(s: str) -> str:
    """OO captures sometimes concatenate a label with its submenu contents
    ('Equation settingsCurrent - ProfessionalC'). Truncate at a lowercase->
    uppercase junction, but only when the junction is in a NON-FIRST word
    ('Text alignment|Top...') or the first word's prefix recurs later
    ('Link|Edit link...') — legit CamelCase like 'SmartArt' is kept."""
    words = (s or "").split()
    if not words:
        return ""
    def junction(w):
        m = re.search(r"[a-z][A-Z]", w)
        return (m.start() + 1) if m else None
    for i, w in enumerate(words):
        j = junction(w)
        if j is None:
            continue
        if i > 0 or w[:j].lower() in {x.lower() for x in words[1:]}:
            words = words[:i] + [w[:j]]
            break
    return re.sub(r"\s+", " ", " ".join(words)).strip()


def labels(rows: list[dict]) -> list[str]:
    out, seen = [], set()
    for l in (r.get("label") or "" for r in rows):
        l = re.sub(r"\s+", " ", l).strip()
        if not l or norm(l) in seen:
            continue
        seen.add(norm(l))
        out.append(l)
    return out


def deficit(oo_rows: list[dict], wo_rows: list[dict]) -> list[str]:
    wo_n = {norm(l) for l in labels(wo_rows)}
    # also index the first two words so "Paste special" matches "Paste"
    wo_prefix = set()
    for l in labels(wo_rows):
        words = re.findall(r"[a-z0-9]+", l.lower())
        if words:
            wo_prefix.add(norm("".join(words[:2])))
    # token-set index: "Table" matches "Insert table", "Fit To Page" ~ "Fit page"
    STOP = {"to", "the", "a", "an", "of", "in", "&", "and", "your", "from"}
    def toks(s: str) -> frozenset:
        return frozenset(w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP)
    def tok_eq(a: str, b: str) -> bool:
        # prefix-stem: "Summarize" ~ "Summarization" (common prefix >= 6)
        n = min(len(a), len(b))
        return n >= 5 and a[:n] == b[:n] or a == b
    def t_subset(a: frozenset, b: frozenset) -> bool:
        return len(a) > 0 and all(any(tok_eq(x, y) for y in b) for x in a)
    wo_tok = [toks(l) for l in labels(wo_rows) if toks(l)]
    out = []
    for l in labels(oo_rows):
        n = norm(oo_clean(l))
        if not n or n in wo_n:
            continue
        words = re.findall(r"[a-z0-9]+", oo_clean(l).lower())
        pre = norm("".join(words[:2])) if words else ""
        if pre and pre in wo_prefix:
            continue
        t = toks(oo_clean(l))
        # forward: OO tokens all present in one WO label ("Table" <= "Insert table")
        if t and any(t_subset(t, w) for w in wo_tok):
            continue
        # reverse: WO label is OO minus at most one word ("Caption" <= "Insert caption")
        if t and any(len(w) >= len(t) - 1 and t_subset(w, t) for w in wo_tok):
            continue
        out.append(l)
    return out


def main() -> int:
    oo = json.loads(OO.read_text())
    wo = json.loads(WO.read_text())
    lines: list[str] = []
    lines.append("# OO vs WO deep surface gap")
    lines.append("")
    lines.append(f"generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}")
    lines.append(f"oo capture: {oo.get('capturedAt')} · wo capture: {wo.get('capturedAt')}")
    lines.append("")

    total_oo = total_wo = total_gap = 0

    # tabs
    lines.append("## Ribbon tabs")
    lines.append("")
    for tab, t in oo.get("tabs", {}).items():
        wo_key = SLUG_MAP.get(tab, tab)
        if wo_key is None:
            continue  # OO backstage tab -> covered by the File backstage section
        oo_btns = t.get("buttons", [])
        wo_tab = wo.get("tabs", {}).get(wo_key, {})
        wo_btns = wo_tab.get("buttons", []) if wo_tab else []
        # WO groups some OO top-level buttons into ribbon menus (Macros) —
        # menu rows count as tab-level match candidates (counted once).
        menu_rows = [
            {"label": i["label"]}
            for m in wo.get("menus", [])
            for i in m.get("items", [])
        ]
        gap = deficit(oo_btns, wo_btns + menu_rows)
        total_oo += len(oo_btns)
        total_wo += len(wo_btns)
        total_gap += len(gap)
        mark = "—" if wo_btns else f"**TAB ABSENT IN WO** (wo slug: {wo_key})"
        lines.append(
            f"- **{tab}** ({t.get('label', tab)}): OO {len(oo_btns)} vs WO {len(wo_btns)} controls — deficit {len(gap)} · {mark}"
        )
        for g in gap[:40]:
            lines.append(f"    - [ ] {g}")
        if len(gap) > 40:
            lines.append(f"    - … and {len(gap) - 40} more")
    oo_keys = {SLUG_MAP.get(t, t) for t in oo.get("tabs", {})}
    for tab, t in wo.get("tabs", {}).items():
        if tab not in oo_keys:
            lines.append(f"- **{tab}**: WO-only tab ({len(t.get('buttons', []))} controls, no OO counterpart)")
    lines.append("")

    # menus
    lines.append("## Dropdown menus")
    lines.append("")
    oo_menus = oo.get("menus") or []
    wo_menus = wo.get("menus") or []
    lines.append(f"OO menus captured: {len(oo_menus)} · WO menus captured: {len(wo_menus)}")
    for m in oo_menus:
        lines.append(f"- OO menu `{m.get('trigger')}` [{m.get('tab', '')}]: {len(m['items'])} rows")
        for i in m["items"][:25]:
            lines.append(f"    - {i['label']}")
        if len(m["items"]) > 25:
            lines.append(f"    - … and {len(m['items']) - 25} more")
    for m in wo_menus:
        lines.append(f"- WO menu `{m.get('trigger')}`: {len(m['items'])} rows")
    lines.append("")

    # context menu
    lines.append("## Context menu")
    lines.append("")
    oo_ctx = (oo.get("contextMenu") or {}).get("items") or []
    wo_ctx = (wo.get("contextMenu") or {}).get("items") or []
    gap = deficit(oo_ctx, wo_ctx)
    total_oo += len(oo_ctx)
    total_wo += len(wo_ctx)
    total_gap += len(gap)
    lines.append(f"OO {len(oo_ctx)} vs WO {len(wo_ctx)} items — deficit {len(gap)}")
    for g in gap:
        lines.append(f"- [ ] {g}")
    lines.append("")

    # backstage
    lines.append("## File backstage")
    lines.append("")
    oo_bs = oo.get("backstage") or []
    wo_bs = wo.get("backstage") or []
    gap = deficit(oo_bs, wo_bs)
    total_oo += len(oo_bs)
    total_wo += len(wo_bs)
    total_gap += len(gap)
    lines.append(f"OO {len(oo_bs)} vs WO {len(wo_bs)} items — deficit {len(gap)}")
    for g in gap:
        lines.append(f"- [ ] {g}")
    lines.append("")

    # status bar
    lines.append("## Status bar")
    lines.append("")
    oo_sb = oo.get("statusBar") or []
    wo_sb = wo.get("statusBar") or []
    gap = deficit(oo_sb, wo_sb)
    total_oo += len(oo_sb)
    total_wo += len(wo_sb)
    total_gap += len(gap)
    lines.append(f"OO {len(oo_sb)} vs WO {len(wo_sb)} items — deficit {len(gap)}")
    for g in gap[:30]:
        lines.append(f"- [ ] {g}")
    lines.append("")

    # right panel
    lines.append("## Right settings panel")
    lines.append("")
    oo_rp = oo.get("rightPanel") or {}
    wo_rp = wo.get("rightPanel") or {}
    wo_present = bool(wo_rp.get("present"))
    lines.append(
        f"OO panel sections: {len(oo_rp.get('openedSections') or [])} · WO panel: {'present' if wo_present else '**ABSENT**'}"
    )
    for s in (oo_rp.get("openedSections") or [])[:30]:
        lines.append(f"- {s}")
    lines.append("")

    lines.append("## Totals")
    lines.append("")
    lines.append(f"- OO surface rows: {total_oo} · WO: {total_wo} · item-level deficit: {total_gap}")
    lines.append("")

    OUT.write_text("\n".join(lines) + "\n")
    print(f"oo-deep-gap.md: OO {total_oo} vs WO {total_wo} rows, deficit {total_gap} -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
