#!/usr/bin/env python3
"""Ledger gap triage: advisory AI classification of the OO->WO parity debt.

Adapted from the spec-generation phase of SOTA AI software-cloning pipelines
(Morph, ai-site-cloner): measured recon (the census ledgers) -> classified,
prioritized copy specs -> human promotes real work into the register. The
census ledgers ARE the measured recon; this script is the missing spec layer.

Gap sources (all measured, none re-derived):
- ledger.json          statuses: deferred, UNMATCHED, MISSING-STUB,
                       STALE-DEFERRED, stub
- interact-ledger.json classes:  missing, unmatched, divergence
- census-diff.py MAP   rows declared {"deferred": reason} (parsed from source;
                       these can be absent from the ledger when the OO token
                       is not in the current OO capture)

Doctrine (non-negotiable):
- ADVISORY ONLY: never edits MAP, ledger, register, features.yaml, or any
  gate. Promotion is a human act (recapture-as-PR).
- Honest classes: the model must be able to say "intentional-divergence,
  leave it" or "census-artifact, fix the census not the editor" -- the
  report is a triage, not a work order.
- Strict rubric, JSON-only, temperature 0. Loud SKIPPED without a key.

Usage:
  ledger-gap.py [--out-dir census/census] [--chunk 40]
  ledger-gap.py --self-test        # offline plumbing check, no network
"""
import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CENSUS = HERE / "census"

RUBRIC = """You are a senior engineer triaging the parity debt of a document editor
(World-Office, a from-scratch editor replicating OnlyOffice's OOXML feature
surface). For each gap row below, classify it and draft a minimal copy spec.

Classify as exactly one:
- missing-feature: WO does not ship the capability; a real user-facing gap
- divergent-behavior: same intent, different result (e.g. OO opens a dialog
  with options, WO applies a direct toggle with no options)
- intentional-divergence: a WO-native design choice that is fine to keep;
  should at most be declared in interact-divergences.json
- census-artifact: the row is noise from measurement/pairing (e.g. the WO
  button exists but was not in the interaction census) -- fix the census,
  not the editor

For every row also give:
- user_value: high | medium | low      (does a real document user care?)
- effort: S | M | L | XL               (S=tweak, XL=new subsystem)
- priority: 1-5                        (1 = do first; census-artifacts and
                                        intentional divergences get 4-5)
- spec: 1-3 sentences, the minimal build path in World-Office terms: which
  surface (React editor component, wo-command in lib/word-commands.ts,
  vanilla editor apps/web, docserver route/services, wasm renderer) and
  what it must do. No boilerplate, no acceptance criteria essays.
- first_step: one concrete first action (file to open, dialog to add,
  census row to fix)

Return JSON only, no prose:
{"gaps": [{"token": "<same token>", "gap_class": "<one of four>",
  "user_value": "...", "effort": "...", "priority": <int>,
  "spec": "...", "first_step": "..."}]}
Every input token must appear exactly once."""

PROVIDERS = [
    ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", "google/gemini-2.5-flash"),
    ("GROQ_API_KEY", "https://api.groq.com/openai/v1", "meta-llama/llama-4-scout-17b-16e-instruct"),
    ("GOOGLE_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-2.5-flash"),
]

GAP_STATUSES = {"deferred", "UNMATCHED", "MISSING-STUB", "STALE-DEFERRED", "stub"}
GAP_CLASSES = {"missing", "unmatched", "divergence"}


def resolve_provider():
    import os
    if os.environ.get("VISION_API_KEY"):
        return (os.environ.get("VISION_API_BASE", "https://openrouter.ai/api/v1"),
                os.environ["VISION_API_KEY"],
                os.environ.get("VISION_MODEL", "google/gemini-2.5-flash"))
    for var, base, model in PROVIDERS:
        if os.environ.get(var):
            return base, os.environ[var], os.environ.get("VISION_MODEL", model)
    return None


def collect_gaps() -> list[dict]:
    """Measured gap rows from the three sources; no re-derivation."""
    gaps: list[dict] = []
    led = CENSUS / "ledger.json"
    if led.exists():
        for r in json.loads(led.read_text()).get("ledger", []):
            if r.get("status") in GAP_STATUSES:
                gaps.append({"source": "ledger", "token": r.get("token") or r.get("id"),
                             "tab": r.get("tab"), "oo": r.get("label"),
                             "status": r.get("status"), "reason": r.get("reason") or r.get("deferred"),
                             "wo": r.get("wo"), "note": r.get("note")})
    il = CENSUS / "interact-ledger.json"
    if il.exists():
        rows = json.loads(il.read_text())
        rows = rows if isinstance(rows, list) else rows.get("rows") or rows.get("ledger") or []
        for r in rows:
            if (r.get("class") or r.get("status")) in GAP_CLASSES:
                gaps.append({"source": "interact", "token": r.get("token"),
                             "tab": r.get("tab"), "oo": r.get("oo"),
                             "status": (r.get("class") or r.get("status")),
                             "opens_oo": r.get("opens_oo"), "opens_wo": r.get("opens_wo"),
                             "wo_id": r.get("wo_id"), "wo_cmd": r.get("wo_cmd"),
                             "note": r.get("note")})
    src = (HERE / "census-diff.py").read_text()
    for tok, reason in re.findall(r'"([^"]+)":\s*\{"deferred":\s*"([^"]+)"\}', src):
        gaps.append({"source": "map-deferred", "token": tok, "status": "deferred",
                     "reason": reason, "note": "declared in census-diff.py MAP"})
    # dedupe: interact + map sources can carry the same token
    seen, out = set(), []
    for g in gaps:
        k = g["token"]
        if k not in seen:
            seen.add(k)
            out.append(g)
    return out


