/**
 * HÀNG RÀO NGÔN NGỮ — chống tái diễn lỗi "đổi sang English mà màn hình vẫn còn
 * tiếng Việt" (phản hồi người dùng 2026-09-03).
 *
 * Ba thứ được khoá ở đây, tương ứng ba cách một chuỗi có thể lọt lưới:
 *
 *  1. `messages.ts` — mọi khoá VI phải có bản EN. `t()` cố ý rơi về tiếng Việt
 *     khi thiếu khoá (fail-safe, không bao giờ lộ khoá thô ra UI), nhưng chính
 *     cơ chế đó khiến khoá thiếu EN trở nên VÔ HÌNH: không lỗi, không cảnh báo,
 *     chỉ là một dòng tiếng Việt nằm giữa màn tiếng Anh.
 *  2. Các bảng nhãn NGOÀI messages.ts (nhãn theo enum BE, nhãn nút mặc định, ô
 *     rỗng) — đọc trực tiếp ở hai ngôn ngữ để chắc chắn chúng thật sự đổi.
 *  3. Component — không được có chuỗi tiếng Việt trần trong JSX/prop.
 *
 * Xem thêm `i18n-english-render.test.tsx`: bản kiểm ĐỘNG, mount màn thật ở EN
 * rồi quét DOM. Hai file bổ trợ nhau — tĩnh bắt chỗ chưa chuyển, động bắt chỗ
 * đã chuyển nhưng vẫn ra tiếng Việt lúc chạy.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { MESSAGES_VI } from "@/shared/i18n/messages";
import { MESSAGES_EN } from "@/shared/i18n/messages.en";
import {
  AUDIT_ACTION_LABELS,
  INBOUND_STATUS_LABELS,
  INVENTORY_STOCK_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  OUTBOUND_STATUS_LABELS,
  UNKNOWN_BUSINESS_LABEL,
} from "@/shared/constants/business-labels";
import { ACTION_KINDS } from "@/shared/components/actions/action-kinds";
import {
  CHECK_LABELS,
  LABELS as STOCK_RECONCILE_LABELS,
  NORM_STATE_LABELS,
} from "@/modules/reports/stock-reconcile/stock-reconcile-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { BACKEND_CLIENT_ERRORS } from "@/shared/i18n/backend-catalog-client-errors";
import { reportLabel } from "@/shared/i18n/report-labels";

const SRC = join(process.cwd(), "src");

/** Ký tự chỉ có trong bảng chữ tiếng Việt (không trùng ký tự nào của EN). */
const VN =
  /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;

/**
 * File mà tiếng Việt là DỮ LIỆU chứ không phải chuỗi giao diện chờ dịch.
 * Mỗi mục phải nêu được lý do; không thêm mục mới chỉ để test hết đỏ.
 */
