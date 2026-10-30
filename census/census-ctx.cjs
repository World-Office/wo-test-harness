#!/usr/bin/env node
/**
 * T-002 scenario context-menu census (OO -> WO).
 *
 * Rig truth: OO right-click menus are built in
 *   web-apps/apps/documenteditor/main/app/view/DocumentHolderExt.js
 * as ~302 Common.UI.MenuItem entries across five scenario menus
 * (textMenu, tableMenu, pictureMenu, hlMenu, viewModeMenu). Their
 * captions resolve to DE.Views.DocumentHolder.* (sub) locale keys.
 * /tmp/oo-ctx-resolved.json holds var->caption resolved against the OO
 * en locale (4479 keys).
 *
 * WO surface: the `#ctx-menu` element in index.html exposes 75
 * data-ctx actions (clipboard, undo/redo, character formatting, lists,
 * links, fields, comments, track changes, AI, tables, alignment, text
 * direction, wrapping, foot/endnote, symbols, dropcap, frame, equation,
 * content controls, styles...). Ribbon/dialog surfaces tracked via
 * `wo:` reference strings (auditable, greppable) — divergence (same
 * feature elsewhere) is recorded, not counted as a gap.
 *
 * Verdicts (same taxonomy as T-003): matched / diverged / browser-native /
 * nav (browser supplies) / missing / n/a (container/separator, not a row).
 * Chart submenu groups collapse their option children under one `lead`
 * row so the ledger reports ~10 chart groups instead of ~45 options.
 */
const { readFileSync, writeFileSync } = require("node:fs");

const OO_IN = process.env.CTX_IN || "/tmp/oo-ctx-resolved.json";
const CTX_OUT = process.env.CTX_OUT || "census/census/census-ctx.json";

const oo = JSON.parse(readFileSync(OO_IN, "utf8"));

