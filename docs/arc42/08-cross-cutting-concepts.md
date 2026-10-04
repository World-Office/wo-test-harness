# 8. Cross-cutting Concepts

## Honest parity & fidelity vocabulary

`parity: full|partial|missing|deferred…` + `fidelity: L1..L4` on every
register row; divergences carry `ref` + `justification`. F-tags (`F-###`) are
the join key across register, ledgers, tests, and module docstrings in server
code.

## Loud failure over silent stub

- A census reporting zero rows for a known surface = gate failure (menu-file
  trigger regression guard).
- A control with no observable effect = `silent`/`unclickable` = exit 1.
- A MAP row declaring `deferred` while the WO census ships the real control =
  STALE-DEFERRED = exit 1.
- Advisory LLM layers print loud `SKIPPED` lines without keys — never
  silently pass.

## Deliberate recapture (recapture-as-PR)

Committed artifacts are re-derived only by explicit flows (`seed.py`,
reconcile promotion, rig refresh), never by gates. Gates compare; they do not
write.

## Environment contracts

| Var | Meaning |
|-----|---------|
| `WO_SERVER_DIR` | server checkout (env → sibling → exit) |
| `CENSUS_OUT` | write census JSON to a path (reference refresh) |
| `CENSUS_WO_URL` | point census at an already-running editor (no spawn) |
| `AI_CONTRACTS_MCP_CALL=1` + `STORAGE_SERVICE_URL` | enable the MCP integration tier |
| `WO_HARNESS_GRAPH` / `WO_CONFORMANCE_CORPUS` | server-side e2e reading back into this repo |

## Capture determinism (Playwright doctrine)

- REAL clicks (`page.click`), never synthetic `mousedown` for click-wired
  toggles; page-side logic as real functions, never strings.
- Preserve the button id; a surface identical to the previous row is a sticky
  leftover, not a fresh open.
- Editor quirks are part of the contract: file menu opens on **click**,
  React FileMenu asserts `.de-file-menu-panel`, OO backstage =
  `a#file[data-tab="file"]` → `#file-menu-panel`, `li.fm-btn` ids.

## Secrets & safety

- Keys only in env (vision/LLM advisory layers are no-ops without them);
  `/usr/bin/python3` explicit everywhere; `py_compile` before committing
  moved scripts; destructive ops follow the destructive-safeguards skill.
