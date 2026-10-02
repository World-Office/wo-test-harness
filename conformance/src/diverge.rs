//! Divergence register — joins the Nextcloud visual rig's run artifacts
//! (`manifest.json` + `legs.json`) with this crate's A-layer render fidelity
//! into one machine-readable entry per engine.
//!
//! The register is the correlation point the equivalence rig produces:
//!   * B-layer visual similarity (chrome/canvas) is measured by wopi-vis.js;
//!   * A-layer render fidelity is measured here (cross-engine diff);
//!   * the WOPI protocol trace is extracted from legs.json. The register joins
//!     all three so a render-score drop can be chased back to a protocol
//!     divergence (or vice-versa).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;

use crate::model::NormalizedRender;
use crate::scoring::{compute_fidelity_cross_engine, CaseReport};

/// One machine-readable divergence-register entry (schema v1).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RegisterEntry {
    pub schema_version: u32,
    pub engine: String,
    pub host_wopi_url: String,
    pub launch: LaunchInfo,
    pub fixture: FixtureInfo,
    pub protocol: ProtocolStats,
    pub divergences: Vec<Divergence>,
    pub a_layer: Option<ALayer>,
    pub visual: VisualStats,
    pub wopi_path_shape: String,
    pub captured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LaunchInfo {
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FixtureInfo {
    pub name: String,
    pub sha256: String,
    pub file_id: u64,
}

/// Counts derived from the rig's legs.json wire slice.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ProtocolStats {
    pub total_legs: usize,
    pub check_file_info: usize,
    pub get_file: usize,
    pub put_file: usize,
    pub lock_ops: usize,
    pub overrides: Vec<String>,
    pub methods: BTreeMap<String, usize>,
    pub proof_style: String,
    pub launch_style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Divergence {
    pub id: String,
    /// 'protocol' | 'visual' — which layer the divergence lives in.
    pub layer: String,
    pub severity: String,
    pub summary: String,
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ALayer {
    pub engine_render: String,
    /// Engine that produced the render (from render.metadata), e.g. onlyoffice-documentserver.
    pub render_engine: String,
    pub render_engine_version: String,
    pub truth_source: String,
    pub fidelity: f64,
    pub page_count_engine: usize,
    pub page_count_truth: usize,
    pub boxes_matched: usize,
    pub boxes_total: usize,
    pub scoring_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct VisualStats {
    pub verdict: Option<String>,
    pub chrome_similarity: Option<f64>,
    pub canvas_similarity: Option<f64>,
    pub divergences: Vec<String>,
}

/// Known protocol divergences between the reference (OnlyOffice client) and
/// the World-Office candidate, established empirically in the Nextcloud rig.
fn known_divergences(engine: &str, proof_style: &str) -> Vec<Divergence> {
    let mut out = Vec::new();
    if engine == "worldoffice" {
        out.push(Divergence {
            id: "wo-001-proof-key-absent".into(),
            layer: "protocol".into(),
            severity: "high".into(),
            summary: "World-Office discovery carries NO <proof-key>; Nextcloud richdocuments requires a valid X-Wopi-Proof whenever the configured host advertises one (OnlyOffice does), so NC rejects a raw World-Office client with 500 [].".into(),
            evidence: format!("proof_shim={proof_style}; observed 500 [] for unproven legs"),
        });
        out.push(Divergence {
            id: "wo-004-a-layer-image-dropped".into(),
            layer: "a-layer".into(),
            severity: "high".into(),
            summary: "World-Office docx_to_html has no w:drawing/w:blip read path (it only EMITS drawings on write), so embedded raster/graphics are silently dropped: a drawing-only docx converts to EMPTY html (verified via /api/upload + /api/documents/{id}/html). PIPELINE WOULD LOSE THE IMAGE ON ROUNDTRIP.".into(),
            evidence: "image.docx (1477B, embedded PNG): WO html=\"\" vs OnlyOffice/LO render the page".into(),
        });
        out.push(Divergence {
            id: "wo-002-launch-handshake".into(),
            layer: "protocol".into(),
            severity: "medium".into(),
            summary: "OnlyOffice launches via query-string urlSrc (richdocuments bootstrap); World-Office uses the OpenCloud form-POST launch (access_token+file_id in body, WOPISrc in query).".into(),
            evidence: "direct-launch (form/query) vs richdocuments /hosting/wopi/word/edit".into(),
        });
        out.push(Divergence {
            id: "wo-003-wopi-path-shape".into(),
            layer: "protocol".into(),
            severity: "medium".into(),
            summary: "OpenCloud World-Office targets {host}/wopi/files/{doc}[/contents]; Nextcloud serves /index.php/apps/richdocuments/wopi/files/{id}_{instance}[/contents]. WOPISrc netloc must be the host's published URL.".into(),
            evidence: "wopi_path_shape recorded in register".into(),
        });
    }
    if proof_style == "signing-shim" {
        out.push(Divergence {
            id: "rig-001-proof-shim".into(),
            layer: "protocol".into(),
            severity: "info".into(),
            summary: "Harness signs X-Wopi-Proof with the reference DS key so NC accepts the candidate's traffic (an interface shim; the candidate itself sends no proof).".into(),
            evidence: "bridge.mjs buildProof()".into(),
        });
    }
    out
}

/// Count protocol facts from the rig's legs.json slice.
pub fn analyze_legs(legs: &Value) -> ProtocolStats {
    let mut p = ProtocolStats::default();
    let sample = legs
        .get("sample")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    p.total_legs = sample.len();
    let mut overrides = Vec::new();
    for leg in &sample {
        let m = leg.get("m").and_then(Value::as_str).unwrap_or("");
        let o = leg.get("o").and_then(Value::as_str).unwrap_or("");
        let u = leg.get("u").and_then(Value::as_str).unwrap_or("");
        *p.methods.entry(m.to_string()).or_insert(0) += 1;
        if !o.is_empty() && o != "-" {
            if !overrides.contains(&o.to_string()) {
                overrides.push(o.to_string());
            }
            match o {
                "LOCK" | "UNLOCK" | "GET_LOCK" | "REFRESH_LOCK" => p.lock_ops += 1,
                "PUT" => p.put_file += 1,
                _ => {}
            }
        }
        let base = u.contains("/contents") && m == "GET";
        if base {
            p.get_file += 1;
        } else if u.ends_with("/contents") || u.contains("/contents?") {
            // PUT via POST /contents counted under put_file above
        } else if m == "GET" || m == "POST" {
            if m == "POST" {
                // POST to the resource root = POST-CheckFileInfo / create path
            } else {
                p.check_file_info += 1;
            }
        }
    }
    overrides.sort();
    p.overrides = overrides;
    p
}

/// Build a register entry from a rig run directory.
///
/// `run_dir` must contain `manifest.json` and `legs.json` (produced by
/// `compose/wopi-vis.js`). Optional `a_layer` compares an engine render
/// against ground truth (cross-engine scoring).
pub fn build_entry(
    run_dir: &Path,
    a_layer: Option<(&Path, &Path)>,
) -> Result<RegisterEntry, String> {
    let mpath = run_dir.join("manifest.json");
    let lpath = run_dir.join("legs.json");
    let manifest: Value = serde_json::from_slice(
        &std::fs::read(&mpath).map_err(|e| format!("read {}: {e}", mpath.display()))?,
    )
    .map_err(|e| format!("parse {}: {e}", mpath.display()))?;
    let legs: Value = serde_json::from_slice(
        &std::fs::read(&lpath).map_err(|e| format!("read {}: {e}", lpath.display()))?,
    )
    .map_err(|e| format!("parse {}: {e}", lpath.display()))?;

    let engine = manifest
        .get("engine")
        .and_then(Value::as_str)
        .unwrap_or("?")
        .to_string();
    let host_wopi_url = manifest
        .get("hostWopiUrl")
        .and_then(Value::as_str)
        .unwrap_or("?")
        .to_string();
    let captured_at = manifest
        .get("capturedAt")
        .and_then(Value::as_str)
        .unwrap_or("?")
        .to_string();
    let fixture = manifest.get("fixture").cloned().unwrap_or(Value::Null);
    let fixture = FixtureInfo {
        name: fixture
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("?")
            .to_string(),
        sha256: fixture
            .get("sha256")
            .and_then(Value::as_str)
            .unwrap_or("?")
            .to_string(),
        file_id: fixture.get("fileId").and_then(Value::as_u64).unwrap_or(0),
    };
    let launch = manifest.get("launch").cloned().unwrap_or(Value::Null);
    let launch = LaunchInfo {
        mode: launch
            .get("mode")
            .and_then(Value::as_str)
            .unwrap_or("nextcloud-files")
            .to_string(),
        url: launch
            .get("url")
            .and_then(Value::as_str)
            .map(str::to_string),
    };

    let protocol = analyze_legs(&legs);
    let proof_style = if protocol.overrides.is_empty() || engine == "worldoffice" {
        // World-Office client sends no proof; the rig shims it (see divergences)
        if engine == "worldoffice" {
            "signing-shim"
        } else {
            "none"
        }
    } else {
        "signed"
    };
    let divergences = known_divergences(&engine, proof_style);

    let visual = manifest.get("visual").cloned().unwrap_or(Value::Null);
    let mut visual = VisualStats {
        verdict: visual
            .get("verdict")
            .and_then(Value::as_str)
            .map(str::to_string),
        chrome_similarity: visual.get("chromeSimilarity").and_then(Value::as_f64),
        canvas_similarity: visual.get("canvasSimilarity").and_then(Value::as_f64),
        divergences: Vec::new(),
    };
    // B-layer verdict (written into the run by `wopi-vis.js --verify`)
    let vpath = run_dir.join("verdict.json");
    if vpath.exists() {
        if let Ok(vbytes) = std::fs::read(&vpath) {
            if let Ok(v) = serde_json::from_slice::<Value>(&vbytes) {
                if let Some(s) = v.get("verdict").and_then(Value::as_str) {
                    visual.verdict = Some(s.to_string());
                }
                if let Some(sim) = v.get("similarity") {
                    if let Some(c) = sim.get("chrome.png").and_then(Value::as_f64) {
                        visual.chrome_similarity = Some(c);
                    }
                    if let Some(c) = sim.get("canvas.png").and_then(Value::as_f64) {
                        visual.canvas_similarity = Some(c);
                    }
                }
                if let Some(ds) = v.get("divergences").and_then(Value::as_array) {
                    for d in ds {
                        if let Some(s) = d.as_str() {
                            visual.divergences.push(s.to_string());
                        }
                    }
                }
            }
        }
    }
    // merge any structure/pixel divergence strings recorded in the run
    if engine == "worldoffice" {
        visual
            .divergences
            .push("cross-engine structure/pixel DIFF expected (mirror of B-layer)".into());
    }

    let a_layer = match a_layer {
        Some((engine_path, truth_path)) => {
            let bytes = std::fs::read(engine_path)
                .map_err(|e| format!("read {}: {e}", engine_path.display()))?;
            let v: Value = serde_json::from_slice(&bytes)
                .map_err(|e| format!("parse {}: {e}", engine_path.display()))?;
            let render: NormalizedRender = if v.get("render").is_some() {
                let gt: crate::ground_truth::GroundTruthFile = serde_json::from_value(v.clone())
                    .map_err(|e| format!("engine wrapper {}: {e}", engine_path.display()))?;
                gt.render
            } else {
                serde_json::from_value(v.clone())
                    .map_err(|e| format!("bare engine render {}: {e}", engine_path.display()))?
            };
            let tbytes = std::fs::read(truth_path)
                .map_err(|e| format!("read {}: {e}", truth_path.display()))?;
            let tv: Value = serde_json::from_slice(&tbytes)
                .map_err(|e| format!("parse {}: {e}", truth_path.display()))?;
            let ground_truth: NormalizedRender = if tv.get("render").is_some() {
                let gt: crate::ground_truth::GroundTruthFile = serde_json::from_value(tv)
                    .map_err(|e| format!("truth wrapper {}: {e}", truth_path.display()))?;
                gt.render
            } else {
                serde_json::from_value(tv)
                    .map_err(|e| format!("bare truth {}: {e}", truth_path.display()))?
            };
            let report: CaseReport =
                compute_fidelity_cross_engine("register", &render, &ground_truth);
            Some(ALayer {
                engine_render: engine_path
                    .file_name()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                render_engine: render.metadata.engine.clone(),
                render_engine_version: render.metadata.engine_version.clone(),
                truth_source: format!("{}", truth_path.display()),
                fidelity: report.fidelity,
                page_count_engine: report.page_count_engine,
                page_count_truth: report.page_count_truth,
                boxes_matched: report.boxes_matched,
                boxes_total: report.boxes_total,
                scoring_mode: format!("{:?}", report.scoring_mode),
            })
        }
        None => None,
    };

    Ok(RegisterEntry {
        schema_version: 1,
        engine,
        host_wopi_url,
        launch: launch.clone(),
        fixture,
        protocol: ProtocolStats {
            proof_style: proof_style.to_string(),
            launch_style: launch.mode.clone(),
            ..protocol
        },
        divergences,
        a_layer,
        visual,
        wopi_path_shape: "/index.php/apps/richdocuments/wopi/files/{fileid}_{instance}[/contents]"
            .into(),
        captured_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn analyze_legs_counts_protocol_facts() {
        let legs = json!({
            "count": 4,
            "sample": [
                {"m":"GET","o":"-","u":"/…/files/190_inst?access_token=<T>"},
                {"m":"POST","o":"LOCK","u":"/…/files/190_inst?access_token=<T>"},
                {"m":"GET","o":"-","u":"/…/files/190_inst/contents?access_token=<T>"},
                {"m":"POST","o":"PUT","u":"/…/files/190_inst/contents?access_token=<T>"},
            ]
        });
        let p = analyze_legs(&legs);
        assert_eq!(p.check_file_info, 1);
        assert_eq!(p.get_file, 1);
        assert_eq!(p.put_file, 1);
        assert_eq!(p.lock_ops, 1);
        assert_eq!(p.total_legs, 4);
        assert_eq!(p.overrides, vec!["LOCK", "PUT"]);
    }

    #[test]
    fn known_divergences_are_engine_keyed() {
        let w = known_divergences("worldoffice", "signing-shim");
        let names: Vec<String> = w.iter().map(|d| d.id.clone()).collect();
        assert!(names.contains(&"wo-001-proof-key-absent".to_string()));
        assert!(names.contains(&"wo-003-wopi-path-shape".to_string()));
        let o = known_divergences("onlyoffice", "none");
        assert!(o.is_empty());
    }
}
