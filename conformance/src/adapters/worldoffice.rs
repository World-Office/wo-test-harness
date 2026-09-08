//! World-Office (opencloud-docserver) as a rendering oracle.
//!
//! World-Office's rendering pipeline is `docx → (their converter.py) → HTML`,
//! the exact content the browser editor lays out; there is **no PDF export**.
//! This adapter therefore:
//!
//!   1. pushes the docx bytes into `POST /api/upload` (multipart `file` field);
//!   2. fetches the converted content HTML via `GET /api/documents/{id}/html`;
//!   3. prints that HTML to PDF with headless Chromium (World-Office emits
//!      light, document-shaped HTML; Chromium supplies deterministic layout
//!      and typography);
//!   4. projects the PDF into [`NormalizedRender`] via [`PdfGeometrySource`].
//!
//! The resulting geometry therefore reflects World-Office's *own content
//! model* (its docx→html converter) as measured on a standard layout engine —
//! the honest candidate counterpart to the OnlyOffice DS PDF projection.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::adapters::pdfgeom::PdfGeometrySource;
use crate::engine::RenderEngine;
use crate::model::{ConformanceError, NormalizedRender, RenderMetadata, RenderSpec};

/// Connection/process settings for a World-Office docserver.
#[derive(Debug, Clone)]
pub struct WorldOfficeConfig {
    /// e.g. `http://worldoffice.test:8080` (runtime must reach us too).
    pub base_url: String,
    /// Headless Chromium binary for HTML → PDF (default `chromium` or `CHROMIUM`).
    pub chromium: PathBuf,
    /// Path to pdftotext (projection backend).
    pub pdftotext: PathBuf,
    pub request_timeout: Duration,
}

impl WorldOfficeConfig {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            chromium: std::env::var("CHROMIUM").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("chromium")),
            pdftotext: std::env::var("PDFTOTEXT").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("pdftotext")),
            request_timeout: Duration::from_secs(90),
        }
    }
}

/// Documentserver-backed renderer via the World-Office html pipeline.
pub struct WorldOfficeHtmlEngine {
    http: reqwest::blocking::Client,
    cfg: WorldOfficeConfig,
    source: Box<dyn PdfGeometrySource>,
    /// Docserver version string (surfaced in reports).
    pub version: String,
    /// Source format of input documents ("docx", "odt", ...).
    pub filetype: String,
    /// Use the docserver's native PDF export (docx→html→weasyprint) when
    /// available; fall back to the chromium projection otherwise.
    pub native_pdf: bool,
}

impl WorldOfficeHtmlEngine {
    pub fn new(
        cfg: WorldOfficeConfig,
        source: Box<dyn PdfGeometrySource>,
        version: impl Into<String>,
    ) -> Result<Self, ConformanceError> {
        let http = reqwest::blocking::Client::builder()
            .timeout(cfg.request_timeout)
            .build()
            .map_err(|e| ConformanceError::RenderFailed(format!("http client: {e}")))?;
        Ok(Self {
            http,
            cfg,
            source,
            version: version.into(),
            filetype: "docx".into(),
            native_pdf: true,
        })
    }

    /// Upload docx bytes; returns the server-assigned doc id (the filename).
    fn upload(&self, doc: &[u8]) -> Result<String, ConformanceError> {
        let name = "wo-render.docx";
        let part = reqwest::blocking::multipart::Part::bytes(doc.to_vec())
            .file_name(name)
            .mime_str("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            .map_err(|e| ConformanceError::RenderFailed(format!("mime: {e}")))?;
        let form = reqwest::blocking::multipart::Form::new().part("file", part);
        let up = self
            .http
            .post(format!("{}/api/upload", self.cfg.base_url))
            .multipart(form)
            .send()
            .map_err(|e| ConformanceError::RenderFailed(format!("upload: {e}")))?
            .error_for_status()
            .map_err(|e| ConformanceError::RenderFailed(format!("upload status: {e}")))?;
        let up_json: serde_json::Value = up
            .json()
            .map_err(|e| ConformanceError::RenderFailed(format!("upload json: {e}")))?;
        up_json
            .get("id")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| ConformanceError::RenderFailed("upload returned no id".into()))
    }

    /// Fetch the content HTML for a doc id (their converter's docx→html).
    fn fetch_html(&self, doc_id: &str) -> Result<String, ConformanceError> {
        let html_resp = self
            .http
            .get(format!(
                "{}/api/documents/{}/html",
                self.cfg.base_url,
                url_encode(doc_id)
            ))
            .send()
            .map_err(|e| ConformanceError::RenderFailed(format!("html fetch: {e}")))?
            .error_for_status()
            .map_err(|e| ConformanceError::RenderFailed(format!("html status: {e}")))?;
        let html_json: serde_json::Value = html_resp
            .json()
            .map_err(|e| ConformanceError::RenderFailed(format!("html json: {e}")))?;
        Ok(html_json
            .get("html")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("")
            .to_string())
    }

