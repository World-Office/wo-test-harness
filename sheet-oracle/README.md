# sheet-oracle — differential formula conformance

Truth = LibreOffice Calc evaluated headless (en-US locale, clean profile), a
*proxy* for OnlyOffice; known OO≠LO cases go in `divergences.json`
(`{"case.id": "justification"}`) so they stay loud.

```sh
/usr/bin/python3 sheet-oracle/oracle.py capture            # cases.yaml -> truth.json (needs soffice)
/usr/bin/python3 sheet-oracle/oracle.py cases              # -> cases.json for the Rust engine
/usr/bin/python3 sheet-oracle/oracle.py score engine.json  # exit 1 on any mismatch/missing
```

Engine contract: read `cases.json`, write `{"<id>": number|string|bool|"#ERR"}`.
Errors are normalized to `#ERR` (LO and OO name them differently by locale).
Growth path: generate cases from the OO function list (~450) until every
function has ≥1 case per arg-type class; the score then becomes the Rust calc
engine's definition of done.
