/**
 * ui:tokens — guard hard-code design literal + token drift (Part 2 Vuexy sync).
 *
 * Fail khi:
 *  1. Hex literal TĂNG so với baseline (ratchet per-file), hoặc file MỚI chứa hex
 *     ngoài src/shared/ui/tokens.
 *  2. BẤT KỲ hex nào trong src/shared/ui/** ngoài thư mục tokens/ (adapter và
 *     foundation component phải literal-free).
 *  3. Font cấm quay lại (Inter/Be Vietnam Pro/Arial,Helvetica/google-fonts)
 *     trong src hoặc index.html.
 *  4. Import "@/shared/design-tokens" (đã xoá) quay lại.
 *
 * --update-baseline / --self-test như các guard khác.
 */
import path from "node:path";
import {
  REPO_ROOT,
  fail,
  findForbiddenFonts,
  findHexLiterals,
  loadJson,
  read,
  saveJson,
  walk,
} from "./ui-guards-lib.mjs";

const BASELINE_PATH = "docs/ui/vuexy-sync/allowlists/hardcoded-hex-baseline.json";
const TOKENS_PREFIX = "src/shared/ui/tokens/";
const DESIGN_SYSTEM_PREFIX = "src/shared/ui/";
const EXCLUDES = [".test.", "src/test/", "__snapshots__"];
// css-vars.css là mirror hợp lệ; các file trong tokens/ được phép chứa hex.

function scanFiles() {
  return walk(path.join(REPO_ROOT, "src"), [".ts", ".tsx", ".css"], {
    exclude: EXCLUDES,
  });
}

export function checkTokens(files, contents, baseline) {
  const violations = [];
  for (const file of files) {
    const content = contents(file);
    const hexes = findHexLiterals(content);

    if (file.startsWith(TOKENS_PREFIX)) {
      // canonical source — hex hợp lệ
    } else if (file.startsWith(DESIGN_SYSTEM_PREFIX)) {
      if (hexes.length > 0) {
        violations.push(
          `${file}: ${hexes.length} hex literal trong design-system ngoài tokens/ (${[...new Set(hexes)].slice(0, 5).join(", ")}) — phải đọc từ @/shared/ui/tokens`,
        );
      }
    } else {
      const allowed = baseline.files[file] ?? 0;
      if (hexes.length > allowed) {
        violations.push(
          `${file}: ${hexes.length} hex literal (baseline ${allowed}) — không thêm literal mới, dùng token`,
        );
      }
    }

    const fonts = findForbiddenFonts(content);
    if (fonts.length > 0 && !file.startsWith(TOKENS_PREFIX)) {
      violations.push(
        `${file}: font drift (${fonts.join(", ")}) — baseline là Public Sans qua --wms-font-family (DEC-UI-BASELINE-01)`,
      );
    }

    if (/from\s+["']@\/shared\/design-tokens["']/.test(content)) {
      violations.push(
        `${file}: import "@/shared/design-tokens" — nguồn warm đã retire, dùng @/shared/ui/tokens`,
      );
    }
  }

  // index.html: cấm google fonts quay lại
  const indexHtml = contents("index.html");
  if (indexHtml && /fonts\.googleapis\.com/.test(indexHtml)) {
    violations.push(
      "index.html: tải Google Fonts render-blocking — bị cấm theo DEC-UI-BASELINE-01 D1",
    );
  }

  return violations;
}

function selfTest() {
  const baseline = { files: {} };
  const fixtures = {
    "src/modules/foo/Bad.tsx": 'const c = "#2563eb";',
    "src/shared/ui/theme/bad-adapter.ts": 'const x = "#123456";',
    "src/modules/foo/BadFont.css": 'body { font-family: "Inter", sans-serif; }',
    "src/modules/foo/BadImport.ts": 'import { RADIUS } from "@/shared/design-tokens";',
    "index.html": '<link href="https://fonts.googleapis.com/css2?family=Inter">',
  };
  const violations = checkTokens(
    Object.keys(fixtures).filter((f) => f !== "index.html"),
    (f) => fixtures[f] ?? "",
    baseline,
  );
  if (violations.length >= 5) {
    console.log(`[ui:tokens --self-test] PASS (${violations.length} vi phạm tổng hợp được bắt)`);
    return 0;
  }
  console.error(`[ui:tokens --self-test] FAIL — chỉ bắt ${violations.length}:`);
  violations.forEach((v) => console.error("  - " + v));
  return 1;
}

const mode = process.argv[2];
if (mode === "--self-test") process.exit(selfTest());

const files = scanFiles();

if (mode === "--update-baseline") {
  const map = {};
  for (const file of files) {
    if (file.startsWith(DESIGN_SYSTEM_PREFIX)) continue;
    const n = findHexLiterals(read(file)).length;
    if (n > 0) map[file] = n;
  }
  saveJson(BASELINE_PATH, {
    meta: {
      owner: "FE1 Team",
      reason:
        "Hex literal còn lại sau Part 2 (chủ yếu #fff + 4 màu sidebar legacy + literal TSX module chưa migrate). Ratchet: chỉ được GIẢM.",
      deadline: "Part 4 (Screen Migration) — mục tiêu ~0 ngoài tokens",
      generated_by: "scripts/check-ui-tokens.mjs --update-baseline",
    },
    files: map,
  });
  console.log(`Đã ghi ${BASELINE_PATH} (${Object.keys(map).length} files).`);
  process.exit(0);
}

const baseline = loadJson(BASELINE_PATH);
const contents = (f) => (f === "index.html" ? read("index.html") : read(f));
process.exit(fail(checkTokens(files, contents, baseline), "ui:tokens"));
