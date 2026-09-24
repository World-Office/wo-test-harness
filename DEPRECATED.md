# wo-test-harness — DEPRECATED (Python-era, kept as reference)

> ⚠️ **DEPRECATED 2026-09-24.** This parity/census/visual-gate harness measures the
> **Python docserver** (`server/opencloud-docserver/`), which is itself deprecated
> (prod editor = Rust docserver on `:8082`, container `docserver-1`). Every rig here
> boots uvicorn → `src.main:create_app` and screenshots `${BASE}/editor/{doc}` —
> the Python editor page — so its numbers describe a backend that no longer serves
> traffic.
>
> What stays valuable:
> - the **methodology**: geometry census, interaction census, loud-stub gate,
>   LO-golden pixel gate with honest flood-line baselines (`golden/docs/baselines.json`)
> - the **goldens**: `golden/docs/*.docx` + LO renders are engine-agnostic inputs
>   and can be re-baselined against any renderer
>
> Decision recorded 2026-09-24: **mark Python-era, do not retarget** (option 2).
> A future Rust harness should copy the rig pattern but mint WOPI sessions against
> the collaboration shell instead of spawning a local docserver.

## Original layout (unchanged)

- `census/` — census scripts + `reconcile.py` (orchestrator), `pixel-diff.py` (visual gate)
- `census/golden/docs/` — committed golden documents, LO renders, baselines
- see `census/README.md` for per-script usage
