# scope — what "all of OnlyOffice in Rust" means, and how each part is verified

`scope.yaml` lists every surface (docx, xlsx calc/format/objects, pptx, pdf,
forms, diagram, conversion, collab, plugin API, fonts, security) with its
oracle and harness status (`live`/`partial`/`none`). `report.py` prints the
backlog; `--check` fails if a `live` surface points at a path that doesn't exist.
Work the `none` rows top-down: each needs an oracle + a scorer before Rust work
on that surface can be called done.
