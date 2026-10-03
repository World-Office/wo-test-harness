# Docserver stack comparison — Rust (canonical) vs Python (reference)

Measured 2026-10-03 on the dev workstation (single sequential run window,
machine otherwise idle unless noted). Reproduce with:

```sh
cd server && cargo build --release -p wo-docserver     # ~49 s warm
cd ../wo-test-harness && WO_SERVER_DIR=$PWD/../server \
  /usr/bin/python3 census/ds-bench.py                  # writes census/ds-bench.json
```

Fidelity numbers come from the committed visual gates
(`reconcile.py --check --visual --docserver <mode>`); interaction parity from
`--interactions`. Both are re-runnable gates, not one-off measurements.

## 1. Raw measurements

| metric | Rust wo-docserver | Python opencloud-docserver | ratio |
|---|---|---|---|
| cold boot → first `200 /health` (p50, N=5) | **6 ms** | 490 ms | ~80× |
| steady RSS (VmHWM after warmup) | **10.9 MB** | 90.2 MB | ~8× |
| `/health` p50 (N=20) | **0.2 ms** | 0.5 ms | 2.5× |
| editor HTML p50 (N=20) | **0.3 ms** | 0.7 ms | 2.3× |
| doc bytes p50 (N=20) | 0.4 ms | **0.4 ms** | 1.0× |
| docx→html conversion p50 (N=5, 1.5 KB doc) | **0.3 ms** | 9.1 ms | ~30× |
| footprint | **11.0 MB** release binary | 416.7 MB venv / 72 site-packages | ~38× |
| full reconcile gate wall (`--check`, structural) | 11.0 s | 11.5 s | ~same |

Caveats, stated up front:

- The bench document is tiny (1.5 KB `demo.docx`); conversion latency scales
  with document size, so the 30× conversion ratio is a floor, not a law.
- Rust numbers are from the **release** binary (the deployed artifact). A
  debug build measures 23 MB RSS / 0.9 ms conversion — still ahead on every
  axis, but release is the honest comparison.
- Python `doc_bytes` (0.4 ms) reads from its local store; Rust's (0.4 ms)
  includes a proxy hop to the WOPI host. The tie is real: both are disk-bound.
- Gate wall time is browser-dominated (Playwright), so it measures the parity
  loop, not the server.

## 2. Fidelity & parity (from the committed gates)

| gate | Rust | Python |
|---|---|---|
| visual `image-gate` ink vs OO golden 26.4 % | **25.0 %** (Δ 1.4 pp) | 12.4 % (Δ 14.0 pp — renders images smaller) |
| visual `visual-gate` / `hf-gate` | OK | OK |
| interaction ledger | ok 38 / divergence 17 — **identical** | ok 38 / divergence 17 — identical |
| geometry controls | 121 (per-mode golden) | 122 |
| fx census (silent controls) | 0 | 0 |

Both stacks serve the same editor UI (the modals, ribbon, converters'
observable behavior are UI-level), which is why interaction parity is
byte-identical. The one measured fidelity gap — image ink coverage — favors
Rust: its wo-x2t converter emits embedded images at OO-comparable size
(25.0 % vs golden 26.4 %), while the Python converter's smaller rendering
(12.4 %) still passes its gate but under-covers by 14 percentage points.

## 3. Pros / cons — every claim carries its number

### Rust (canonical — what prod serves via `docserver-1` :8082)

**Pros**

1. **Cold boot 6 ms vs 490 ms** — container restarts are invisible (80×).
2. **RSS 10.9 MB vs 90.2 MB** — ~8× less memory per replica.
3. **Conversion 0.3 ms vs 9.1 ms p50** — wo-x2t native path, ~30× on this doc.
4. **Image fidelity 25.0 % vs 12.4 %** ink coverage against the same golden.
5. **11.0 MB single static binary vs 416.7 MB venv + 72 packages** — smaller
   attack surface, no interpreter dependency in the image.
6. Catches converter regressions the Python stack can't see: the rust-mode
   image-gate is what found wo-x2t dropping images entirely (ink 0.2 %).

**Cons**

1. Release build cost: 49 s warm (~minutes cold); Python iterates with no
   compile step.
2. Requires nightly toolchain (stable 1.94.1 ICEs wo-pdf/wo-webdav).
3. Still catching up on document *depth*: footnote/fldSimple round-trips are
   verbatim-carried (`raw_flds`/`footnotes_raw`), not edited structurally —
   the Python rewrite's line-granular pagination and header/footer page
   furniture remain the richer reference (see `server/AGENTS.md`).
4. Debug artifacts are heavy (191 MB debug binary) if you bench the wrong
   flavor.

### Python (reference — alive, no rot)

**Pros**

1. **0 compile step** — converter/UI experiments land in seconds.
2. Holds the deepest converter lineage (line pagination, page furniture up
   to commit `cf98bf78e`) — the design reference for future Rust work.
3. `doc_bytes` latency ties Rust (0.4 ms) — disk-bound reads are fine.
4. Keeps the dual-stack gates honest: every harness gate runs against it,
   so the Rust stack can never silently drift from a second implementation.

**Cons**

1. Cold boot 490 ms, RSS 90.2 MB, conversion 9.1 ms p50 — an order of
   magnitude behind on every server metric.
2. Image ink 12.4 % vs golden 26.4 % — the larger measured fidelity gap.
3. 416.7 MB venv / 72 site-packages to ship and patch (38× the Rust binary).
4. Deprecated direction: container stopped in prod; code kept as reference.

## 4. Verdict (measured)

The Rust stack is ahead on every server-side metric that matters at this
scale — boot, memory, conversion, footprint — and behind only on iteration
speed and un-ported document depth. Both stacks keep identical interaction
parity (38 ok / 17 declared divergence) because they serve the same editor;
the divergence set is UI-level debt, tracked in `interact-divergences.json`
and the harness register, not a stack difference.

Ratios will compress under real load (disk-bound endpoints already tie);
the conversion and boot advantages are architectural (native binary vs
interpreter + python-docx) and will hold.
