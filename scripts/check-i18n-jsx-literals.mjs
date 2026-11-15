import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const HUMAN_PROPS = new Set([
  "label",
  "data-label",
  "header",
  "aria-label",
  "placeholder",
  "title",
  "subtitle",
  "description",
  "helperText",
  "alt",
  "emptyText",
  "tooltip",
  "caption",
]);
const COPY_CALLS = new Set([
  "t",
  "tUi",
  "tStatic",
  "tExport",
  "translate",
  "copy",
  "text",
  "reportLabel",
  "localizedEnglish",
  "localizeMessage",
  "bilingual",
  "businessLabel",
  "enumLabelOrText",
]);
// These are names/codes, not prose. Keep the list exact: words such as Email,
// Model, Breadcrumb and unaccented Vietnamese must still be translated.
const TECHNICAL_NAMES = new Set([
  "SKU",
  "NFC",
  "RFID",
  "QR",
  "QR / Barcode",
  "QR / NFC",
  "NFC / QR",
  "Barcode",
  "UUID",
  "ID",
  "IP",
  "OTP",
  "MFA",
  "API",
  "HTTP",
  "CSV",
  "PDF",
  "Excel",
  "Excel (.xlsx)",
  "XLSX",
  "SHA-256",
  "WMS",
  "HOA NAM",
  "HOA NAM WMS",
  "Hoa Nam",
  "Hoa Nam WMS",
  "Hoa Nam Web",
  "English",
  "简体中文",
  "Tiếng Việt",
  "Button / IconButton",
  "Tabs / Pagination",
  "Descriptions / Timeline / Avatar / Alert",
  "N/N",
]);
for (const token of [
  "BOX",
  "TRAY",
  "HN",
  "BH",
  "XK",
  "SN",
  "B",
  "KB",
  "MB",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "useUiConfirm()",
  "HTTP 403",
])
  TECHNICAL_NAMES.add(token);
for (const token of ["中文", "SLA", "Barcode/QR", "BOX +"])
  TECHNICAL_NAMES.add(token);
const CSS_WIDTHS = new Set(["calc(50% - 263px)", "calc(50% - 240px)"]);
// Exact finite arrays are metadata for existing translated controls, never
// exemptions for all strings in a file or for arbitrary mapped child text.
const DATA_ARRAYS = new Map([
  [
    "app/layouts/topbar/AppTopbar.tsx",
    [
      [
        "light",
        "sun",
        "topbar.themeLight",
        "dark",
        "moon",
        "topbar.themeDark",
        "system",
        "monitor",
        "topbar.themeSystem",
      ],
    ],
  ],
  [
    "modules/auth/components/profile/ProfilePreferencesPanel.tsx",
    [
      ["light", "dark", "system"],
      ["medium", "large"],
      ["comfortable", "compact"],
    ],
  ],
  [
    "modules/dashboard/overview/SnapshotStockFlowPlot.tsx",
    [["inbound", "outbound", "stock"]],
  ],
  [
    "modules/master-data/components/SkuImportModal.tsx",
    [["select", "review", "done"]],
  ],
  [
    "modules/master-data/pages/ApiMasterScreens.tsx",
    [
      [
        "stt-col",
        "code-col",
        "name-col",
        "description-col",
        "status-col",
        "actions-col",
      ],
    ],
  ],
  [
    "modules/reports/import-match/ImportMatchReport.tsx",
    [
      ["IMPORT", "MATCH"],
      ["table", "snapshot"],
    ],
  ],
  [
    "modules/reports/movement-trace/GoodsTraceReport.tsx",
    [
      ["timeline", "documents", "packing"],
      ["events", "documents", "relations"],
    ],
  ],
]);
// This screen runs before dictionaries load, including when their download
// fails. Its finite EN/ZH bootstrap messages intentionally cannot call t().
const BOOTSTRAP_COPY = new Set([
  "无法加载简体中文",
  "Unable to load English",
  "请检查网络连接后重试。",
  "Check your connection and try again.",
  "重试",
  "Retry",
  "正在加载简体中文…",
  "Loading English…",
  "请稍候，正在准备界面语言。",
  "Please wait while the interface language is prepared.",
]);

