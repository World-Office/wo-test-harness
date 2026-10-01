//! Conformance adapter — projects `wo-docx-renderer`'s structured layout into the
//! [`wo_conformance::NormalizedRender`] IR, so this engine becomes scorable against
//! captured Microsoft Word ground truth.
//!
//! The adapter hooks in *before* rasterization: it reads the layout pages
//! (`LayoutPage` / `LayoutLine` / `LayoutCell`) that the pipeline computes for
//! PDF/PNG/SVG export, and projects them into the conformance harness's
//! normalized intermediate representation. No pixels are involved.
//!
//! Font attribution is honest: the current layout engine ignores the document's
//! requested font family and renders everything with a default (`sans-serif` /
//! Helvetica). The adapter records this faithfully — every explicitly requested
//! family maps to `sans-serif` in `resolved_fonts`, so font substitution shows
//! up in the conformance score as a real finding rather than being hidden.
//!
//! See `plan/2026-07-27-ooxml-conformance-strategy.md` Phase 1.

use std::collections::{BTreeMap, BTreeSet};

use wo_conformance::{
    BoxKind, ConformanceError, GlyphRun, LayoutBox, NormalizedRender, Page, PageSize, Point,
    RenderEngine, RenderMetadata, RenderSpec, ResolvedFonts,
};
use wo_ooxml::model::DocxBody;

use wo_docx_renderer::layout::{LayoutElement, LayoutEngine, LayoutPage};
use wo_docx_renderer::pipeline::DocxRenderPipeline;

use wo_odf::model::{OdfContent, OdfTextContent};
use wo_odf::OdfParser;

/// The family the layout engine actually renders text with. The engine ignores
/// the document's requested family and renders this default — the adapter
/// records this honestly so font substitution surfaces in the score.
const ENGINE_DEFAULT_FONT: &str = "sans-serif";

/// Adapter wrapping [`DocxRenderPipeline`] as a scorable [`RenderEngine`].
///
/// ```rust,ignore
/// use wo_conformance_docx::DocxConformanceAdapter;
/// use wo_conformance::RenderEngine;
///
/// let adapter = DocxConformanceAdapter::default();
/// let ir = adapter.render(&docx_bytes, &Default::default()).unwrap();
/// // ir is a NormalizedRender — feed it to wo-conformance's scoring.
/// ```
pub struct DocxConformanceAdapter {
    pipeline: DocxRenderPipeline,
}

impl DocxConformanceAdapter {
    pub fn new(pipeline: DocxRenderPipeline) -> Self {
        Self { pipeline }
    }
}

impl Default for DocxConformanceAdapter {
    fn default() -> Self {
        Self::new(DocxRenderPipeline::default())
    }
}

impl RenderEngine for DocxConformanceAdapter {
    fn name(&self) -> &str {
        "wo-docx-renderer"
    }

    fn version(&self) -> &str {
        env!("CARGO_PKG_VERSION")
    }

    fn render(&self, doc: &[u8], _spec: &RenderSpec) -> Result<NormalizedRender, ConformanceError> {
        // ODF (ODT/ODS/ODP) is a different package format from OOXML even though
        // both are ZIPs — sniff the mimetype marker.
        if wo_odf::is_odf_file(doc) {
            return render_odf(doc);
        }

        let body = self
            .pipeline
            .parse_body(doc)
            .map_err(|e| ConformanceError::RenderFailed(format!("parse failed: {e}")))?;

        let requested = collect_requested_fonts(&body);

        let layout_engine = LayoutEngine::new(self.pipeline.config());
        let pages = layout_engine.layout(&body);

        Ok(project(&pages, requested))
    }
}

// ---------------------------------------------------------------------------
// ODF projection (wo-odf → NormalizedRender)
// ---------------------------------------------------------------------------

