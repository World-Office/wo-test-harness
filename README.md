> ⚠️ **DEPRECATED 2026-09-24 — see ../DEPRECATED.md.** Measures the deprecated Python docserver; methodology + goldens remain reusable.

# wo-test-harness

Cross-engine conformance harness and feature-register tooling for
**World-Office**.

This repository hosts the test infrastructure that lives **outside** the
World-Office production source repo (`World-Office/server`):

| Unit | Purpose |
|------|---------|
| `conformance/` | `wo-conformance` crate — corpus of real `.docx` files, entropy test-driver, scoring model, and cross-engine comparison (wo-docx-renderer vs LibreOffice). |
| `conformance-docx/` | `wo-conformance-docx` crate — `DocxConformanceAdapter` that projects `wo-docx-renderer`'s layout into `NormalizedRender` for scoring. Ships the `wo-render-ir` binary. Git-depends on the server repo. |
| `harness-graph/` | Feature register → test graph tooling (`features.yaml`, `seed.py`, `select-tests.py`, `check-register.py`). The 82 stable `F-###` feature ids live here. |
| `tf-test-harness/` | The unified shell test orchestrator (`test-harness.sh`) plus test-generation and coverage tooling. |

## Why a separate repo

The harness is **not** part of the production docserver source tree. Keeping
it here:

- production crates (`wo-docx-renderer`) no longer carry conformance code;
- the register (`F-###` ids) is versioned independently of product code;
- CI drift gates (`seed.py --check`) run against `World-Office/server` from a
  cross-repo checkout.

## Path resolution contract

Moved scripts locate the server checkout via the **`WO_SERVER_DIR`** env var,
with a fallback chain:

1. `WO_SERVER_DIR` (explicit)
2. sibling `../server` checkout next to this repo
3. legacy in-repo layout → hard `SystemExit` (point the env var)

`e2e` tests on the server side read the register/toolbar graph via
**`WO_HARNESS_GRAPH`** and the corpus via **`WO_CONFORMANCE_CORPUS`** with the
same sibling-fallback.

## Quick start

```sh
# Feature register drift gate against a server checkout
WO_SERVER_DIR=/path/to/World-Office/server python3 harness-graph/seed.py --check

# Unified harness self-test (register, corpus, unit, selection)
WO_SERVER_DIR=/path/to/World-Office/server bash tf-test-harness/test-harness.sh --self-test

# Cross-engine render comparison (conformance + conformance-docx)
cd conformance && ./scripts/run-pipeline.sh <corpus-cases-dir>
```

## Conformance

`conformance-docx` git-depends on the server repo's `wo-docx-renderer` and
`wo-ooxml` crates (`branch = "main"`). Building it clones the server repo;
the `scripts/taskfleet` submodule in that repo must therefore be fetchable
(any force-push of that private history breaks the build).

See `conformance/README.md` for the full scoring/regression workflow and
`conformance/scripts/onlyoffice-image.env` for the OnlyOffice oracle runs.

## CI

`.github/workflows/conformance.yml` runs:

- `unit-tests` — `cargo test -p wo-conformance`;
- `harness-graph` — cross-repo server checkout + `seed.py --check` drift gate;
- `cross-engine-fidelity` — builds `wo-render-ir`, renders the corpus,
  checks fidelity/regression thresholds;
- `onlyoffice-oracle` — OnlyOffice Document Server oracle comparison.

## License

AGPL-3.0-or-later (moved verbatim from the World-Office server repo; the
corpus `.docx` files are generated fixtures).