const VIETNAMESE_IS_DATA: ReadonlyMap<string, string> = new Map([
  [
    "src/modules/auth/pages/profile.fixture.ts",
    "profile fixture names and roles are example user data",
  ],
  [
    "src/shared/ui/icons/icon-font-health.ts",
    "console.error chẩn đoán cho DEV khi font icon hỏng — không phải chuỗi UI; " +
      "hướng dẫn chạy lệnh yarn nên giữ tiếng Việt thô, không đi qua bảng chuỗi",
  ],
  // Bảng chuỗi và lớp phủ EN của nó.
  ["src/shared/i18n/messages.ts", "bảng chuỗi VI"],
  [
    "src/shared/i18n/messages.en.ts",
    "bảng chuỗi EN; tên ngôn ngữ giữ nguyên bản ngữ là đúng UX",
  ],
  [
    "src/shared/i18n/messages.zh.ts",
    "bảng chuỗi ZH; tên Tiếng Việt giữ nguyên bản ngữ trong bộ chọn ngôn ngữ",
  ],
  ["src/shared/i18n/nav-labels.ts", "lớp phủ EN cho menu và tiêu đề trang"],
  [
    "src/shared/i18n/nav-labels.zh.ts",
    "lớp phủ ZH; khoá route tiếng Việt là dữ liệu đối sánh",
  ],
  ["src/shared/i18n/language.store.ts", '"Tiếng Việt" là tên ngôn ngữ'],
  // Bảng nhãn song ngữ: cả hai thứ tiếng nằm ngay trong file.
  [
    "src/shared/constants/business-labels.ts",
    "map nhãn theo enum BE, song ngữ",
  ],
  ["src/shared/constants/display.ts", "EMPTY_TEXT song ngữ"],
  [
    "src/shared/components/actions/action-kinds.tsx",
    "nhãn nút mặc định, song ngữ",
  ],
  [
    "src/modules/reports/operations/report-labels.ts",
    "map nhãn báo cáo, song ngữ",
  ],
  [
    "src/modules/reports/movement-trace/movement-trace-labels.ts",
    "map nhãn movement, song ngữ",
  ],
  [
    "src/modules/reports/warranty-components/warranty-components-model.ts",
    "map nhãn bảo hành, song ngữ",
  ],
  [
    "src/modules/reports/import-match/import-match-model.ts",
    "map nhãn import-match, song ngữ",
  ],
  [
    "src/modules/reports/stock-reconcile/stock-reconcile-labels.ts",
    "map nhãn tồn kho & đối soát, song ngữ",
  ],
  [
    "src/modules/reports/packing-label/packing-label-labels.ts",
    "map nhãn lỗi in / trạng thái bản lưu nhãn, song ngữ",
  ],
  [
    "src/modules/audit-logs/constants/audit-log-labels.ts",
    "map nhãn loại đối tượng / trường dữ liệu nhật ký, song ngữ",
  ],
  [
    "src/shared/constants/agency-place-labels.ts",
    "map thị trường song ngữ + tên tỉnh/thành (danh từ riêng, không dịch)",
  ],
  // Nguồn VI của cây menu; bản EN nằm ở nav-labels.ts.
  ["src/app/layouts/nav-data.ts", "nhãn menu VI; EN ở nav-labels.ts"],
  // Chuỗi tiếng Việt là DỮ LIỆU đối sánh / payload gửi BE, không phải nhãn.
  ["src/shared/api/http.ts", "console.warn chỉ chạy ở DEV"],
]);

/**
 * Màn CHƯA chuyển hết sang i18n. Danh sách này chỉ được phép NGẮN ĐI.
 * Màn mới phải dùng `useT()` ngay từ đầu, không được thêm vào đây.
 */
const PENDING_FILES: ReadonlySet<string> = new Set([]);

function leafPaths(tree: unknown, prefix = ""): string[] {
  if (typeof tree !== "object" || tree === null) return [];
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : leafPaths(value, path);
  });
}

function readLeaf(tree: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      tree,
    );
}