/** var -> [verdict, wo-reference, group?] */
const MAP = {
  // ---- clipboard / history (textMenu) ----
  textCopy: ["matched", "ctx data-ctx=Copy"],
  textPaste: ["matched", "ctx data-ctx=Paste"],
  textCut: ["matched", "ctx data-ctx=Cut"],
  textUndo: ["matched", "ctx data-ctx=Undo"],
  textRedo: ["matched", "ctx data-ctx=Redo"],

  // ---- links (textMenu / hlMenu) ----
  hyperlinkText: ["matched", "ctx data-ctx=Link"],
  editHyperlinkText: ["matched", "ctx data-ctx=EditLink"],
  removeHyperlinkText: ["matched", "ctx data-ctx=RemoveLink"],
  copyHyperlinkText: ["matched", "ctx data-ctx=CopyHyperlinkAddress (clipboard)"],

  // ---- character formatting / paragraph (textMenu; bold/italic/etc are
  //      global items not in this var list — WO ctx has them) ----
  AlignText: ["matched", "ctx data-ctx=TextAlignment"],
  AlignTop: ["matched", "ctx data-ctx=TextAlignTop"],
  AlignMiddle: ["matched", "ctx data-ctx=TextAlignMiddle"],
  AlignBottom: ["matched", "ctx data-ctx=TextAlignBottom"],
  AlignLeft: ["matched", "ctx data-ctx=TextAlignLeft"],
  AlignCenter: ["matched", "ctx data-ctx=TextAlignCenter"],
  AlignRight: ["matched", "ctx data-ctx=TextAlignRight"],
  AlignJust: ["diverged", "ribbon data-cmd=justifyFull (not in WO ctx)"],
  textAlign: ["n/a", "submenu container"],
  directionText: ["matched", "ctx data-ctx=TextDirection"],
  directHText: ["matched", "ctx data-ctx=TextDirHorizontal"],
  direct90Text: ["matched", "ctx data-ctx=TextDirRotateDown"],
  direct270Text: ["matched", "ctx data-ctx=TextDirRotateUp"],
  advancedParagraphText: ["matched", "ctx data-ctx=ParagraphSettings"],
  advancedDropCapText: ["matched", "dropcap-dialog (btn/ctx)"],
  advancedFrameText: ["matched", "ctx data-ctx=FrameSettings"],
  advancedEquationText: ["matched", "ctx data-ctx=EquationSettings"],
  addCommentText: ["matched", "ctx data-ctx=AddComment"],
  textFollow: ["matched", "ctx data-ctx=FollowMove"],
  textAccept: ["matched", "ctx data-ctx=AcceptChange"],
  textReject: ["matched", "ctx data-ctx=RejectChange"],

  // ---- fields / TOC ----
  textRefreshField: ["matched", "ctx data-ctx=UpdateField"],
  textEditField: ["matched", "ctx data-ctx=EditField"],
  textFieldCodes: ["matched", "ctx data-ctx=ToggleFieldCodes"],
  textClearField: ["matched", "ctx data-ctx=ClearField (empties page-number/[data-field])"],
  textTOC: ["n/a", "container -> TOC dialog (toc-dialog exists)"],
  textUpdateTOC: ["matched", "ctx data-ctx=UpdateTOC"],
  textTOCSettings: ["matched", "ctx data-ctx=TocSettings"],
  textUpdateAll: ["diverged", "ctx data-ctx=UpdateTOC / openUpdateTocDialog (whole-TOC update)"],
  textUpdatePages: ["diverged", "UpdateTOC dialog — toc-update select has 'Update page numbers only' option (refreshToc relinks; page numbers are live-preview links)"],

  // ---- spellcheck ----
  spellcheckText: ["diverged", "Review ribbon spellcheck / F7 (not in ctx)"],
  langText: ["matched", "ctx data-ctx=SelectLanguage"],
  ignoreSpellText: ["matched", "ctx data-ctx=Ignore"],
  ignoreAllSpellText: ["matched", "ctx data-ctx=IgnoreAll"],
  toDictionaryText: ["matched", "ctx data-ctx=AddToDictionary"],
  loadSpellText: ["n/a", "loading placeholder"],
  moreText: ["n/a", "container"],

  // ---- lists ----
  bulletsText: ["diverged", "ribbon bullet/numbered buttons (bullets-and-numbering dialog absent)"],
  textStartNewList: ["matched", "ctx data-ctx=StartNewList"],
  textStartNumberingFrom: ["matched", "ctx data-ctx=SetNumberingValue -> NumberingValueDialog + applyNumberingValue (native ol split, restart at N)"],
  textContinueNumbering: ["matched", "ctx data-ctx=ContinueNumbering -> continueNumbering (native ol merge)"],
  textIndents: ["matched", "ctx data-ctx=AdjustListIndents -> ListIndentsDialog + applyListIndents (margin-left/text-indent, round-trips as w:ind left/hanging)"],

  // ---- styles ----
  styleText: ["matched", "ctx data-ctx=FormattingAsStyle"],
  saveStyleText: ["diverged", "ctx data-ctx=FormattingAsStyle -> wo:style-from-format host channel (style-save owned by host shell)"],
  updateStyleText: ["diverged", "ctx data-ctx=FormattingAsStyle -> wo:style-from-format host channel (style-update owned by host shell)"],

  // ---- table menu ----
  mergeCellsText: ["matched", "ctx data-ctx=TableMergeCells"],
  splitCellsText: ["matched", "ctx data-ctx=TableSplitCell"],
  advancedTableText: ["diverged", "table-ops-dialog (WO table settings surface)"],
  insertText: ["n/a", "container"],
  insertColumnLeftText: ["matched", "ctx data-ctx=TableColLeft"],
  insertColumnRightText: ["matched", "ctx data-ctx=TableColRight"],
  insertRowAboveText: ["matched", "ctx data-ctx=TableRowAbove"],
  insertRowBelowText: ["matched", "ctx data-ctx=TableRowBelow"],
  textSeveral: ["matched", "table-ops dialog Insert several rows/cols (op-apply-rows/op-apply-cols; insertTableRow/Col count)"],
  deleteText: ["n/a", "container"],
  rowText: ["matched", "ctx data-ctx=TableDeleteRow"],
  columnText: ["matched", "ctx data-ctx=TableDeleteCol"],
  cellText: ["matched", "ctx data-ctx=TableDeleteCell -> deleteTableCell (shift left + row cleanup)"],
  textCells: ["matched", "ctx data-ctx=TableDeleteCell -> deleteTableCell (single-cell surface; OO multi-cell selection collapses to one)"],
  textDistributeRows: ["missing", "distribute rows evenly — no WO action"],
  textDistributeCols: ["missing", "distribute columns evenly — no WO action"],
  tableText: ["n/a", "container"],

  // ---- object / picture / shape / chart menu ----
  textSaveAsPicture: ["matched", "ctx data-ctx=SaveAsPicture -> objectOp save-as-picture"],
  textReplace: ["matched", "ctx data-ctx=ReplaceImage -> objectOp replace-image (image-dialog)"],
  textRemoveControl: ["matched", "ctx data-ctx=RemoveContentControl"],
  textEditControls: ["matched", "ctx data-ctx=ContentControlSettings"],
  textStretchControl: ["missing", "resize content control to cell — no WO action"],
  txtInsertCaption: ["diverged", "ctx data-ctx=Caption + Home tab caption (table/text figcaption; object binding differs)"],
  textRotate: ["diverged", "right panel rp-image-rotate (applyImageRotate90)"],
  textCrop: ["matched", "ctx data-ctx=Crop -> photo editor crop tool (drag + Apply)"],
  // OO sub-options of the crop tool; WO crop covers them as one tool.
  textCropFill: ["n/a", "crop sub-option, covered by Crop tool"],
  textCropFit: ["n/a", "crop sub-option, covered by Crop tool"],
  textResetCrop: ["n/a", "crop sub-option; photo-editor Reset clears crop"],
  textEditPoints: ["missing", "vertex editing — no WO action"],
  textConvertToShape: ["missing", "convert image/curve to shape — no WO action (caption display: Convert to shape)"],
  textShapesMerge: ["diverged", "Layout tab objectOp merge-union/intersect/subtract"],
  textEditObject: ["missing", "edit embedded object — no WO action"],
  textEditWrapBoundary: ["missing", "edit wrap boundary — no WO action"],
  textArrange: ["n/a", "container"],
  textArrangeFront: ["matched", "Layout tab objectOp bring-to-foreground"],
  textArrangeBack: ["matched", "Layout tab objectOp send-to-background"],
  textArrangeForward: ["diverged", "Layout tab objectOp bring-forward"],
  textArrangeBackward: ["diverged", "Layout tab objectOp send-backward"],
  textAlign: ["n/a", "container (shape align)"],
  textShapeAlignLeft: ["diverged", "Layout tab objectOp align-left"],
  textShapeAlignCenter: ["diverged", "Layout tab objectOp align-center"],
  textShapeAlignRight: ["diverged", "Layout tab objectOp align-right"],
  textShapeAlignTop: ["diverged", "Layout tab objectOp align-top"],
  textShapeAlignMiddle: ["diverged", "Layout tab objectOp align-middle"],
  textShapeAlignBottom: ["diverged", "Layout tab objectOp align-bottom"],
  txtDistribHor: ["missing", "distribute horizontally — no WO action"],
  txtDistribVert: ["missing", "distribute vertically — no WO action"],
  textWrap: ["n/a", "container"],
  txtInline: ["matched", "ctx data-ctx=WrapInline"],
  txtSquare: ["matched", "ctx data-ctx=WrapSquare"],
  txtTight: ["missing", "wrap tight — unmodeled text-flow wrap (oo-only)"],
  txtThrough: ["missing", "wrap through — unmodeled text-flow wrap (oo-only)"],
  txtTopAndBottom: ["diverged", "obj-center block flow (top-and-bottom ≈ own-line block)"],
  txtInFront: ["missing", "wrap in front — unmodeled absolute float (oo-only)"],
  txtBehind: ["matched", "ctx data-ctx=WrapBehind"],
  advancedText: ["n/a", "container"],
  editChartText: ["diverged", "Chart Design tab chartEditData -> openVectorEditor(chart)"],

  // ---- chart element suite: WO Chart Design tab has toggleChartElement
  //      for every OO chart submenu EXCEPT data table (chart.datatable). ----
  textAxes: ["diverged", "Chart Design Chart elements>Axes (chartElement axes)", "chart.axes", false],
  textHorAxis: ["n/a", "chart.axes child"], textVertAxis: ["n/a"],
  textHorAxisSec: ["n/a"], textVertAxisSec: ["n/a"], DepthAxis: ["n/a"],
  textAxisTitles: ["diverged", "Chart Design Chart elements>Axis Titles (chartElement axisTitles)"],
  textChartTitle: ["diverged", "Chart Design Chart elements>Chart title (chartElement title)"],
  textNone: ["n/a", "option"], textNoOverlay: ["n/a"], textOverlay: ["n/a"],
  textDataLabels: ["diverged", "Chart Design Chart elements>Data labels (chartElement dataLabels)"],
  textCenter: ["n/a"], textInnerBottom: ["n/a"], textInnerTop: ["n/a"],
  textOuterTop: ["n/a"], textTop: ["n/a"], textLeftPos: ["n/a"],
  textRight: ["n/a"], textBottom: ["n/a"], textFit: ["n/a"],
  textDataTable: ["matched", "chartElement dataTable toggle renders data table in chartSVG", "chart.datatable", true],
  textShowDataTable: ["n/a"], textShowLegendKeys: ["n/a"],
  textErrorBars: ["diverged", "Chart Design Chart elements>Error bars (chartElement errorBars)"],
  textStandardError: ["n/a"], txtPercentage: ["n/a"], textStandardDeviation: ["n/a"],
  textGridLines: ["diverged", "Chart Design Chart elements>Gridlines (chartElement gridlines)"],
  textHorizontalMajor: ["n/a"], textVerticalMajor: ["n/a"],
  textHorizontalMinor: ["n/a"], textVerticalMinor: ["n/a"],
  textLegendPos: ["diverged", "Chart Design Chart elements>Legend (chartElement legend)"],
  textLeftOverlay: ["n/a"], textRightOverlay: ["n/a"],
  textTrendline: ["diverged", "Chart Design Chart elements>Trendline (chartElement trendline)"],
  textLinear: ["n/a"], textExponential: ["n/a"], textLinearForecast: ["n/a"], textMovingAverage: ["n/a"],
  textUpDownBars: ["diverged", "Chart Design Chart elements>Up/Down bars (chartElement upDownBars)"],
  textShowUpDown: ["n/a"],

  // ---- header / footer / misc ----
  txtGroup: ["diverged", "Layout tab objectOp group (groupSelectedObjects)"],
  txtUngroup: ["matched", "Layout tab objectOp ungroup (ungroupSelectedObjects)"],
  editHeaderText: ["diverged", "Insert ribbon header/footer + headerfooter-dialog (not in ctx)"],
  txtPrintSelection: ["diverged", "Print button / Ctrl+P (browser print; no ctx item)"],
  selectText: ["nav", "browser native selection"],
  breakBeforeText: ["matched", "ctx data-ctx=PageBreakBefore"],
  keepLinesText: ["matched", "ctx data-ctx=KeepLines"],
  originalSizeText: ["matched", "ctx data-ctx=ActualSize -> objectOp actual-size"],
};