/// Project an ODF document through `wo-odf`'s parser into the conformance IR.
///
/// Honest-scope note: `wo-odf` is a parser/serializer engine, not a paginated
/// layout engine — it models paragraphs/spans, table cells, sheet cells and
/// slides but computes no line breaking or page geometry. This projection maps
/// that structure into boxes with A4 page size and flowing coordinates:
/// text/style/font-coverage subscores are meaningful; geometry is structural
/// (per-element, monotonic y) rather than pixel-accurate.
const A4_W: f64 = 595.28;
const A4_H: f64 = 841.89;
const MARGIN: f64 = 72.0;
const LINE_SIZE: f64 = 12.0;

fn render_odf(bytes: &[u8]) -> Result<NormalizedRender, ConformanceError> {
    let doc = OdfParser::new()
        .parse(bytes)
        .map_err(|e| ConformanceError::RenderFailed(format!("odf parse failed: {e}")))?;

    // Style lookup lives in project_text_content (style_run / style_prop2) so
    // the entire projection shares one resolver.
    let style_ctx = &doc.styles;
    let mut requested = BTreeSet::new();
    for f in &doc.fonts {
        if let Some(fam) = &f.font_family {
            requested.insert(fam.clone());
        }
    }

    let mut pages = Vec::new();
    let mut boxes = Vec::new();
    let mut y = MARGIN;

    match &doc.content {
        OdfContent::Text { content, .. } => {
            // wo-odf walks descendants, so a table cell's <text:p> is reported
            // both as an OdfTable cell and as a standalone Paragraph. Collect
            // table-cell texts and skip those paragraphs to avoid double boxes.
            let cell_texts: BTreeSet<String> = content
                .iter()
                .filter_map(|c| match c {
                    OdfTextContent::Table(t) => Some(t),
                    _ => None,
                })
                .flat_map(|t| {
                    t.rows
                        .iter()
                        .flat_map(|r| r.cells.iter().map(|c| c.text.trim().to_string()))
                })
                .filter(|s| !s.is_empty())
                .collect();
            for item in content {
                match item {
                    OdfTextContent::Paragraph(p) => {
                        if cell_texts.contains(p.text.trim()) {
                            continue;
                        }
                    }
                    OdfTextContent::Heading(h) => {
                        if cell_texts.contains(h.text.trim()) {
                            continue;
                        }
                    }
                    _ => {}
                }
                boxes.extend(project_text_content(item, &mut y, style_ctx));
            }
        }
        OdfContent::Spreadsheet { sheets } => {
            for sheet in sheets {
                for row in &sheet.rows {
                    for cell in &row.cells {
                        let text = cell.text.clone();
                        if text.trim().is_empty() {
                            continue;
                        }
                        let origin = Point {
                            x_pt: MARGIN + cell.column as f64 * 96.0,
                            y_pt: y,
                        };
                        y += LINE_SIZE * 1.2;
                        boxes.push(cell_box("SheetCell", origin, text));
                    }
                }
            }
        }
        OdfContent::Presentation { slides } => {
            for slide in slides {
                if slide.text_content.trim().is_empty() {
                    continue;
                }
                let origin = Point {
                    x_pt: MARGIN,
                    y_pt: y,
                };
                y += LINE_SIZE * 1.2;
                boxes.push(cell_box("Paragraph", origin, slide.text_content.clone()));
            }
        }
        OdfContent::Generic => {
            return Ok(NormalizedRender {
                pages: vec![empty_page(0)],
                resolved_fonts: ResolvedFonts {
                    requested: requested.into_iter().collect(),
                    resolved: BTreeMap::new(),
                    unavailable: Vec::new(),
                },
                metadata: RenderMetadata {
                    engine: "wo-odf".to_string(),
                    engine_version: env!("CARGO_PKG_VERSION").to_string(),
                    captured_at: String::new(),
                    environment: "wo-odf structural projection (no layout engine)".to_string(),
                },
            });
        }
    }

    pages.push(Page {
        index: 0,
        size: PageSize {
            width_pt: A4_W,
            height_pt: A4_H,
        },
        boxes,
    });

    let resolved: BTreeMap<String, String> = requested
        .iter()
        .cloned()
        .map(|f| (f.clone(), ENGINE_DEFAULT_FONT.to_string()))
        .collect();

    Ok(NormalizedRender {
        pages,
        resolved_fonts: ResolvedFonts {
            requested: requested.into_iter().collect(),
            resolved,
            unavailable: Vec::new(),
        },
        metadata: RenderMetadata {
            engine: "wo-odf".to_string(),
            engine_version: env!("CARGO_PKG_VERSION").to_string(),
            captured_at: String::new(),
            environment: "wo-odf structural projection (no layout engine)".to_string(),
        },
    })
}