function withLanguage<T>(language: "vi" | "en" | "zh", read: () => T): T {
  const previous = useLanguageStore.getState().language;
  useLanguageStore.getState().setLanguage(language);
  try {
    return read();
  } finally {
    useLanguageStore.getState().setLanguage(previous);
  }
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // `src/test` là hạ tầng test (fixture, setup), không phải giao diện.
      if (entry !== "test") sourceFiles(full, found);
      continue;
    }
    if (/\.tsx?$/u.test(entry) && !/\.test\.tsx?$/u.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

/** Bỏ comment để chữ tiếng Việt trong ghi chú code không bị tính là chuỗi UI. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/gu, "$1");
}

function hardcodedVietnamese(code: string): string[] {
  const body = stripComments(code);
  const hits: string[] = [];
  for (const match of body.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/gu)) {
    if (VN.test(match[2])) hits.push(match[2]);
  }
  for (const match of body.matchAll(/>([^<>{}]+)</gu)) {
    const text = match[1].trim();
    if (text && VN.test(text)) hits.push(text);
  }
  return hits;
}

/** Only the source column of the declared backend translation tuples is data. */
function backendCatalogSourceData(file: string, code: string): string {
  if (
    !/^src\/shared\/i18n\/(?:backend-catalog-(?:batch-\d+(?:-extra|-dynamic)?|client-errors)|frontend-service-catalog)\.ts$/.test(
      file,
    )
  ) {
    return code;
  }
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const sourceRanges: Array<[number, number]> = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      /^(?:BACKEND_CATALOG_BATCH_\d+(?:_EXTRA|_DYNAMIC)?|BACKEND_CLIENT_ERRORS|FRONTEND_SERVICE_MESSAGES)$/.test(
        node.name.getText(ast),
      ) &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      for (const entry of node.initializer.elements) {
        if (
          ts.isArrayLiteralExpression(entry) &&
          (entry.elements.length === 3 ||
            (entry.elements.length === 4 &&
              ts.isObjectLiteralExpression(entry.elements[3]))) &&
          entry.elements.slice(0, 3).every(ts.isStringLiteralLike)
        ) {
          sourceRanges.push([
            entry.elements[0].getStart(ast),
            entry.elements[0].getEnd(),
          ]);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  let masked = code;
  for (const [start, end] of sourceRanges.sort((a, b) => b[0] - a[0])) {
    masked = `${masked.slice(0, start)}""${masked.slice(end)}`;
  }
  return masked;
}

/** Recognize translation inputs and lookup data without exempting whole UI files. */
function localizedSourceData(file: string, code: string): string {
  const input = backendCatalogSourceData(file, code);
  const ast = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true);
  const bindings = new Map<string, ts.Expression>();
  const ranges: Array<[number, number]> = [];
  const knownClientSources = new Set(
    BACKEND_CLIENT_ERRORS.map(([source]) => source),
  );
  const clientSource = (expression: ts.Expression): string => {
    let variable = 0;
    const part = (node: ts.Expression): string => {
      if (ts.isStringLiteralLike(node)) return node.text;
      if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node))
        return part(node.expression);
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken
      )
        return part(node.left) + part(node.right);
      if (ts.isTemplateExpression(node))
        return (
          node.head.text +
          node.templateSpans
            .map((span) => `{value${variable++}}${span.literal.text}`)
            .join("")
        );
      return `{value${variable++}}`;
    };
    return part(expression);
  };
  const collect = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      bindings.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  };
  collect(ast);
  const evaluate = (
    node: ts.Expression,
    language: string,
    depth = 0,
  ): unknown => {
    if (depth > 8) return undefined;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node))
      return evaluate(node.expression, language, depth + 1);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isIdentifier(node)) {
      if (["language", "locale", "lang"].includes(node.text)) return language;
      const value = bindings.get(node.text);
      return value ? evaluate(value, language, depth + 1) : undefined;
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "language")
      return language;
    if (ts.isBinaryExpression(node)) {
      const a = evaluate(node.left, language, depth + 1),
        b = evaluate(node.right, language, depth + 1);
      if (a === undefined || b === undefined) return undefined;
      if (
        [
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.EqualsEqualsToken,
        ].includes(node.operatorToken.kind)
      )
        return a === b;
      if (
        [
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsToken,
        ].includes(node.operatorToken.kind)
      )
        return a !== b;
    }
    if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.ExclamationToken
    ) {
      const value = evaluate(node.operand, language, depth + 1);
      return value === undefined ? undefined : !value;
    }
    return undefined;
  };
  const unreachableOutsideVietnamese = (node: ts.Node) =>
    ["en", "zh"].every((language) => {
      let child = node;
      for (
        let parent = node.parent;
        parent;
        child = parent, parent = parent.parent
      ) {
        if (ts.isConditionalExpression(parent)) {
          const value = evaluate(parent.condition, language);
          if (
            value !== undefined &&
            ((child === parent.whenTrue && !value) ||
              (child === parent.whenFalse && value))
          )
            return true;
        }
        if (ts.isIfStatement(parent)) {
          const value = evaluate(parent.expression, language);
          if (
            value !== undefined &&
            ((child === parent.thenStatement && !value) ||
              (child === parent.elseStatement && value))
          )
            return true;
        }
      }
      return false;
    });
  const source = (node: ts.Node): boolean => {
    if (unreachableOutsideVietnamese(node)) return true;
    const parent = node.parent;
    if (
      (ts.isStringLiteralLike(node) || ts.isJsxText(node)) &&
      node.text.trim() === "Tiếng Việt"
    )
      return true; // Native language choice.
    if (
      ts.isBinaryExpression(parent) &&
      [
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ].includes(parent.operatorToken.kind)
    )
      return true;
    if (ts.isCaseClause(parent) && parent.expression === node) return true;
    for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
      if (ts.isVariableDeclaration(ancestor)) {
        const name = ancestor.name.getText(ast);
        if (
          file === "src/shared/api/api-error.ts" &&
          name === "GENERIC_VALIDATION_MESSAGES"
        )
          return true;
        if (
          file ===
            "src/modules/outbound/components/AlignedOutboundDetailModal.tsx" &&
          [
            "REPRINT_REASONS",
            "OTHER_REPRINT_REASON",
            "REPRINT_REASON_LABELS",
          ].includes(name)
        )
          return true;
        if (
          /_VI$/.test(name) &&
          (file.startsWith("src/shared/i18n/") ||
            code.includes('language === "vi"'))
        )
          return true;
        if (
          name === "vi" &&
          bindings.has("en") &&
          (bindings.has("zh") || code.includes("localizedEnglish"))
        )
          return true;
        if (
          file === "src/modules/reports/components/report-export-workbook.ts" &&
          ["quantityHeaders", "skuHeaders", "nameHeaders", "wanted"].includes(
            name,
          )
        )
          return true;
        if (
          file === "src/shared/utils/report-excel-style.ts" &&
          ["TITLES", "HEADERS"].includes(name) &&
          code.includes("reportLabel(")
        )
          return true;
        if (
          file === "src/modules/reports/io-history/rpt08/model.ts" &&
          name === "VI_TIMEZONE_LABEL"
        )
          return true; // Unused exported compatibility constant.
      }
      if (
        ts.isPropertyAssignment(ancestor) &&
        ancestor.name.getText(ast) === "vi" &&
        ts.isObjectLiteralExpression(ancestor.parent) &&
        ancestor.parent.properties.some(
          (p) => ts.isPropertyAssignment(p) && p.name.getText(ast) === "en",
        ) &&
        ancestor.parent.properties.some(
          (p) => ts.isPropertyAssignment(p) && p.name.getText(ast) === "zh",
        )
      )
        return true;
      if (
        /^src\/shared\/i18n\/server-message-catalog(?:\.zh)?\.ts$/.test(file) &&
        ts.isArrayLiteralExpression(ancestor) &&
        ancestor.elements.length === 2 &&
        ancestor.elements.every(ts.isStringLiteralLike) &&
        ancestor.elements[0].pos <= node.pos &&
        ancestor.elements[0].end >= node.end
      )
        return true;
      if (ts.isNewExpression(ancestor)) {
        const name = ancestor.expression.getText(ast);
        const argument =
          ancestor.arguments?.[name === "WmsContractError" ? 1 : 0];
        if (
          ["Error", "WmsContractError"].includes(name) &&
          argument &&
          argument.pos <= node.pos &&
          argument.end >= node.end &&
          knownClientSources.has(clientSource(argument))
        )
          return true;
      }
      if (ts.isCallExpression(ancestor)) {
        const name = ancestor.expression.getText(ast);
        if (
          ts.isPropertyAccessExpression(ancestor.expression) &&
          ancestor.expression.name.text === "map" &&
          ancestor.arguments[0]?.getText(ast) === "reportLabel" &&
          ancestor.expression.expression.pos <= node.pos &&
          ancestor.expression.expression.end >= node.end
        )
          return true;
        const arg = ancestor.arguments.findIndex(
          (a) => a.pos <= node.pos && a.end >= node.end,
        );
        if (
          arg === 0 &&
          ["bilingual", "reportLabel", "localizeMessage"].includes(name)
        )
          return true;
        if (
          arg === 0 &&
          ["copy", "text"].includes(name) &&
          ancestor.arguments.length >= 2 &&
          (code.includes("localizedEnglish") || ancestor.arguments.length === 3)
        )
          return true;
        if (arg === 1 && name === "reportWorkbookOptions") return true; // Header selectors, never display captions.
        if (/\.(?:includes|indexOf|has|split)$/.test(name) && arg === 0)
          return true;
      }
    }
    if (
      file.startsWith("src/shared/i18n/") &&
      ts.isPropertyAssignment(parent) &&
      parent.name === node &&
      /(?:server-message-catalog|report-labels|backend-catalog-parameters)\./.test(
        file,
      )
    )
      return true;
    return false;
  };
  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteralLike(node) ||
        ts.isTemplateExpression(node) ||
        ts.isJsxText(node)) &&
      VN.test(node.getText(ast)) &&
      source(node)
    ) {
      ranges.push([node.getStart(ast), node.getEnd()]);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  let masked = input;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0]))
    masked = `${masked.slice(0, start)}""${masked.slice(end)}`;
  return masked;
}

