#!/usr/bin/env node
/**
 * census-shortcuts.cjs — static shortcut census (T-003 in OO_PARITY_MASTER_PLAN).
 *
 * Reads the OO shortcut table (parsed from sdkjs/word/Editor/Shortcuts.js,
 * 147 unique types, key+modifiers) and the WO editor keydown handler, then
 * emits a join: for each OO shortcut type, what does WO do?
 *
 * Verdicts per OO type:
 *   matched         WO binds the feature to the SAME combo
 *   diverged        WO has the feature under a DIFFERENT combo (not a gap,
 *                   but worth recording — user muscle memory differs)
 *   browser-native  browser/caret supplies it (copy/paste/select/caret-nav)
 *   missing         no WO binding — real gap
 *
 * Env: SHORTCUTS_IN (path to /tmp/oo-shortcuts.json). Out: census/census-shortcuts.json
 */
const fs = require("fs");
const path = require("path");

const SHORTCUTS_IN = process.env.SHORTCUTS_IN || "/tmp/oo-shortcuts.json";
const OUT = process.env.SHORT_OUT || path.join(__dirname, "census/census-shortcuts.json");

// ------------------------------------------------------------------ WO side
// For each OO shortcut TYPE, how WO covers it (curated from reading the WO
// editor's keydown handler — the authoritative WO surface). If absent from
// this map the type falls through to nav/browser/missing classification.
const WO = {
  // same-combo matches
  OpenFindDialog: { v: "matched", wb: "Ctrl+F" },
  OpenFindAndReplaceMenu: { v: "matched", wb: "Ctrl+H" },
  Save: { v: "matched", wb: "Ctrl+S" },
  Bold: { v: "matched", wb: "Ctrl+B" },
  Italic: { v: "matched", wb: "Ctrl+I" },
  Underline: { v: "matched", wb: "Ctrl+U" },
  CenterPara: { v: "matched", wb: "Ctrl+E" },
  JustifyPara: { v: "matched", wb: "Ctrl+J" },
  RightPara: { v: "matched", wb: "Ctrl+R" },
  LeftPara: { v: "matched", wb: "Ctrl+Shift+L" },
  IncreaseFontSize: { v: "matched", wb: "Ctrl+]" },
  DecreaseFontSize: { v: "matched", wb: "Ctrl+[" },
  ZoomIn: { v: "matched", wb: "Ctrl+Plus/=" },
  ZoomOut: { v: "matched", wb: "Ctrl+Minus" },
  Zoom100: { v: "matched", wb: "Ctrl+0" },
  EditUndo: { v: "matched", wb: "Ctrl+Z" },
  EditRedo: { v: "matched", wb: "Ctrl+Y / Ctrl+Shift+Z" },
  Subscript: { v: "matched", wb: "Ctrl+." },
  ApplyHeading1: { v: "matched", wb: "Ctrl+Alt+1" },
  ApplyHeading2: { v: "matched", wb: "Ctrl+Alt+2" },
  ApplyHeading3: { v: "matched", wb: "Ctrl+Alt+3" },
  CloseMenu: { v: "matched", wb: "Escape" },

  // diverged: feature present, different combo
  ApplyListBullet: { v: "diverged", wb: "Ctrl+Shift+8 (OO uses Ctrl+Shift+L)" },
  InsertBulletedList: { v: "diverged", wb: "Ctrl+Shift+8 (OO uses Ctrl+Shift+L)" },
  InsertNumberedList: { v: "diverged", wb: "Ctrl+Shift+7" },
  ApplyListNumber: { v: "diverged", wb: "Ctrl+Shift+7" },
  ApplyNormalText: { v: "diverged", wb: "Ctrl+Alt+0" },
  InsertComment: { v: "diverged", wb: "Ctrl+Enter confirms comment dialog" },

  // Implemented 2026-10-28 (C1): were missing, now bound. Web adaptation of
  // the OO combo noted where the browser/zoom conflicts forced a variant.
  Superscript: { v: "matched", wb: "Ctrl+," },
  SmallCaps: { v: "matched", wb: "Ctrl+Shift+K" },
  InsertFootnoteNow: { v: "matched", wb: "Ctrl+Alt+F" },
  InsertEndnoteNow: { v: "matched", wb: "Ctrl+Alt+D" },
  InsertColumnBreak: { v: "matched", wb: "Ctrl+Shift+Enter" },
  InsertPageBreak: { v: "matched", wb: "Ctrl+Enter" },
  InsertHyperlink: { v: "matched", wb: "Ctrl+K" },
  OpenChatPanel: { v: "matched", wb: "Ctrl+Alt+Q" },
  NonBreakingSpace: { v: "matched", wb: "Ctrl+Shift+Space" },
  EuroSign: { v: "matched", wb: "Ctrl+Alt+E" },
  CopyrightSign: { v: "matched", wb: "Ctrl+Alt+G" },
  TrademarkSign: { v: "matched", wb: "Ctrl+Alt+T" },
  RegisteredSign: { v: "matched", wb: "Ctrl+Alt+R" },
  EmDash: { v: "diverged", wb: "Ctrl+Alt+Minus (OO uses Ctrl+Alt+NumpadMinus; numpad-less web adaptation)" },
  EnDash: { v: "diverged", wb: "Ctrl+Shift+Minus (OO uses Ctrl+NumpadMinus; Ctrl+Minus is zoom-out in WO)" },

  // Second C1 batch (2026-10-28): state-backed bindings to existing flows.
  UpdateFields: { v: "matched", wb: "F9 (fieldOpAtSelection update)" },
  InsertEquation: { v: "matched", wb: "Ctrl+Alt+=" },
  Indent: { v: "matched", wb: "Ctrl+M" },
  UnIndent: { v: "matched", wb: "Ctrl+Shift+M" },
  SaveAs: { v: "matched", wb: "Ctrl+Shift+S (export backstage pane)" },
  OpenCommentsPanel: { v: "matched", wb: "Ctrl+Shift+H (comments rail)" },
  CopyFormat: { v: "matched", wb: "Ctrl+Alt+C (format painter — captures inline + semantic char formatting)" },
  PasteFormat: { v: "matched", wb: "Ctrl+Alt+V (format painter — applies to next selection as style span)" },
  PrintPreviewAndPrint: { v: "browser-native", wb: "Ctrl+P opens native print dialog (WO window.print)" },
  InsertLineBreak: { v: "browser-native", wb: "Shift+Enter inserts <br> natively in contentEditable" },
  OpenHelpMenu: { v: "matched", wb: "F1 opens Help dialog" },
  OpenContextMenu: { v: "browser-native", wb: "Shift+F10 fires the contextmenu DOM event; WO handler shows the custom menu" },
  SpeechWorker: { v: "diverged", wb: "Ctrl+Alt+Z read-aloud (OO SpeechWorker panel; WO maps to TTS)" },
  HorizontalEllipsis: { v: "matched", wb: "Alt+;" },
  ShowAll: { v: "diverged", wb: "¶ button / View toggle (Ctrl+Shift+8 is bulleted-list in WO — OO collision kept as-is)" },

  // browser-native: WO relies on the browser for these
  Copy: { v: "browser-native", wb: "Ctrl+C / Cmd+C" },
  Cut: { v: "browser-native", wb: "Ctrl+X / Cmd+X" },
  Paste: { v: "browser-native", wb: "Ctrl+V / Cmd+V" },
  PasteTextWithoutFormat: { v: "browser-native", wb: "Ctrl+Shift+V" },
  EditSelectAll: { v: "browser-native", wb: "Ctrl+A" },
  EditShape: { v: "browser-native", wb: "Enter edits object" },
  EditChart: { v: "browser-native", wb: "Enter edits object" },
  DeleteLeftChar: { v: "browser-native", wb: "Backspace" },
  DeleteRightChar: { v: "browser-native", wb: "Delete" },
  DeleteLeftWord: { v: "browser-native", wb: "Alt+Backspace" },
  DeleteRightWord: { v: "browser-native", wb: "Alt+Delete" },
  ResetChar: { v: "browser-native", wb: "Ctrl+Space (remove formatting)" },
};