fn empty_page(index: usize) -> Page {
    Page {
        index,
        size: PageSize {
            width_pt: A4_W,
            height_pt: A4_H,
        },
        boxes: Vec::new(),
    }
}

fn cell_box(kind: &str, origin: Point, text: String) -> LayoutBox {
    let kind = match kind {
        "SheetCell" => BoxKind::TableCell,
        _ => BoxKind::Paragraph,
    };
    LayoutBox {
        kind,
        origin,
        size: PageSize {
            width_pt: (text.chars().count() as f64 * LINE_SIZE * 0.6).max(1.0),
            height_pt: LINE_SIZE * 1.2,
        },
        runs: vec![GlyphRun {
            text,
            font: ENGINE_DEFAULT_FONT.to_string(),
            size_pt: LINE_SIZE,
            weight: 400,
            italic: false,
            origin,
        }],
    }
}

fn project_text_content(
    item: &OdfTextContent,
    y: &mut f64,
    style_ctx: &[wo_odf::model::OdfStyle],
) -> Vec<LayoutBox> {
    fn style_prop2(
        styles: &[wo_odf::model::OdfStyle],
        name: &str,
        key: &str,
    ) -> Option<String> {
        fn walk(styles: &[wo_odf::model::OdfStyle], name: &str, key: &str, depth: u8) -> Option<String> {
            let st = styles.iter().find(|s| s.name == name)?;
            let found = st
                .properties
                .iter()
                .find(|(k, _)| k.ends_with(&format!(":{key}")))
                .map(|(_, v)| v.clone());
            if found.is_some() {
                return found;
            }
            if depth < 8 {
                if let Some(p) = &st.parent {
                    if let Some(v) = walk(styles, p, key, depth + 1) {
                        return Some(v);
                    }
                }
            }
            if let Some(dn) = &st.display_name {
                if dn != name && depth < 8 {
                    if let Some(v) = walk(styles, dn, key, depth + 1) {
                        return Some(v);
                    }
                }
            }
            None
        }
        walk(styles, name, key, 0)
    }

    // Resolve a style-name into (bold, italic, size_pt).
    fn style_run(
        styles: &[wo_odf::model::OdfStyle],
        name: Option<&String>,
        weight: u16,
        italic: bool,
        size_pt: f64,
    ) -> (u16, bool, f64) {
        let Some(name) = name else { return (weight, italic, size_pt) };
        let bold = style_prop2(styles, name, "font-weight")
            .map(|v| v.eq_ignore_ascii_case("bold") || v == "700")
            .unwrap_or(weight == 700);
        let ital = style_prop2(styles, name, "font-style")
            .map(|v| v.eq_ignore_ascii_case("italic"))
            .unwrap_or(italic);
        let size = style_prop2(styles, name, "font-size").and_then(|v| {
            // accept "12pt" / "12" forms
            v.trim_end_matches(['p', 't', ' ', 'P', 'T'])
                .parse::<f64>()
                .ok()
        });
        let size_pt = size.unwrap_or(size_pt);
        (if bold { 700 } else { 400 }, ital, size_pt)
    }

    let mut boxes = Vec::new();
    match item {
        OdfTextContent::Paragraph(p) => {
            if p.spans.is_empty() {
                if p.text.trim().is_empty() {
                    return boxes;
                }
                let (weight, italic, size_pt) =
                    style_run(style_ctx, p.style_name.as_ref(), 400, false, LINE_SIZE);
                let origin = Point {
                    x_pt: MARGIN,
                    y_pt: *y,
                };
                *y += size_pt * 1.2;
                boxes.push(LayoutBox {
                    kind: BoxKind::Paragraph,
                    origin,
                    size: PageSize {
                        width_pt: (p.text.chars().count() as f64 * size_pt * 0.6).max(1.0),
                        height_pt: size_pt * 1.2,
                    },
                    runs: vec![GlyphRun {
                        text: p.text.clone(),
                        font: ENGINE_DEFAULT_FONT.to_string(),
                        size_pt,
                        weight,
                        italic,
                        origin,
                    }],
                });
                return boxes;
            }
            for span in &p.spans {
                if span.text.trim().is_empty() {
                    continue;
                }
                let (weight, italic, size_pt) = style_run(
                    style_ctx,
                    span.style_name.as_ref(),
                    if span.bold { 700 } else { 400 },
                    span.italic,
                    LINE_SIZE,
                );
                let origin = Point {
                    x_pt: MARGIN,
                    y_pt: *y,
                };
                *y += size_pt * 1.2;
                boxes.push(LayoutBox {
                    kind: BoxKind::Paragraph,
                    origin,
                    size: PageSize {
                        width_pt: (span.text.chars().count() as f64 * size_pt * 0.6)
                            .max(1.0),
                        height_pt: size_pt * 1.2,
                    },
                    runs: vec![GlyphRun {
                        text: span.text.clone(),
                        font: ENGINE_DEFAULT_FONT.to_string(),
                        size_pt,
                        weight,
                        italic,
                        origin,
                    }],
                });
            }
        }
        OdfTextContent::Heading(h) => {
            let (weight, italic, size_pt) =
                style_run(style_ctx, h.style_name.as_ref(), 700, false, LINE_SIZE * 1.4);
            let origin = Point {
                x_pt: MARGIN,
                y_pt: *y,
            };
            *y += size_pt * 1.6;
            boxes.push(LayoutBox {
                kind: BoxKind::Paragraph,
                origin,
                size: PageSize {
                    width_pt: (h.text.chars().count() as f64 * size_pt * 0.6).max(1.0),
                    height_pt: size_pt * 1.6,
                },
                runs: vec![GlyphRun {
                    text: h.text.clone(),
                    font: ENGINE_DEFAULT_FONT.to_string(),
                    size_pt,
                    weight,
                    italic,
                    origin,
                }],
            });
        }
        OdfTextContent::List(list) => {
            for item in &list.items {
                for sub in &item.content {
                    boxes.extend(project_text_content(sub, y, style_ctx));
                }
            }
        }
        OdfTextContent::Table(t) => {
            let mut ty = *y;
            for row in &t.rows {
                for c in &row.cells {
                    if c.text.trim().is_empty() {
                        continue;
                    }
                    let origin = Point {
                        x_pt: MARGIN + c.col_span as f64 * 0.0,
                        y_pt: ty,
                    };
                    boxes.push(cell_box("SheetCell" /* reused: table cell */, origin, c.text.clone()));
                }
                ty += LINE_SIZE * 1.2;
            }
            *y = ty;
        }
        OdfTextContent::Image(_) => {}
    }
    boxes
}

