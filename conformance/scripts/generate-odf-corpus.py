#!/usr/bin/env python3
"""Generate ODF (ODT/ODS/ODP) corpus cases.

ODT cases are LibreOffice conversions of the matching DOCX cases (same
content → cross-format fidelity compares). ODS/ODP are hand-built minimal
OpenDocument packages (like generate-corpus.py does for docx) so no external
app is needed during generation.

Usage:
    /usr/bin/python3 generate-odf-corpus.py <cases-dir>
"""
import zipfile
from pathlib import Path
import shutil
import subprocess
import sys
import os

TEXT_NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
TABLE_NS = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
OFFICE_NS = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"

ODT_NAMESPACES = (
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
    'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" '
    'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" '
    'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"'
)

MANIFEST = '<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>'
MANIFEST_ODS = MANIFEST.replace('application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet')
MANIFEST_ODP = MANIFEST.replace('application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.presentation')

CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>'


def _write_odf(path, mimetype, content_xml):
    """Minimal ODF package: mimetype (stored, first) + manifest + content."""
    mf = {
        "application/vnd.oasis.opendocument.text": MANIFEST,
        "application/vnd.oasis.opendocument.spreadsheet": MANIFEST_ODS,
        "application/vnd.oasis.opendocument.presentation": MANIFEST_ODP,
    }[mimetype]
    ct = mf  # content-types manifest == manifest for these minimal packages
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), mimetype, compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/manifest.xml", mf)
        z.writestr("content.xml", content_xml)


def odt_body(paras):
    """paras: list of (text, align, spacing_after_twips) or just str."""
    out = []
    for p in paras:
        if isinstance(p, str):
            text, align, after = p, None, None
        else:
            text, align, after = p
        style = 'style:page-layout-name="PM1"'
        props = []
        if align:
            props.append(f'fo:text-align="{align}"')
        if after:
            props.append(f'fo:margin-bottom="{after / 20.0:.2f}pt"')
        sprops = (' <style:paragraph-properties ' + " ".join(props) + "/>") if props else ""
        out.append(f'<text:p{style}>{text}</text:p>')
    return "".join(out)


def gen_odt(out_dir):
    # Mirror the docx geometry cases so cross-format fidelity compares.
    # LO converts each source to <same-stem>.odt; rename to a distinct
    # NN-odt-* stem so docx/odt goldens never collide on the same stem.
    docx_src = {
        "31-odt-alignment": ["12-centered.docx"],
        "32-odt-spacing": ["23-paragraph-spacing.docx"],
        "33-odt-wrapping": ["27-long-line-wrapping.docx"],
        "37-odt-right": ["13-right-aligned.docx"],
        "38-odt-justified": ["14-justified.docx"],
        "39-odt-basic": ["01-single-paragraph.docx"],
    }
    for name, srcs in docx_src.items():
        parts = []
        for s in srcs:
            p = out_dir / s
            if p.exists():
                parts.append(str(p))
        if not parts:
            continue
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            r = subprocess.run(
                ["soffice", "--headless", "--convert-to", "odt", "--outdir", td, *parts],
                capture_output=True, text=True, env={**os.environ, "HOME": "/tmp"},
            )
            tmp_odts = sorted(Path(td).glob("*.odt"))
            if not tmp_odts:
                print(f"  {name}.odt FAILED: {r.stderr[-300:]}", file=sys.stderr)
                continue
            (out_dir / f"{name}.odt").write_bytes(tmp_odts[0].read_bytes())
            print(f"  {name}.odt (LO convert {srcs[0]})")

    # A purely hand-built ODT as a parser-level cross-check (no LO dependency).
    hand = out_dir / "34-odt-handbuilt.odt"
    xml = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<office:document-content {ODT_NAMESPACES} office:version="1.2">'
        f"<office:body><office:text>"
        f'{odt_body(["Hand-built ODT paragraph one.", "Second paragraph with bold.", ("Centered line.", "center", None)])}'
        f"</office:text></office:body></office:document-content>"
    )
    _write_odf(hand, "application/vnd.oasis.opendocument.text", xml)
    print("  34-odt-handbuilt.odt")


def gen_ods(out_dir):
    ods = out_dir / "35-ods-basic.ods"
    xml = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<office:document-content {ODT_NAMESPACES} office:version="1.2">'
        f"<office:body><office:spreadsheet>"
        f'<table:table table:name="Sheet1">'
        f'<table:table-row><table:table-cell office:value-type="string"><text:p>A1</text:p></table:table-cell>'
        f'<table:table-cell office:value-type="float" office:value="42"><text:p>42</text:p></table:table-cell></table:table-row>'
        f'<table:table-row><table:table-cell office:value-type="string"><text:p>label</text:p></table:table-cell>'
        f'<table:table-cell office:value-type="float" office:value="7.5"><text:p>7.5</text:p></table:table-cell></table:table-row>'
        f"</table:table>"
        f"</office:spreadsheet></office:body></office:document-content>"
    )
    _write_odf(ods, "application/vnd.oasis.opendocument.spreadsheet", xml)
    print("  35-ods-basic.ods")


def gen_odp(out_dir):
    odp = out_dir / "36-odp-basic.odp"
    xml = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<office:document-content {ODT_NAMESPACES} office:version="1.2">'
        f"<office:body><office:presentation><draw:page xmlns:draw=\"urn:oasis:names:tc:opendocument:xmlns:drawing:1.0\" draw:name=\"Slide1\" draw:style-name=\"dp1\">"
        f'<text:p>{odt_body(["Presentation slide one"])}</text:p>'
        f"</draw:page>"
        f"</office:presentation></office:body></office:document-content>"
    )
    _write_odf(odp, "application/vnd.oasis.opendocument.presentation", xml)
    print("  36-odp-basic.odp")


def main():
    if len(sys.argv) != 2:
        print("usage: generate-odf-corpus.py <cases-dir>")
        sys.exit(2)
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    gen_odt(out_dir)
    gen_ods(out_dir)
    gen_odp(out_dir)
    print(f"done -> {out_dir}")


if __name__ == "__main__":
    main()