    /// Native PDF export: POST /api/documents/{id}/export?format=pdf
    /// (docx→html→weasyprint on the server).
    fn export_pdf(&self, doc_id: &str) -> Result<Vec<u8>, ConformanceError> {
        let resp = self
            .http
            .post(format!(
                "{}/api/documents/{}/export?format=pdf",
                self.cfg.base_url,
                url_encode(doc_id)
            ))
            .send()
            .map_err(|e| ConformanceError::RenderFailed(format!("export: {e}")))?;
        let status = resp.status();
        let engine = resp
            .headers()
            .get("x-export-engine")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("unknown")
            .to_string();
        let bytes = resp
            .bytes()
            .map_err(|e| ConformanceError::RenderFailed(format!("export body: {e}")))?;
        if !status.is_success() {
            let text = String::from_utf8_lossy(&bytes);
            return Err(ConformanceError::RenderFailed(format!(
                "export status {} (engine {engine}): {}",
                status, text
            )));
        }
        if !bytes.starts_with(b"%PDF") {
            return Err(ConformanceError::RenderFailed(format!(
                "export returned non-PDF (engine {engine})"
            )));
        }
        Ok(bytes.to_vec())
    }

    /// Print an HTML fragment to PDF via headless Chromium.
    fn html_to_pdf(&self, html: &str, pdf_path: &Path) -> Result<(), ConformanceError> {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let html_path = pdf_path.with_extension(format!("{stamp}.input.html"));
        let mut page = String::from(
            "<!doctype html>\n<meta charset=\"utf-8\">\n<style>@page{margin:2cm}\nbody{font-family:serif;font-size:12pt}</style>\n<body>",
        );
        page.push_str(html);
        page.push_str("</body>");
        fs::write(&html_path, page).map_err(|e| {
            ConformanceError::RenderFailed(format!("write {}: {e}", html_path.display()))
        })?;
        let status = Command::new(&self.cfg.chromium)
            .args([
                "--headless=new",
                "--no-sandbox",
                "--disable-gpu",
                "--no-pdf-header-footer",
                "--virtual-time-budget=2000",
            ])
            .arg(format!("--print-to-pdf={}", pdf_path.display()))
            .arg(html_path.as_os_str())
            .status()
            .map_err(|e| {
                ConformanceError::RenderFailed(format!(
                    "chromium {}: {e}",
                    self.cfg.chromium.display()
                ))
            })?;
        let _ = fs::remove_file(&html_path);
        if !status.success() {
            return Err(ConformanceError::RenderFailed(format!(
                "chromium exited {}",
                status
            )));
        }
        if !pdf_path.exists() {
            return Err(ConformanceError::RenderFailed(
                "chromium produced no PDF".into(),
            ));
        }
        Ok(())
    }
}

/// Minimal path-segment encoding for the doc id (kept conservative: ids here
/// are server-controlled filenames, but a stray `/` would break the route).
fn url_encode(s: &str) -> String {
    s.split('/')
        .map(|seg| {
            seg.chars()
                .map(|c| match c {
                    'a'..='z' | 'A'..='Z' | '0'..='9' | '.' | '-' | '_' => c.to_string(),
                    _ => format!("%{:02X}", c as u32),
                })
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("%2F")
}

impl RenderEngine for WorldOfficeHtmlEngine {
    fn name(&self) -> &str {
        "worldoffice-docserver"
    }

    fn version(&self) -> &str {
        &self.version
    }

    fn render(&self, doc: &[u8], _spec: &RenderSpec) -> Result<NormalizedRender, ConformanceError> {
        let doc_id = self.upload(doc)?;
        // 1: native export (docx→html→weasyprint on the server), chromium fallback.
        if self.native_pdf {
            match self.export_pdf(&doc_id) {
                Ok(pdf) => {
                    let mut render = self.source.extract(&pdf)?;
                    render.metadata = RenderMetadata {
                        engine: self.name().to_string(),
                        engine_version: self.version.clone(),
                        captured_at: chrono::Utc::now().to_rfc3339(),
                        environment: "worldoffice native pdf export (docx→html→weasyprint)".into(),
                    };
                    return Ok(render);
                }
                Err(e) => {
                    eprintln!("worldoffice: native export unavailable, falling back to chromium: {e}");
                }
            }
        }
        let html = self.fetch_html(&doc_id)?;
        if html.trim().is_empty() {
            return Err(ConformanceError::RenderFailed(
                "world-office converter returned empty html".into(),
            ));
        }
        let tmp = std::env::temp_dir()
            .join(format!("worldoffice-render-{}", std::process::id()));
        fs::create_dir_all(&tmp).map_err(|e| {
            ConformanceError::RenderFailed(format!("mkdir {}: {e}", tmp.display()))
        })?;
        let pdf_path = tmp.join("out.pdf");
        self.html_to_pdf(&html, &pdf_path)?;
        let pdf = fs::read(&pdf_path)
            .map_err(|e| ConformanceError::RenderFailed(format!("read pdf: {e}")))?;
        let _ = fs::remove_dir_all(&tmp);
        let mut render = self.source.extract(&pdf)?;
        render.metadata = RenderMetadata {
            engine: self.name().to_string(),
            engine_version: self.version.clone(),
            captured_at: chrono::Utc::now().to_rfc3339(),
            environment: "worldoffice docx→html→chromium-pdf projection".into(),
        };
        Ok(render)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_encode_keeps_safe_filenames() {
        assert_eq!(url_encode("wo-render.docx"), "wo-render.docx");
        assert_eq!(url_encode("a b"), "a%20b");
        assert_eq!(url_encode("a/b"), "a%2Fb");
    }
}