describe("hàng rào ngôn ngữ · bảng chuỗi", () => {
  it("translates fixed export captions instead of merely exempting their source arguments", () => {
    const captions = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      const code = readFileSync(file, "utf8");
      if (!code.includes("reportLabel")) continue;
      const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "map" &&
          node.arguments[0]?.getText(ast) === "reportLabel" &&
          ts.isArrayLiteralExpression(node.expression.expression)
        ) {
          for (const element of node.expression.expression.elements)
            if (ts.isStringLiteralLike(element)) captions.add(element.text);
        }
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(ast) === "reportLabel" &&
          node.arguments[0] &&
          ts.isStringLiteralLike(node.arguments[0])
        )
          captions.add(node.arguments[0].text);
        if (
          file.endsWith("report-excel-style.ts") &&
          ts.isVariableDeclaration(node) &&
          ["TITLES", "HEADERS"].includes(node.name.getText(ast)) &&
          node.initializer &&
          ts.isObjectLiteralExpression(node.initializer)
        ) {
          for (const property of node.initializer.properties)
            if (
              ts.isPropertyAssignment(property) &&
              ts.isStringLiteralLike(property.initializer)
            )
              captions.add(property.initializer.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    for (const source of captions)
      for (const language of ["en", "zh"] as const) {
        const translated = withLanguage(language, () => reportLabel(source));
        expect(VN.test(translated), `${language}: ${source}`).toBe(false);
        if (
          language === "zh" &&
          /[A-Za-z]/.test(translated) &&
          translated.trim() !== "SKU"
        ) {
          expect(translated, `zh caption: ${source}`).toMatch(
            /\p{Script=Han}/u,
          );
        }
      }
  });
  it("has complete English and Chinese translations for constructor messages treated as source data", () => {
    for (const [source, en, zh] of BACKEND_CLIENT_ERRORS) {
      expect(en.trim(), source).not.toBe("");
      expect(zh.trim(), source).not.toBe("");
      expect(VN.test(en), source).toBe(false);
      expect(VN.test(zh), source).toBe(false);
      const placeholders = (value: string) =>
        value.match(/\{\w+\}/g)?.sort() ?? [];
      expect(placeholders(en), source).toEqual(placeholders(source));
      expect(placeholders(zh), source).toEqual(placeholders(source));
    }
  });
  it("mọi khoá tiếng Việt đều có bản tiếng Anh", () => {
    const english = new Set(leafPaths(MESSAGES_EN));
    const missing = leafPaths(MESSAGES_VI).filter((key) => !english.has(key));
    expect(missing).toEqual([]);
  });

  it("không bản dịch EN nào bị bỏ trống hoặc chép nguyên tiếng Việt", () => {
    // Tên ngôn ngữ hiển thị bằng CHÍNH ngôn ngữ đó ở mọi giao diện — đó là quy
    // ước của bộ chọn ngôn ngữ, nên "Tiếng Việt" đứng nguyên trong bản EN.
    const languageNames = new Set([
      "topbar.languageVietnamese",
      "topbar.languageVi",
      "topbar.languageViSub",
    ]);
    const suspicious = leafPaths(MESSAGES_EN).filter((path) => {
      if (languageNames.has(path)) return false;
      // Dữ liệu mẫu của trang catalog design-system: tên riêng tiếng Việt (đại
      // lý, hãng, người) và đoạn văn mẫu để soi dấu tiếng Việt trong typography
      // — dịch sang EN thì mất đúng thứ nó đang minh hoạ.
      if (path === "catalog.longText" || path.startsWith("catalog.data."))
        return false;
      const value = readLeaf(MESSAGES_EN, path);
      return (
        typeof value === "string" && (value.trim() === "" || VN.test(value))
      );
    });
    expect(suspicious).toEqual([]);
  });

  it("placeholder {…} của bản EN khớp bản VI", () => {
    const names = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
    const mismatched = leafPaths(MESSAGES_EN).filter((path) => {
      const vi = readLeaf(MESSAGES_VI, path);
      const en = readLeaf(MESSAGES_EN, path);
      if (typeof vi !== "string" || typeof en !== "string") return false;
      return JSON.stringify(names(vi)) !== JSON.stringify(names(en));
    });
    expect(mismatched).toEqual([]);
  });
});