function isData(value) {
  const text = value
    .replace(/&(?:nbsp|amp|lt|gt|quot|#\d+|#x[\da-f]+);/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
  const core = text.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
  return (
    !/\p{L}/u.test(text) ||
    TECHNICAL_NAMES.has(text) ||
    TECHNICAL_NAMES.has(core) ||
    CSS_WIDTHS.has(text) ||
    /^\d+(?:\.\d+)?\s*(?:mm|cm|px|MB|MiB|GB|KB|KiB|ms|s|kg|%)$/u.test(text) ||
    /^[A-Z]{2,}(?:[-_.][A-Z0-9]+)+$/u.test(text) ||
    /^(?:https?:\/\/\S+|\/[A-Za-z0-9_./:{}?=&%-]*|#[\da-f]{3,8})$/i.test(
      text,
    ) ||
    /^(?:vi-VN|en-US|en-GB|zh-CN|zh-cn)$/u.test(text) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text) ||
    /^V\d+$/u.test(text) ||
    /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+\.?$/u.test(text) ||
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/u.test(text)
  );
}

export function scanJsxLiterals(source, file = "fixture.tsx") {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const findings = [];
  const seen = new Set();
  function uiProperty(node) {
    if (
      !ts.isPropertyAssignment(node) ||
      !["header", "label"].includes(
        node.name.getText(tree).replaceAll(/["']/g, ""),
      )
    )
      return false;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (
        ts.isCallExpression(parent) &&
        COPY_CALLS.has(parent.expression.getText(tree))
      )
        return false;
      if (ts.isJsxExpression(parent)) return true;
      if (
        ts.isVariableDeclaration(parent) &&
        /columns|options|headers|fields/i.test(parent.name.getText(tree))
      )
        return true;
      if (
        ts.isFunctionDeclaration(parent) &&
        parent.name &&
        /columns|options|headers|fields/i.test(parent.name.text)
      )
        return true;
    }
    return false;
  }
  function cachedStaticCopy(node) {
    if (
      !ts.isCallExpression(node) ||
      node.expression.getText(tree) !== "tStatic"
    )
      return false;
    let inUiProperty = false;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isFunctionLike(parent)) return false;
      if (uiProperty(parent)) inUiProperty = true;
    }
    return inUiProperty;
  }
  function isMetadataArray(node) {
    const expected = [...DATA_ARRAYS].find(([suffix]) =>
      file.replaceAll("\\", "/").endsWith(suffix),
    )?.[1];
    if (!expected) return false;
    const values = (array) =>
      array.elements.flatMap((element) =>
        ts.isStringLiteral(element)
          ? [element.text]
          : ts.isArrayLiteralExpression(element)
            ? values(element)
            : [],
      );
    for (
      let parent = node.parent;
      parent && !ts.isJsxExpression(parent);
      parent = parent.parent
    ) {
      if (
        ts.isArrayLiteralExpression(parent) &&
        expected.some(
          (value) => JSON.stringify(value) === JSON.stringify(values(parent)),
        )
      )
        return true;
    }
    return false;
  }
  function report(node, value, boundary) {
    if (value === "iam.permissionModule.label" && boundary === "property-label")
      return; // typed translation-key metadata, translated by the consumer
    if (
      isData(value) ||
      isMetadataArray(node) ||
      (file
        .replaceAll("\\", "/")
        .endsWith("shared/i18n/EnglishLanguageBoundary.tsx") &&
        BOOTSTRAP_COPY.has(value))
    )
      return;
    const line =
      tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
    const text = value.trim().replace(/\s+/g, " ");
    const key = `${line}|${boundary}|${text}`;
    if (!seen.has(key)) {
      seen.add(key);
      findings.push({ file: file.replaceAll("\\", "/"), line, boundary, text });
    }
  }
  function expression(node, boundary) {
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      report(node, node.text, boundary);
      return;
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      expression(node.expression, boundary);
      return;
    }
    if (ts.isConditionalExpression(node)) {
      const locales = new Set();
      let branch = node;
      while (
        ts.isConditionalExpression(branch) &&
        ts.isBinaryExpression(branch.condition) &&
        ts.isIdentifier(branch.condition.left) &&
        ["language", "locale"].includes(branch.condition.left.text) &&
        ts.isStringLiteral(branch.condition.right) &&
        ["vi", "en", "zh"].includes(branch.condition.right.text)
      ) {
        locales.add(branch.condition.right.text);
        branch = branch.whenFalse;
      }
      if (locales.size >= 2) return;
      expression(node.whenTrue, boundary);
      expression(node.whenFalse, boundary);
      return;
    }
    if (ts.isBinaryExpression(node)) {
      if (
        [
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind)
      )
        expression(node.left, boundary);
      if (
        [
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
        ].includes(node.operatorToken.kind)
      )
        expression(node.right, boundary);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      report(node.head, node.head.text, boundary);
      for (const span of node.templateSpans)
        report(span.literal, span.literal.text, boundary);
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const item of node.elements) expression(item, boundary);
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties)
        if (
          ts.isPropertyAssignment(property) &&
          HUMAN_PROPS.has(property.name.getText(tree).replaceAll(/["']/g, ""))
        )
          expression(property.initializer, boundary);
      return;
    }
    if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
      expression(node.body, boundary);
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : "";
      if (
        COPY_CALLS.has(callee) ||
        [
          "format",
          "toLocaleString",
          "toLocaleDateString",
          "toLocaleTimeString",
          "DateTimeFormat",
          "NumberFormat",
        ].includes(callee)
      )
        return;
      const normalizedFile = file.replaceAll("\\", "/");
      if (
        ["map", "filter", "join", "flatMap"].includes(callee) &&
        ts.isPropertyAccessExpression(node.expression)
      )
        expression(node.expression.expression, boundary);
      let indices;
      if (callee === "warrantyPiiText")
        indices = []; // user data and its name/phone mode
      else if (
        callee === "sortHeader" &&
        /\/(?:InboundPage|AlignedMvpOutboundPage)\.tsx$/.test(normalizedFile)
      )
        indices = [0]; // label, sort key, class
      else if (
        normalizedFile.endsWith("WarrantyListTable.tsx") &&
        callee === "header"
      )
        indices = [1]; // sort key, label, class
      else if (
        normalizedFile.endsWith("WarrantyListTable.tsx") &&
        callee === "cell"
      )
        indices = []; // row data accessor
      else if (
        normalizedFile.endsWith("ProfilePreferencesPanel.tsx") &&
        callee === "select"
      )
        indices = [1, 2]; // field key, label, options
      else if (
        normalizedFile.endsWith("PvAdminPage.tsx") &&
        callee === "pagination"
      )
        indices = [1]; // tab key, total
      else if (
        normalizedFile.endsWith("VirtualList.tsx") &&
        callee === "spacer"
      )
        indices = [1]; // spacer position key, height
      node.arguments.forEach((arg, index) => {
        if (!indices || indices.includes(index)) expression(arg, boundary);
      });
    }
  }
  function visit(node) {
    if (ts.isJsxText(node)) report(node, node.text, "text");
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent))
      expression(node.expression, "expression");
    if (
      ts.isJsxAttribute(node) &&
      HUMAN_PROPS.has(node.name.getText(tree)) &&
      node.initializer
    ) {
      const boundary = node.name.getText(tree);
      if (ts.isStringLiteral(node.initializer))
        report(node.initializer, node.initializer.text, boundary);
      else if (ts.isJsxExpression(node.initializer))
        expression(node.initializer.expression, boundary);
    }
    if (uiProperty(node))
      expression(
        node.initializer,
        `property-${node.name.getText(tree).replaceAll(/["']/g, "")}`,
      );
    if (cachedStaticCopy(node))
      report(
        node,
        "Module-level tStatic() freezes a UI label before language selection",
        "cached-copy",
      );
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return findings;
}

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(target)
      : /\.tsx$/.test(target) && !/\.(test|spec)\./.test(target)
        ? [target]
        : [];
  });
}