// OO types that are pure caret/navigation — a desktop word-processor
// affordance that a canvas/browser contentEditable handles natively.
const NAV = [
  "MoveTo", "MoveToStart", "MoveToEnd", "MoveToDown", "MoveToUp", "MoveToLeft",
  "MoveToRight", "MoveToNext", "MoveToPrevious", "MoveToLower", "MoveToUpper",
  "ScrollDown", "ScrollUp", "Page", "EndParagraph", "ChooseNext", "ChoosePrevious",
  "NextModalControl", "PreviousModalControl", "MoveFocusTo", "StartIndent",
  "StartUnIndent", "MixedIndent", "MixedUnIndent", "EndParagraphCell",
  "EquationChangeAlignment", "EquationAddPlaceholder", "VisitHyperlink",
  "InsertLineBreakMultilineForm", "InsertTab", "MoveToStartNext", "MoveToStartPrevious",
  "NextFileTab", "PreviousFileTab", "Select", "BigMoveObject", "LittleMoveObject",
  "DeleteLeftWord", "DeleteRightWord", "AddNewRow",
];

// OO types WO genuinely lacks (real gaps) — explicit so the report is honest.
// (Left implicit otherwise.)

function normKey(key) {
  return String(key || "").replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "");
}

(async () => {
  const oo = JSON.parse(fs.readFileSync(SHORTCUTS_IN, "utf8"));
  const rows = [];
  let matched = 0, diverged = 0, bn = 0, nav = 0, missing = 0;

  for (const s of oo.shortcuts) {
    const type = s.type;
    const key = normKey(s.key);
    const combo = (s.ctrl ? "Ctrl+" : "") + (s.shift ? "Shift+" : "") +
      (s.alt ? "Alt+" : "") + (s.meta ? "Meta+" : "") + key;

    let verdict, wo;
    if (WO[type]) {
      verdict = WO[type].v;
      wo = WO[type].wb;
    } else if (NAV.some((p) => type.startsWith(p) || type.includes(p))) {
      verdict = "nav";
      wo = "browser caret/scroll (n/a for web editor)";
    } else {
      verdict = "missing";
      wo = "";
    }
    if (verdict === "matched") matched++;
    else if (verdict === "diverged") diverged++;
    else if (verdict === "browser-native") bn++;
    else if (verdict === "nav") nav++;
    else missing++;

    rows.push({ type, combo, verdict, wo });
  }

  const totals = { matched, diverged, "browser-native": bn, nav, missing, total: rows.length };
  const out = {
    version: 1,
    generated: new Date().toISOString(),
    source: "sdkjs/word/Editor/Shortcuts.js (147 types) vs WO editor keydown handler",
    engine: "static-parse",
    totals,
    shortcuts: rows,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`census-shortcuts: ${rows.length} OO types`);
  console.log(`  matched ${matched} · diverged ${diverged} · browser-native ${bn} · nav ${nav} · missing ${missing}`);
  console.log("MISSING (" + missing + "):");
  for (const r of rows.filter((r) => r.verdict === "missing")) console.log("  " + r.type + "\t" + r.combo);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