describe("hàng rào ngôn ngữ · nhãn ngoài bảng chuỗi", () => {
  it("nhãn nghiệp vụ theo enum BE đổi theo ngôn ngữ", () => {
    const maps: ReadonlyArray<Record<string, string>> = [
      INBOUND_STATUS_LABELS,
      OUTBOUND_STATUS_LABELS,
      MOVEMENT_TYPE_LABELS,
      INVENTORY_STOCK_STATUS_LABELS,
      AUDIT_ACTION_LABELS,
    ];
    const leaks = maps.flatMap((map) =>
      Object.keys(map)
        .map((key) => ({ key, english: withLanguage("en", () => map[key]) }))
        .filter((entry) => VN.test(entry.english))
        .map((entry) => `${entry.key} = ${entry.english}`),
    );
    expect(leaks).toEqual([]);
  });

  // Nhãn của RPT-02 nằm ở file riêng (được miễn quét chuỗi trần), nên phải
  // kiểm chúng thật sự song ngữ — nếu không thì miễn quét = mất hàng rào.
  it("nhãn của màn Tồn kho & đối soát đổi theo ngôn ngữ", () => {
    const maps: ReadonlyArray<Record<string, string>> = [
      STOCK_RECONCILE_LABELS,
      CHECK_LABELS,
      NORM_STATE_LABELS,
    ];
    const leaks = maps.flatMap((map) =>
      Object.keys(map)
        .map((key) => ({ key, english: withLanguage("en", () => map[key]) }))
        .filter((entry) => VN.test(entry.english))
        .map((entry) => `${entry.key} = ${entry.english}`),
    );
    expect(leaks).toEqual([]);
  });

  it("nhãn nút hành động mặc định đổi theo ngôn ngữ", () => {
    const leaks = Object.entries(ACTION_KINDS)
      .map(([kind, item]) => ({
        kind,
        english: withLanguage("en", () => item.label),
      }))
      .filter((entry) => VN.test(entry.english))
      .map((entry) => `${entry.kind} = ${entry.english}`);
    expect(leaks).toEqual([]);
  });

  it("ô rỗng và nhãn 'chưa xác định' đổi theo ngôn ngữ", () => {
    expect(EMPTY_TEXT).toBe("Chưa có");
    expect(UNKNOWN_BUSINESS_LABEL).toBe("Chưa xác định");

    // `export let` là live binding: đọc lại SAU khi store phát sự kiện.
    const english = withLanguage("en", () => [
      EMPTY_TEXT,
      UNKNOWN_BUSINESS_LABEL,
    ]);
    expect(english[0]).not.toMatch(VN);
    expect(english[1]).not.toMatch(VN);

    // Và trả về đúng tiếng Việt sau khi đổi lại.
    expect(EMPTY_TEXT).toBe("Chưa có");
  });
});