def call_model(base, key, model, prompt):
    body = json.dumps({"model": model, "temperature": 0, "max_tokens": 4000,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(f"{base.rstrip('/')}/chat/completions", data=body,
                                 headers={"Authorization": f"Bearer {key}",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)["choices"][0]["message"]["content"]


def parse_verdict(raw: str) -> dict:
    txt = raw.strip()
    if txt.startswith("```"):
        txt = txt.strip("`").lstrip("json").strip()
    v = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
    v.setdefault("gaps", [])
    return v


def chunked(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def run(out_dir: Path, chunk: int) -> int:
    prov = resolve_provider()
    gaps = collect_gaps()
    print(f"ledger-gap: {len(gaps)} measured gap rows "
          f"(ledger + interact + map-deferred)")
    if not gaps:
        print("ledger-gap: no parity debt found — nothing to triage")
        return 0
    if prov is None:
        print("ledger-gap: SKIPPED (no vision/API key: VISION_API_KEY / "
              "OPENROUTER_API_KEY / GROQ_API_KEY / GOOGLE_API_KEY) — debt rows listed above")
        return 0
    base, key, model = prov
    verdicts = []
    try:
        for part in chunked(gaps, chunk):
            prompt = (RUBRIC + "\n\nGap rows (JSON lines):\n" +
                      "\n".join(json.dumps(g) for g in part))
            verdicts.extend(parse_verdict(call_model(base, key, model, prompt))["gaps"])
    except Exception as e:
        print(f"ledger-gap: ERROR (advisory only): {e}")
        return 0
    by_tok = {v.get("token"): v for v in verdicts}
    merged = [{**g, **by_tok.get(g["token"], {})} for g in gaps]
    merged.sort(key=lambda m: int(m.get("priority", 5)))
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "ledger-gap.json").write_text(json.dumps(
        {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
         "model": model, "rows": merged}, indent=1))
    md = [f"# Parity gap report (AI advisory)\n",
          f"generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')} · model: {model}",
          f"sources: ledger.json + interact-ledger.json + MAP deferrals · {len(merged)} rows",
          "ADVISORY: promotion into MAP/register is a human act. Nothing here edits a gate.\n"]
    from collections import defaultdict
    by_p = defaultdict(list)
    for m in merged:
        by_p[int(m.get("priority", 5))].append(m)
    for p in sorted(by_p):
        md.append(f"\n## Priority {p}\n")
        for m in by_p[p]:
            md.append(f"### {m['token']} — {m.get('gap_class', '?')}"
                      f" ({m.get('tab') or '-'} tab, {m.get('source')})")
            ctx = m.get("note") or (f"OO opens {m.get('opens_oo')}, WO {m.get('opens_wo')}"
                                    if m.get("opens_oo") else m.get("reason"))
            md.append(f"- context: {m.get('status')} · {ctx}")
            md.append(f"- value {m.get('user_value', '?')} · effort {m.get('effort', '?')}")
            if m.get("spec"):
                md.append(f"- spec: {m['spec']}")
            if m.get("first_step"):
                md.append(f"- first step: {m['first_step']}")
            md.append("")
    (out_dir / "ledger-gap.md").write_text("\n".join(md))
    print(f"ledger-gap: {len(verdicts)}/{len(gaps)} triaged by {model}  [ADVISORY — no gate touched]")
    for m in merged[:8]:
        print(f"    p{m.get('priority', '?')} {m.get('gap_class', '?'):22} {m['token']}"
              f"  ({m.get('user_value', '?')}/{m.get('effort', '?')})")
    print(f"    report: {out_dir / 'ledger-gap.md'}")
    return 0


def self_test() -> int:
    canned = ('```json\n{"gaps": [{"token": "smartart", "gap_class": "missing-feature",'
              '"user_value": "medium", "effort": "L", "priority": 2, "spec": "Wire btn-smartart '
              'to a gallery modal in the React editor.", "first_step": "Add SmartArtGallery '
              'component."}]}\n```')
    v = parse_verdict(canned)
    assert v["gaps"][0]["token"] == "smartart" and v["gaps"][0]["priority"] == 2
    sloppy = parse_verdict('Here you go:\n{"gaps": []}')
    assert sloppy["gaps"] == []
    gaps = collect_gaps()
    toks = [g["token"] for g in gaps]
    assert len(toks) == len(set(toks)), "dedupe failed"
    assert any(g["source"] == "map-deferred" for g in gaps), "MAP deferrals not parsed"
    assert any(g["source"] == "interact" for g in gaps), "interact gaps not collected"
    print(f"ledger-gap: self-test OK (2 parse cases, dedupe, {len(gaps)} measured gap rows)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(CENSUS), help="where to write ledger-gap.{json,md}")
    ap.add_argument("--chunk", type=int, default=40, help="gap rows per model call")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    return run(Path(a.out_dir), a.chunk)


if __name__ == "__main__":
    sys.exit(main())