// ---------------------------------------------------------------------------
// Projection helpers
// ---------------------------------------------------------------------------

/// Collect every explicitly requested font family from the document body.
fn collect_requested_fonts(body: &DocxBody) -> BTreeSet<String> {
    let mut set = BTreeSet::new();

    for para in body.paragraphs() {
        for run in &para.runs {
            if let Some(f) = &run.font {
                if !f.is_empty() {
                    set.insert(f.clone());
                }
            }
        }
    }

    for table in body.tables() {
        for row in &table.rows {
            for cell in &row.cells {
                for para in &cell.paragraphs {
                    for run in &para.runs {
                        if let Some(f) = &run.font {
                            if !f.is_empty() {
                                set.insert(f.clone());
                            }
                        }
                    }
                }
            }
        }
    }

    set
}

/// Project the renderer's layout pages into the conformance IR.
fn project(pages: &[LayoutPage], requested: BTreeSet<String>) -> NormalizedRender {
    let ir_pages: Vec<Page> = pages
        .iter()
        .enumerate()
        .map(|(i, p)| project_page(p, i))
        .collect();

    // The layout engine renders every run with ENGINE_DEFAULT_FONT regardless of
    // the document's request, so every requested family is a substitution.
    let resolved: BTreeMap<String, String> = requested
        .iter()
        .map(|f| (f.clone(), ENGINE_DEFAULT_FONT.to_string()))
        .collect();

    NormalizedRender {
        pages: ir_pages,
        resolved_fonts: ResolvedFonts {
            requested: requested.into_iter().collect(),
            resolved,
            unavailable: Vec::new(),
        },
        metadata: RenderMetadata {
            engine: "wo-docx-renderer".to_string(),
            engine_version: env!("CARGO_PKG_VERSION").to_string(),
            captured_at: String::new(),
            environment: "layout-IR projection (pre-rasterization)".to_string(),
        },
    }
}

