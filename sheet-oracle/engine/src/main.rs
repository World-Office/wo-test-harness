//! wo-eval-formula <cases.json> <engine.json>
//! Contract: see sheet-oracle/oracle.py. Local server checkout:
//!   cargo build --config 'patch."https://github.com/World-Office/server.git".wo-formula.path="<server>/core/crates/wo-formula"'
use std::collections::HashMap;
use wo_formula::{a1_to_col, eval, parse, CellValue, Sheet};

struct Grid(HashMap<(u32, u32), CellValue>);

impl Sheet for Grid {
    fn cell(&self, r: u32, c: u32) -> Option<&CellValue> {
        self.0.get(&(r, c))
    }
    fn cell_mut(&mut self, r: u32, c: u32) -> Option<&mut CellValue> {
        self.0.get_mut(&(r, c))
    }
    fn range(&self, r0: u32, c0: u32, r1: u32, c1: u32) -> Vec<&CellValue> {
        static EMPTY: CellValue = CellValue::Empty;
        let mut v = Vec::new();
        for r in r0..=r1 {
            for c in c0..=c1 {
                v.push(self.0.get(&(r, c)).unwrap_or(&EMPTY));
            }
        }
        v
    }
}

fn split_a1(s: &str) -> (u32, u32) {
    let i = s.find(|c: char| c.is_ascii_digit()).unwrap();
    (
        s[i..].parse::<u32>().unwrap() - 1,
        a1_to_col(&s[..i]).unwrap(),
    )
}

fn out(v: &CellValue) -> serde_json::Value {
    use serde_json::json;
    match v {
        CellValue::Num(n) => json!(n),
        CellValue::Text(s) => json!(s),
        CellValue::Bool(b) => json!(b),
        CellValue::Err(_) => json!("#ERR"),
        CellValue::Empty => json!(0.0),
        // serial: days since 1899-12-30 (Excel/LO 1900 system)
        CellValue::Date(d) => {
            let base = chrono::NaiveDate::from_ymd_opt(1899, 12, 30)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap();
            json!((*d - base).num_seconds() as f64 / 86400.0)
        }
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let cases: Vec<serde_json::Value> =
        serde_json::from_str(&std::fs::read_to_string(&a[1]).unwrap()).unwrap();
    let mut res = serde_json::Map::new();
    let mut why = serde_json::Map::new(); // sidecar: engine's own error text per failing case
    for c in cases {
        let mut g = Grid(HashMap::new());
        if let Some(cells) = c["cells"].as_object() {
            for (k, v) in cells {
                let val = match v {
                    serde_json::Value::String(s) => CellValue::Text(s.clone()),
                    _ => CellValue::Num(v.as_f64().unwrap()),
                };
                g.0.insert(split_a1(k), val);
            }
        }
        let f = c["formula"].as_str().unwrap();
        let r = match parse(f) {
            // Failures are reported as "#ERR" so the scorer shows the divergence
            // rather than the adapter hiding it; parse failures are tagged distinctly.
            Err(e) => {
                why.insert(
                    c["id"].as_str().unwrap().into(),
                    format!("parse: {e}").into(),
                );
                serde_json::json!("#PARSE")
            }
            Ok(e) => match eval(&e, &g) {
                Ok(v) => out(&v),
                Err(e) => {
                    why.insert(
                        c["id"].as_str().unwrap().into(),
                        format!("eval: {e}").into(),
                    );
                    serde_json::json!("#ERR")
                }
            },
        };
        res.insert(c["id"].as_str().unwrap().to_string(), r);
    }
    std::fs::write(&a[2], serde_json::to_string_pretty(&res).unwrap()).unwrap();
    std::fs::write(
        format!("{}.why", a[2]),
        serde_json::to_string_pretty(&why).unwrap(),
    )
    .unwrap();
}
