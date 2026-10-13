# Strangler Fig: OnlyOffice DocumentServer → World-Office Rust

**Ja, der Strangler Fig ist der richtige Weg — und er steht bereits.**

## Wo die Fassade heute schon steht

OnlyOffice-Code im Baum = der DocumentServer-Fork in `server/services/server/`
(DocService, FileConverter/x2t, SpellChecker — Node.js, AGPL). Die Fassade ist
die **DocumentServer-API-Fläche**, die OCIS/WOPI-Clients sehen:

```
OCIS / WOPI-Clients
        │  (gleiche URLs wie beim OO DocumentServer)
        ▼
documentserver-Container  ←── DIE FASSADE (JWT, /hosting/discovery, /wopi/*)
        │  heute schon: worldoffice-documentserver = wo-docserver (Rust)
        ├── /hosting/discovery, /wopi/*        → wo-docserver (Rust)
        ├── /api/conversion/*                  → wo-x2t ConversionRouter (Rust,
        │                                        ersetzt X2tConverter, 38 C++-Files)
        ├── /ws/{session} (Collab)             → coauthoring-service (Rust)
        ├── editor-Bundles word/sheet/slide/…  → eigene UIs (word: wysiwyg, Rest: react)
        └── /command, SpellChecker-WS          → noch OO-Node-Referenz (services/server)
```

Der Fig ersetzt also nicht „irgendwann alles auf einmal", sondern **je
Capability**: Legacy bleibt hinter der Fassade, bis das Orakel grün ist.

## Der Cutover-Orakel (dieses Verzeichnis)

- `capabilities.json` — das Port-Inventar: OO-Referenz ↔ Rust-Impl ↔ Oracle je Capability
- `fig-check.cjs` — bootet den Rust docserver (über `server/tests/parity/_boot.cjs`), probt jede Capability live, verknüpft die Oracles aus dem bestehenden Harness:
  - `http` — Live-Probe (Schema-Verhalten: discovery-XML mit apps, JSON-Formen, Bundles)
  - `parity-contracts` — L2-Verträge aus `server/tests/parity/contract-results.json` (word-UI: 6 pass / 0 fail)
  - `census` — UI-Marker-Census (`census/legacy/`)
  - `golden` — byte/semantic compare gegen OO-Referenz-Outputs (`census/capture-oo-goldens.py`) — **noch anzubinden**
- States: `legacy` (OO canonical) → `shadow` (Rust serviert, Oracle offen) → `canonical` (Oracle grün, Legacy abschaltbar). `blocked` = Rust-Probe rot.
- `run-fig.sh` — einmal pro Nacht/PR; Report: `plan/FIG_STATUS.md`

## Regeln (damit der Fig nicht fault)

1. **Keine Capability wird canonical ohne Orakel.** „Läuft ja" zählt nicht.
2. **Die Fassade ist unveränderlich** — OCIS/WOPI-Client-Verträge (JWT, URL-Formen,
   XML-Schema) brechen nie; nur dahinter wird getauscht.
3. **Rollback = Git**, kein Doppelbetrieb im Prod (Shadow läuft nur im Test-Stack).
4. **Oracle-Schulden sind Port-Schulden**: jede Capability mit `oracle: none` ist
   offene Arbeit, geführt in `plan/FIG_STATUS.md`.

## Nächste Oracles nach Priorität

1. `conversion-convert` — golden pipeline anbinden (OO x2t-Referenz-Outputs vs. wo-x2t; Normalisierung: Metadaten strippen, Content semantic-diffen)
2. `collab-ws` — Op-Äquivalenz (gleiche Edit-Sequenz → gleicher finaler Dokumentzustand via coauthoring /sessions)
3. `editor-ui-sheet/slide/pdf` — Census + Contracts auf die react-UIs erweitern (word-Muster wiederverwenden: `census-react.cjs` existiert)
4. `command-service` — erst Rust-Impl bauen (klein: forcesave/info), dann Orakel