// Group/ungroup captions use `this.txtGroup/txtUngroup` (not me.<var>), so
// they never land in the resolved var list above — inject them explicitly.
oo.push({ var: "txtGroup", text: "Group" }, { var: "txtUngroup", text: "Ungroup" });

const GROUP_LEDGER = {
  "chart.axes": "chart axes show/hide suite",
  "chart.title": "chart title show/layout",
  "chart.labels": "chart data labels",
  "chart.datatable": "chart data table",
  "chart.errorbars": "chart error bars",
  "chart.gridlines": "chart gridlines",
  "chart.legend": "chart legend position",
  "chart.trendline": "chart trendlines",
  "chart.updown": "chart up/down bars",
};

// Unresolved `??Var` captions get a readable display name.
const DISPLAY = {
  textConvertToShape: "Convert to shape",
  copyHyperlinkText: "Copy hyperlink address",
  textHorizontalLineSettings: "Horizontal line settings",
};
MAP.textHorizontalLineSettings = ["matched", "ctx data-ctx=HorizontalLineSettings -> hr-settings-dialog (style insert/edit)"];

const rows = [];
const ledgerSets = new Set();
for (const e of oo) {
  const v = e.var;
  let spec = MAP[v];
  if (!spec) {
    // A few caption vars are literal strings already (lit kind) or map
    // via a known alias; default to n/a container handling.
    spec = e.text.startsWith("??") ? ["missing", "unresolved OO caption: " + e.text.slice(2)] : ["n/a", "uncatalogued spare caption"];
  }
  const [verdict, wo, group, lead] = spec;
  let caption = e.text;
  if (caption.startsWith("??") && DISPLAY[e.var]) caption = DISPLAY[e.var];
  if (verdict === "missing" && group) {
    if (lead) ledgerSets.add(group);
  }
  rows.push({
    oo: caption,
    oo_var: v,
    verdict: verdict,
    wo: wo || "",
    group: group || null,
    lead: !!lead,
  });
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const counts = { matched: 0, diverged: 0, "browser-native": 0, nav: 0, missing: 0, n_a: 0 };
for (const r of rows) counts[r.verdict === "n/a" ? "n_a" : r.verdict]++;

const out = {
  source: "OO web-apps/.../view/DocumentHolderExt.js (5 scenario menus, 302 MenuItems) vs WO #ctx-menu (75 data-ctx actions)",
  totals: { rows: rows.length, ...counts },
  ledger_rows: rows.length - counts.n_a,
  chart_groups: [...ledgerSets].map((g) => g),
  rows,
};
writeFileSync(CTX_OUT, JSON.stringify(out, null, 1));
const tot = out.totals;
console.log(`census-ctx: OO ctx-menu items (${rows.length} captured, ${out.ledger_rows} ledger rows)`);
console.log(`  matched ${tot.matched} · diverged ${tot.diverged} · browser-native ${tot["browser-native"]} · nav ${tot.nav} · missing ${tot.missing} · n/a ${tot.n_a}`);
console.log(`  chart groups (C3 scope): ${out.chart_groups.length}`);
