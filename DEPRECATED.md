# wo-test-harness — historical decision record (Python-era deprecation, SUPERSEDED)

> **SUPERSEDED 2026-10-04.** The 2026-09-24 decision below ("mark Python-era,
> do not retarget") was overtaken by events: the harness now boots the
> **Rust docserver** as its default mode (`reconcile.py --docserver rust`),
> censuses the React editor (`census-react.cjs`), and mints real WOPI sessions
> against the live collaboration shell (`fx-prod.cjs`) — exactly the "future
> Rust harness" this note called for. The Python mode remains a reconciliation
> surface until sunset (DUAL-STACK-VERIFIED). Kept as an audit record; the
> current state is described in `README.md` and `docs/arc42/`.

---

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