describe("hàng rào ngôn ngữ · chuỗi cứng trong component", () => {
  const offenders = sourceFiles(SRC)
    .map((file) => ({
      file: relative(process.cwd(), file).split(sep).join("/"),
      hits: hardcodedVietnamese(
        localizedSourceData(
          relative(process.cwd(), file).split(sep).join("/"),
          readFileSync(file, "utf8"),
        ),
      ),
    }))
    .filter((entry) => entry.hits.length > 0)
    .filter((entry) => !VIETNAMESE_IS_DATA.has(entry.file));

  it("distinguishes Vietnamese-only branches from untranslated rendered copy", () => {
    const file = "src/modules/example/Example.tsx";
    const guarded =
      'const title = language === "vi" ? "Chưa có dữ liệu" : language === "zh" ? "暂无数据" : "No data";';
    expect(hardcodedVietnamese(localizedSourceData(file, guarded))).toEqual([]);
    const leaking = guarded.replace('language === "vi"', 'language === "en"');
    expect(hardcodedVietnamese(localizedSourceData(file, leaking))).toEqual([
      "Chưa có dữ liệu",
    ]);
    expect(
      hardcodedVietnamese(
        localizedSourceData(file, "return <h1>Chưa có dữ liệu</h1>;"),
      ),
    ).toEqual(["Chưa có dữ liệu"]);
    const bilingualSource =
      'import { localizedEnglish } from "./localizer"; copy("Chưa có dữ liệu", "No data");';
    expect(
      hardcodedVietnamese(localizedSourceData(file, bilingualSource)),
    ).toEqual([]);
  });

  it("excludes backend lookup sources while still detecting untranslated targets and UI", () => {
    const dataFile = "src/shared/i18n/backend-catalog-batch-2.ts";
    const catalog =
      'export const BACKEND_CATALOG_BATCH_2 = [["Không tìm thấy kho.", "Warehouse not found.", "未找到仓库。"]];';
    expect(
      hardcodedVietnamese(backendCatalogSourceData(dataFile, catalog)),
    ).toEqual([]);
    const parameterized = catalog.replace(
      '"未找到仓库。"]',
      '"未找到仓库。", { value0: "status" }]',
    );
    expect(
      hardcodedVietnamese(backendCatalogSourceData(dataFile, parameterized)),
    ).toEqual([]);
    const leakingTarget = catalog.replace(
      "Warehouse not found.",
      "Không tìm thấy kho.",
    );
    expect(
      hardcodedVietnamese(backendCatalogSourceData(dataFile, leakingTarget)),
    ).toEqual(["Không tìm thấy kho."]);
    expect(
      hardcodedVietnamese(
        backendCatalogSourceData("src/app/layouts/SideNav.tsx", catalog),
      ),
    ).toEqual(["Không tìm thấy kho."]);
    expect(
      hardcodedVietnamese(
        backendCatalogSourceData(
          dataFile,
          'const title = "Không tìm thấy kho.";',
        ),
      ),
    ).toEqual(["Không tìm thấy kho."]);
  });

  it("không file nào ngoài danh sách chờ còn chuỗi tiếng Việt trần", () => {
    const unexpected = offenders
      .filter((entry) => !PENDING_FILES.has(entry.file))
      .map((entry) => `${entry.file} (${entry.hits.length}): ${entry.hits[0]}`);
    expect(unexpected).toEqual([]);
  });

  it("danh sách chờ chỉ được ngắn đi, không dài ra", () => {
    const stale = [...PENDING_FILES].filter(
      (file) => !offenders.some((entry) => entry.file === file),
    );
    expect(
      stale,
      "File này đã sạch — xoá khỏi PENDING_FILES để không ai thêm chuỗi cứng vào lại",
    ).toEqual([]);
  });
});