export function auditJsxLiterals() {
  return files("src").flatMap((file) =>
    scanJsxLiterals(fs.readFileSync(file, "utf8"), file),
  );
}

export function selfTestJsxLiterals() {
  const raw = scanJsxLiterals(
    '<><button aria-label="Trang sau">Save</button><Input label={ready ? "Model" : "Email"} placeholder={"Write here"} title={`Next ${page}`} /></>',
  );
  for (const value of [
    "Trang sau",
    "Save",
    "Model",
    "Email",
    "Write here",
    "Next",
  ])
    assert(
      raw.some((row) => row.text === value),
      `Missed ${value}`,
    );
  assert.equal(
    scanJsxLiterals(
      '<><span>SKU /</span><Input label={t("common.close")} title={localizeMessage(message)} placeholder="0901234567"/><span>10 MiB</span></>',
    ).length,
    0,
  );
  assert.equal(
    scanJsxLiterals(
      '<div>{["Save", "Continue"].map(label => <button>{label}</button>)}</div>',
    ).length,
    2,
  );
  assert.equal(
    scanJsxLiterals('<div>{language === "vi" ? "Tiếp tục" : "Continue"}</div>')
      .length,
    2,
    "Two-language fallthrough must fail",
  );
  assert.equal(
    scanJsxLiterals(
      '<div>{language === "vi" ? "Tiếp tục" : language === "zh" ? "继续" : "Continue"}</div>',
    ).length,
    0,
  );
  assert(
    scanJsxLiterals(
      '<div>{"light"}</div>',
      "src/modules/auth/components/profile/ProfilePreferencesPanel.tsx",
    ).length === 1,
    "Metadata exemption must not hide standalone text",
  );
  assert(
    scanJsxLiterals(
      '<div title="New human prose"/>',
      "src/shared/i18n/EnglishLanguageBoundary.tsx",
    ).length === 1,
    "Bootstrap exemption must stay finite",
  );
  const properties = scanJsxLiterals(
    'const columns = [{header: "Min"}, {header: "Max"}]; const options = [{label: "Top 20"}, {label: "Email"}];',
  );
  for (const value of ["Min", "Max", "Top 20", "Email"])
    assert(
      properties.some((row) => row.text === value),
      `Missed property ${value}`,
    );
  assert.equal(
    scanJsxLiterals(
      'const options = [{label: "iam.permissionModule.label"}]; const columns = bilingual({label:"Tiếng Việt"},{label:"English"});',
    ).length,
    0,
  );
  assert.equal(
    scanJsxLiterals(
      'const options = [{label:tStatic("shared.table.topCount")}];',
    ).filter((row) => row.boundary === "cached-copy").length,
    1,
  );
  assert.equal(
    scanJsxLiterals(
      'const options = (t) => [{label:t("shared.table.topCount")}];',
    ).length,
    0,
  );
  assert.equal(
    scanJsxLiterals(
      'const options = () => [{label:tStatic("shared.table.topCount")}];',
    ).length,
    0,
  );
  return { selfTests: 12, passed: true };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (process.argv.includes("--self-test")) {
    console.log(JSON.stringify(selfTestJsxLiterals()));
    process.exit(0);
  }
  const findings = auditJsxLiterals();
  const output = process.argv
    .find((value) => value.startsWith("--output="))
    ?.slice(9);
  if (output) fs.writeFileSync(output, JSON.stringify(findings, null, 2));
  console.log(
    JSON.stringify({ rawJsxHumanLiterals: findings.length, findings }),
  );
  if (findings.length) process.exitCode = 1;
}
