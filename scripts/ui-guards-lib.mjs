/**
 * UI GUARDS LIB — matcher thuần cho bộ guard design-system (Part 2 Vuexy sync).
 * Dùng bởi: check-ui-architecture.mjs, check-ui-tokens.mjs, check-ui-styles.mjs
 * và test src/test/ui-foundation/import-boundary.test.ts (negative/positive).
 *
 * Mọi matcher là hàm thuần (path, content) → kết quả, để test được cả hai chiều.
 */
import fs from "node:fs";
import path from "node:path";

export const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  "..",
);

/** Đệ quy liệt kê file theo đuôi, trả relative posix path. */
export function walk(rootAbs, exts, { exclude = [] } = {}) {
  const out = [];
  const visit = (dirAbs) => {
    for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
      const abs = path.join(dirAbs, entry.name);
      const rel = path.relative(REPO_ROOT, abs).split(path.sep).join("/");
      if (exclude.some((pattern) => rel.includes(pattern))) continue;
      if (entry.isDirectory()) visit(abs);
      else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(rel);
    }
  };
  visit(rootAbs);
  return out.sort();
}

export function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/** Import trực tiếp UI engine (antd/@mui/material/@emotion) trong 1 file. */
export function findEngineImports(content) {
  const re =
    /from\s+["'](antd(?:\/[^"']*)?|@mui\/material(?:\/[^"']*)?|@emotion\/[^"']+)["']/g;
  const found = [];
  let m;
  while ((m = re.exec(content))) found.push(m[1]);
  return found;
}

export function findEmotionImports(content) {
  return findEngineImports(content).filter((s) => s.startsWith("@emotion/"));
}

export function hasCreateTheme(content) {
  return /\bcreateTheme\s*\(/.test(content);
}

export function hasThemeProviderJsx(content) {
  return /<(?:Mui)?ThemeProvider\b/.test(content);
}

export function hasConfigProviderJsx(content) {
  return /<ConfigProvider\b/.test(content);
}

/** Hex literal (#abc/#aabbcc/#aabbccdd). */
export function findHexLiterals(content) {
  return content.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
}

/** Font drift: stack cũ bị cấm sau DEC-UI-BASELINE-01. */
export function findForbiddenFonts(content) {
  const hits = [];
  if (/["']Inter["']/.test(content)) hits.push("Inter");
  if (/Be Vietnam Pro/.test(content)) hits.push("Be Vietnam Pro");
  if (/Arial\s*,\s*Helvetica/.test(content)) hits.push("Arial,Helvetica");
  if (/fonts\.googleapis\.com/.test(content)) hits.push("google-fonts");
  return hits;
}

/** Mọi câu `import "...css"` trong 1 file ts/tsx. */
export function findCssImports(content) {
  const re = /import\s+["']([^"']+\.css)["']/g;
  const found = [];
  let m;
  while ((m = re.exec(content))) found.push(m[1]);
  return found;
}

export function countImportant(content) {
  return (content.match(/!important/g) ?? []).length;
}

/**
 * Heuristic "nguồn token thứ hai": file ngoài tokens/ export một const
 * UPPER_CASE chứa >=3 hex literal.
 */
export function looksLikeTokenSource(content) {
  const re = /export\s+const\s+[A-Z][A-Z0-9_]+\s*[:=][\s\S]{0,2000}?;/g;
  let m;
  while ((m = re.exec(content))) {
    if ((m[0].match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length >= 3) return true;
  }
  return false;
}

export function loadJson(rel) {
  return JSON.parse(read(rel));
}

export function saveJson(rel, data) {
  fs.mkdirSync(path.dirname(path.join(REPO_ROOT, rel)), { recursive: true });
  fs.writeFileSync(
    path.join(REPO_ROOT, rel),
    JSON.stringify(data, null, 2) + "\n",
    "utf8",
  );
}

export function fail(violations, guardName) {
  if (violations.length === 0) {
    console.log(`[${guardName}] PASS`);
    return 0;
  }
  console.error(`[${guardName}] FAIL — ${violations.length} vi phạm:`);
  for (const v of violations) console.error("  - " + v);
  return 1;
}
