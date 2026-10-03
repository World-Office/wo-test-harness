#!/usr/bin/env python3
"""Visual triage: advisory vision-LLM escalation for pixel-gate FAILURES.

Adapted from the two-stage verification pattern used by SOTA AI-cloning
pipelines (ui-clone-skills Phase E, sdet.qa multimodal rubric, agentic
diff-triage writeups): the deterministic pixel gate (pixel-diff.py) stays
the ONLY gate; when it FAILS, this script asks a vision model whether the
mismatch is a real broken render or cross-engine cosmetics (AA, hinting,
margins) — the triage a human otherwise eyeballs.

Doctrine (non-negotiable):
- ADVISORY ONLY: exit code is always 0 (2 on usage error). Triage never
  flips a gate, never approves a baseline, never weakens reconcile.py.
- Loud skip over silent stub: no API key -> prints SKIPPED, writes nothing.
- Strict rubric: closed defect list + explicit ignore list + JSON-only
  output + temperature 0 (determinism first). Confidence is reported so a
  human can weight it; nothing is auto-acted-on.

Provider: any OpenAI-compatible chat/completions endpoint. Resolution
order: VISION_API_KEY(+VISION_API_BASE/VISION_MODEL) -> OPENROUTER_API_KEY
-> GROQ_API_KEY -> GOOGLE_API_KEY (their OpenAI-compat bases).

Usage:
  visual-triage.py --wo <wo.png> --gold <golden.png> [--out visual-triage.json]
  visual-triage.py --self-test        # offline plumbing check, no network
"""
import argparse
import base64
import io
import json
import os
import sys
import urllib.request
from pathlib import Path

RUBRIC = """You are a strict QA reviewer comparing two renders of the SAME document.
IMAGE 1 is the reference render; IMAGE 2 is the editor render under test.
Decide whether IMAGE 2 is BROKEN in a way a real user would notice.

Flag as broken ONLY these defect types:
- blank: page mostly empty; text blocks / whole paragraphs / headings missing
- garbled: unreadable glyphs, tofu boxes, text overlapping text
- collapsed: layout structure lost — columns merged into one, table rows or
  borders collapsed, list hierarchy flattened, headings inline with body
- clipped: content cut off mid-block (not the natural page edge)
- misrender: an image/shape/table the reference shows is missing or drawn wrong

Do NOT flag: font family or hinting differences, anti-aliasing, sub-pixel or
1-3px shifts, margin drift, color-shade tweaks, spacing that differs slightly.
Both engines render the same document; minor cross-engine drift is expected.

Return JSON only, no prose:
{"broken": true|false, "confidence": "high"|"medium"|"low",
 "defects": [{"type": "<one of the five>", "location": "<where>", "detail": "<what>"}]}
Cite a specific location for every defect. If nothing qualifies, broken=false."""

# (key env var, default base url, default model) — first present key wins.
PROVIDERS = [
    ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", "google/gemini-2.5-flash"),
    ("GROQ_API_KEY", "https://api.groq.com/openai/v1", "meta-llama/llama-4-scout-17b-16e-instruct"),
    ("GOOGLE_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-2.5-flash"),
]
MAX_W = 900  # downscale to comparison width before spending vision tokens


def resolve_provider():
    """-> (base, key, model) or None if no credential is available."""
    if os.environ.get("VISION_API_KEY"):
        base = os.environ.get("VISION_API_BASE", "https://openrouter.ai/api/v1")
        return base, os.environ["VISION_API_KEY"], os.environ.get("VISION_MODEL", "google/gemini-2.5-flash")
    for var, base, model in PROVIDERS:
        if os.environ.get(var):
            return base, os.environ[var], os.environ.get("VISION_MODEL", model)
    return None