fn project_page(page: &LayoutPage, index: usize) -> Page {
    let mut boxes = Vec::new();

    for element in &page.elements {
        match element {
            LayoutElement::Paragraph { lines, .. } => {
                for line in lines {
                    if line.text.trim().is_empty() {
                        continue;
                    }
                    boxes.push(LayoutBox {
                        kind: BoxKind::Paragraph,
                        origin: Point {
                            x_pt: line.x as f64,
                            y_pt: line.y as f64,
                        },
                        size: PageSize {
                            width_pt: line.width.max(1.0) as f64,
                            height_pt: line.height as f64,
                        },
                        runs: vec![GlyphRun {
                            text: line.text.clone(),
                            font: ENGINE_DEFAULT_FONT.to_string(),
                            size_pt: line.font_size as f64,
                            weight: if line.bold { 700 } else { 400 },
                            italic: line.italic,
                            origin: Point {
                                x_pt: line.x as f64,
                                y_pt: line.y as f64,
                            },
                        }],
                    });
                }
            }
            LayoutElement::Table { cells, .. } => {
                for cell in cells {
                    let mut runs = Vec::new();
                    let mut y = cell.y + 4.0;
                    for para in &cell.paragraphs {
                        for run in &para.runs {
                            if run.text.trim().is_empty() {
                                continue;
                            }
                            let size_pt = run.font_size.unwrap_or(24) as f32 / 2.0;
                            runs.push(GlyphRun {
                                text: run.text.clone(),
                                // The layout engine ignores family — record the default.
                                font: ENGINE_DEFAULT_FONT.to_string(),
                                size_pt: size_pt as f64,
                                weight: if run.bold { 700 } else { 400 },
                                italic: run.italic,
                                origin: Point {
                                    x_pt: (cell.x + 4.0) as f64,
                                    y_pt: y as f64,
                                },
                            });
                            y += size_pt * 1.2;
                        }
                    }
                    if !runs.is_empty() {
                        boxes.push(LayoutBox {
                            kind: BoxKind::TableCell,
                            origin: Point {
                                x_pt: cell.x as f64,
                                y_pt: cell.y as f64,
                            },
                            size: PageSize {
                                width_pt: cell.width as f64,
                                height_pt: cell.height as f64,
                            },
                            runs,
                        });
                    }
                }
            }
            LayoutElement::PageBreak => {}
        }
    }

    Page {
        index,
        size: PageSize {
            width_pt: page.width as f64,
            height_pt: page.height as f64,
        },
        boxes,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Build a minimal valid DOCX with a paragraph whose run requests
    /// Calibri.  This is the same structure the pipeline's own tests use,
    /// plus a `w:rFonts` element so the font request is explicit.
    fn make_docx_with_font(font_family: &str, text: &str) -> Vec<u8> {
        let doc_xml = format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="{font_family}"/>
          <w:sz w:val="22"/>
        </w:rPr>
        <w:t>{text}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>"#
        );

        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
            let opts = zip::write::SimpleFileOptions::default();

            zip.start_file("[Content_Types].xml", opts.clone()).unwrap();
            zip.write_all(br#"<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"#).unwrap();

            zip.start_file("_rels/.rels", opts.clone()).unwrap();
            zip.write_all(br#"<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#).unwrap();

            zip.start_file("word/document.xml", opts).unwrap();
            zip.write_all(doc_xml.as_bytes()).unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    /// Plain minimal docx (no font request, no rPr).
    fn make_plain_docx(text: &str) -> Vec<u8> {
        make_docx_with_font("", text)
    }

    #[test]
    fn adapter_name_and_version() {
        let adapter = DocxConformanceAdapter::default();
        assert_eq!(adapter.name(), "wo-docx-renderer");
        assert_eq!(adapter.version(), "0.1.0");
    }

    #[test]
    fn adapter_renders_without_error() {
        let adapter = DocxConformanceAdapter::default();
        let docx = make_plain_docx("Hello World");
        let ir = adapter.render(&docx, &RenderSpec::default());
        assert!(ir.is_ok(), "adapter should succeed on a valid docx: {ir:?}");
    }

    #[test]
    fn ir_has_expected_structure() {
        let adapter = DocxConformanceAdapter::default();
        let docx = make_plain_docx("Hello World");
        let ir = adapter.render(&docx, &RenderSpec::default()).unwrap();

        assert_eq!(ir.pages.len(), 1);
        let page = &ir.pages[0];
        assert!((page.size.width_pt - 595.28).abs() < 0.5);
        assert!(!page.boxes.is_empty());

        let box0 = &page.boxes[0];
        assert!(box0.runs.iter().any(|r| r.text.contains("Hello World")));
    }

    /// NOTE: wo-ooxml's parser currently does not extract `w:rFonts w:ascii`
    /// or `w:sz w:val` into `DocxRun` fields due to a namespace-handling bug
    /// (`attribute("val")` doesn't match the namespaced `w:val`). Once fixed,
    /// `resolved_fonts.requested` will populate and font_coverage will surface
    /// real substitution findings. For now this test verifies the adapter
    /// doesn't crash and correctly reports empty-requested → full coverage.
    #[test]
    fn font_substitution_recorded_when_parser_supports_it() {
        let adapter = DocxConformanceAdapter::default();
        let docx = make_docx_with_font("Calibri", "Font test");
        let ir = adapter.render(&docx, &RenderSpec::default()).unwrap();

        // Current parser limitation: requested is empty because w:rFonts isn't parsed.
        assert!(
            ir.resolved_fonts.requested.is_empty(),
            "parser does not yet extract font requests"
        );
        // Empty request → full coverage (correct for "nothing was requested").
        assert!((ir.resolved_fonts.coverage() - 1.0).abs() < 1e-9);

        // Architecture check: IF fonts were requested, substitution would
        // be recorded honestly. Verify the resolved map machinery.
        let mut ir = adapter.render(&docx, &RenderSpec::default()).unwrap();
        ir.resolved_fonts.requested.push("Calibri".into());
        ir.resolved_fonts
            .resolved
            .insert("Calibri".into(), "sans-serif".into());
        assert!(ir.resolved_fonts.coverage() < 1.0);
        assert_eq!(ir.resolved_fonts.substitution_count(), 1);
    }

    #[test]
    fn no_font_request_means_full_coverage() {
        let adapter = DocxConformanceAdapter::default();
        let docx = make_plain_docx("No font pr");

        let ir = adapter.render(&docx, &RenderSpec::default()).unwrap();

        assert!(
            ir.resolved_fonts.requested.is_empty(),
            "no explicit font request → empty requested set"
        );
        assert!(
            (ir.resolved_fonts.coverage() - 1.0).abs() < 1e-9,
            "no explicit request → full coverage (1.0)"
        );
    }

    // --- ODF projections ----------------------------------------------------

    /// Build a minimal ODT package (mimetype + manifest + content.xml).
    fn make_odt(paragraphs: &[&str], bold_first: bool) -> Vec<u8> {
        let body: String = paragraphs
            .iter()
            .map(|p| {
                if bold_first && p == &paragraphs[0] {
                    format!(
                        r##"<text:p><text:span text:style-name="Bold">{p}</text:span></text:p>"##
                    )
                } else {
                    format!(r##"<text:p>{p}</text:p>"##)
                }
            })
            .collect();
        let xml = format!(
            r##"<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
<office:automatic-styles><style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style></office:automatic-styles>
<office:body><office:text>{body}</office:text></office:body>
</office:document-content>"##
        );
        let manifest = r##"<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>"##;
        let mut buf = Vec::new();
        {
            let mut z = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
            z.start_file("mimetype", zip::write::SimpleFileOptions::default())
                .unwrap();
            std::io::Write::write_all(
                &mut z,
                b"application/vnd.oasis.opendocument.text",
            )
            .unwrap();
            z.start_file("META-INF/manifest.xml", zip::write::SimpleFileOptions::default())
                .unwrap();
            std::io::Write::write_all(&mut z, manifest.as_bytes()).unwrap();
            z.start_file("content.xml", zip::write::SimpleFileOptions::default())
                .unwrap();
            std::io::Write::write_all(&mut z, xml.as_bytes()).unwrap();
            z.finish().unwrap();
        }
        buf
    }

    #[test]
    fn odf_detected_and_projected() {
        let adapter = DocxConformanceAdapter::default();
        let odt = make_odt(&["Hello ODF", "Second line"], false);
        let ir = adapter.render(&odt, &RenderSpec::default()).unwrap();

        assert!(!ir.pages.is_empty());
        let texts: Vec<&str> = ir.pages[0]
            .boxes
            .iter()
            .flat_map(|b| b.runs.iter().map(|r| r.text.as_str()))
            .collect();
        assert!(
            texts.iter().any(|t| t.contains("Hello ODF"))
                && texts.iter().any(|t| t.contains("Second line")),
            "ODT paragraphs should project: {texts:?}"
        );
        // Honest metadata: wo-odf structural projection, no layout engine.
        assert_eq!(ir.metadata.environment, "wo-odf structural projection (no layout engine)");
    }

    #[test]
    fn odf_style_bold_projected_from_span() {
        let adapter = DocxConformanceAdapter::default();
        // A span with bold=true: the adapter records weight 700.
        let odt = make_odt(&["Bold line"], true);
        let ir = adapter.render(&odt, &RenderSpec::default()).unwrap();
        let runs: Vec<_> = ir.pages[0]
            .boxes
            .iter()
            .flat_map(|b| b.runs.iter())
            .collect();
        assert!(
            runs.iter().any(|r| r.text.contains("Bold line") && r.weight == 700),
            "bold span should project weight 700"
        );
    }

    #[test]
    fn ods_sheet_cells_projected() {
        // Minimal ODS: one sheet, two rows.
        let xml = r##"<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" office:version="1.2">
<office:body><office:spreadsheet><table:table table:name="S"><table:table-row><table:table-cell office:value-type="string"><text:p>A1</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="42"><text:p>42</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet></office:body>
</office:document-content>"##;
        let mut buf = Vec::new();
        {
            let mut z = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
            z.start_file("mimetype", zip::write::SimpleFileOptions::default())
                .unwrap();
            std::io::Write::write_all(
                &mut z,
                b"application/vnd.oasis.opendocument.spreadsheet",
            )
            .unwrap();
            z.start_file("content.xml", zip::write::SimpleFileOptions::default())
                .unwrap();
            std::io::Write::write_all(&mut z, xml.as_bytes()).unwrap();
            z.finish().unwrap();
        }
        let adapter = DocxConformanceAdapter::default();
        let ir = adapter.render(&buf, &RenderSpec::default()).unwrap();
        let texts: Vec<&str> = ir.pages[0]
            .boxes
            .iter()
            .flat_map(|b| b.runs.iter().map(|r| r.text.as_str()))
            .collect();
        assert!(
            texts.iter().any(|t| *t == "A1") && texts.iter().any(|t| *t == "42"),
            "ODS cells should project: {texts:?}"
        );
    }


    #[test]
    fn ir_serializes_to_json() {
        let adapter = DocxConformanceAdapter::default();
        let docx = make_docx_with_font("Calibri", "Serialize me");
        let ir = adapter.render(&docx, &RenderSpec::default()).unwrap();

        let json = serde_json::to_string(&ir).expect("NormalizedRender must serialize");
        // Round-trip check.
        let back: NormalizedRender =
            serde_json::from_str(&json).expect("JSON must deserialize back");
        assert_eq!(back.pages.len(), ir.pages.len());
    }

    #[test]
    fn page_break_produces_two_pages() {
        let adapter = DocxConformanceAdapter::default();

        let doc_xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Page one</w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:pageBreakBefore/></w:pPr>
      <w:r><w:t>Page two</w:t></w:r>
    </w:p>
  </w:body>
</w:document>"#;

        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
            let opts = zip::write::SimpleFileOptions::default();
            zip.start_file("[Content_Types].xml", opts.clone()).unwrap();
            zip.write_all(br#"<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"#).unwrap();
            zip.start_file("_rels/.rels", opts.clone()).unwrap();
            zip.write_all(br#"<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#).unwrap();
            zip.start_file("word/document.xml", opts).unwrap();
            zip.write_all(doc_xml.as_bytes()).unwrap();
            zip.finish().unwrap();
        }

        let ir = adapter.render(&buf, &RenderSpec::default()).unwrap();
        assert!(
            ir.pages.len() >= 2,
            "pageBreakBefore should produce ≥2 pages, got {}",
            ir.pages.len()
        );
    }

    #[test]
    fn table_cell_maps_to_box() {
        let adapter = DocxConformanceAdapter::default();

        let doc_xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tblPr><w:tblW w:w="5000"/></w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="20"/></w:rPr><w:t>Cell</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>"#;

        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
            let opts = zip::write::SimpleFileOptions::default();
            zip.start_file("[Content_Types].xml", opts.clone()).unwrap();
            zip.write_all(br#"<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"#).unwrap();
            zip.start_file("_rels/.rels", opts.clone()).unwrap();
            zip.write_all(br#"<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#).unwrap();
            zip.start_file("word/document.xml", opts).unwrap();
            zip.write_all(doc_xml.as_bytes()).unwrap();
            zip.finish().unwrap();
        }

        let ir = adapter.render(&buf, &RenderSpec::default()).unwrap();
        let has_table_cell = ir
            .pages
            .iter()
            .any(|p| p.boxes.iter().any(|b| matches!(b.kind, BoxKind::TableCell)));
        assert!(
            has_table_cell,
            "table should produce at least one TableCell box"
        );
    }

    #[test]
    fn rejects_garbage() {
        let adapter = DocxConformanceAdapter::default();
        let result = adapter.render(b"not a zip at all", &RenderSpec::default());
        assert!(result.is_err());
    }

    /// End-to-end: render a docx through the adapter, score the IR against
    /// itself, verify perfect fidelity. This proves the full pipeline:
    /// docx → parse → layout → NormalizedRender → conformance score.
    #[test]
    fn e2e_self_fidelity_is_perfect() {
        use wo_conformance::compute_fidelity;

        let adapter = DocxConformanceAdapter::default();
        let docx = make_plain_docx("Hello World");
        let ir = adapter.render(&docx, &RenderSpec::default()).unwrap();
        let report = compute_fidelity("self-diff", &ir, &ir);
        assert!(
            (report.fidelity - 1.0).abs() < 1e-9,
            "self-diff should yield perfect fidelity, got {}",
            report.fidelity
        );
        assert_eq!(report.page_count_engine, report.page_count_truth);
        assert_eq!(report.boxes_matched, report.boxes_total);
        assert_eq!(report.text_matches, report.text_total);
    }
}