def image_part(png: Path):
    """Downscale to MAX_W (JPEG q85, vision tokens are the budget) -> content part."""
    data = png.read_bytes()
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data)).convert("RGB")
        if img.width > MAX_W:
            img = img.resize((MAX_W, round(img.height * MAX_W / img.width)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=85)
        data = buf.getvalue()
        media = "image/jpeg"
    except Exception:
        media = "image/png"
    return {"type": "image_url",
            "image_url": {"url": f"data:{media};base64,{base64.b64encode(data).decode()}"}}


def call_model(base, key, model, parts):
    body = json.dumps({
        "model": model,
        "temperature": 0,
        "max_tokens": 600,
        "messages": [{"role": "user", "content":
                      [{"type": "text", "text": RUBRIC},
                       {"type": "text", "text": "IMAGE 1 (reference):"}, parts[0],
                       {"type": "text", "text": "IMAGE 2 (under test):"}, parts[1]]}],
    }).encode()
    req = urllib.request.Request(
        f"{base.rstrip('/')}/chat/completions", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.load(r)
    return out["choices"][0]["message"]["content"]


def parse_verdict(raw: str):
    """Model text -> verdict dict; tolerant of ```json fences."""
    txt = raw.strip()
    if txt.startswith("```"):
        txt = txt.strip("`").lstrip("json").strip()
    start, end = txt.find("{"), txt.rfind("}")
    v = json.loads(txt[start:end + 1])
    v.setdefault("broken", False)
    v.setdefault("confidence", "low")
    v.setdefault("defects", [])
    return v


def triage(wo: Path, gold: Path, out: Path | None) -> int:
    prov = resolve_provider()
    if prov is None:
        print("visual-triage: SKIPPED (no vision API key: VISION_API_KEY / "
              "OPENROUTER_API_KEY / GROQ_API_KEY / GOOGLE_API_KEY) — pixel gate verdict stands")
        return 0
    base, key, model = prov
    try:
        parts = [image_part(gold), image_part(wo)]
        raw = call_model(base, key, model, parts)
        v = parse_verdict(raw)
    except Exception as e:
        print(f"visual-triage: ERROR (advisory only, gate unchanged): {e}")
        return 0
    line = (f"visual-triage: {wo.name} vs {gold.name}  "
            f"broken={v['broken']}  confidence={v['confidence']}  "
            f"defects={len(v['defects'])}  model={model}  [ADVISORY — gate unchanged]")
    print(line)
    for d in v["defects"][:5]:
        print(f"    - {d.get('type')}: {d.get('location')}: {d.get('detail')}")
    if out:
        out.write_text(json.dumps({"wo": str(wo), "gold": str(gold), "model": model, **v},
                                  indent=2))
        print(f"    verdict written: {out}")
    return 0


def self_test() -> int:
    """Offline plumbing check: rubric parsing on canned model outputs."""
    ok_break = parse_verdict('```json\n{"broken": true, "confidence": "high", '
                             '"defects": [{"type": "collapsed", "location": "page 1 table", '
                             '"detail": "rows merged"}]}\n```')
    assert ok_break["broken"] is True and ok_break["confidence"] == "high"
    assert ok_break["defects"][0]["type"] == "collapsed"
    ok_clean = parse_verdict('{"broken": false}')
    assert ok_clean["broken"] is False and ok_clean["defects"] == [] and ok_clean["confidence"] == "low"
    sloppy = parse_verdict('Sure! Here is the JSON:\n{"broken": true, "confidence": "medium", "defects": []}')
    assert sloppy["broken"] is True  # prose-wrapped still parses
    assert "blank" in RUBRIC and "Do NOT flag" in RUBRIC
    print("visual-triage: self-test OK (3 parse cases + rubric sanity)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wo", help="WO editor screenshot png (under test)")
    ap.add_argument("--gold", help="reference golden png")
    ap.add_argument("--out", help="optional path for the verdict json artifact")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    if not a.wo or not a.gold:
        ap.error("--wo and --gold are required (or --self-test)")
        return 2
    wo_p, gold_p = Path(a.wo), Path(a.gold)
    if not wo_p.exists() or not gold_p.exists():
        print(f"visual-triage: missing input ({wo_p} / {gold_p})")
        return 2
    return triage(wo_p, gold_p, Path(a.out) if a.out else None)


if __name__ == "__main__":
    sys.exit(main())
