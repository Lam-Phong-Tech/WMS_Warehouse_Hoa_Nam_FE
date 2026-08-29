/**
 * ui:styles — guard entrypoint CSS + cascade policy (Part 2 Vuexy sync).
 *
 * Fail khi:
 *  1. Thứ tự import CSS trong src/main.tsx lệch manifest khai báo (load order
 *     là hợp đồng có chủ đích — xem 12-provider-css-remediation.md).
 *  2. File ts/tsx khác import CSS ngoài allowlist (component-scoped).
 *  3. Số `!important` của một file CSS TĂNG so với baseline (ratchet).
 *  4. Xuất hiện file CSS mới trong src/styles/ ngoài manifest.
 *
 * --update-baseline / --self-test như các guard khác.
 */
import path from "node:path";
import {
  REPO_ROOT,
  loadIconFamily,
  countImportant,
  fail,
  findCssImports,
  loadJson,
  read,
  saveJson,
  walk,
} from "./ui-guards-lib.mjs";

const BASELINE_PATH = "docs/ui/vuexy-sync/allowlists/css-baseline.json";
const ENTRYPOINT = "src/main.tsx";

/**
 * Load order hợp đồng — đổi thứ tự = sửa cả manifest này lẫn tài liệu 12.
 * Dòng đầu (CSS font icon) lấy từ ICON_FAMILY.cssImport để đổi biến thể icon
 * chỉ phải sửa src/shared/ui/icons/icon-family.ts.
 */
export const CSS_MANIFEST = [
  loadIconFamily().cssImport,
  "./shared/ui/tokens/css-vars.css",
  "./index.css",
  "./styles/hn-wms-page-normalize.css",
  "./styles/hn-wms-source-screen.css",
  "./styles/hn-responsive.css",
  "./styles/hn-motion.css",
];

const EXCLUDES = [".test.", "src/test/", "__snapshots__"];

export function checkStyles(tsFiles, cssFiles, contents, baseline) {
  const violations = [];

  // 1. Entrypoint order
  const mainImports = findCssImports(contents(ENTRYPOINT));
  if (JSON.stringify(mainImports) !== JSON.stringify(CSS_MANIFEST)) {
    violations.push(
      `${ENTRYPOINT}: thứ tự import CSS lệch manifest.\n      thấy:      [${mainImports.join(", ")}]\n      kỳ vọng:  [${CSS_MANIFEST.join(", ")}]`,
    );
  }

  // 2. CSS import ngoài entrypoint
  for (const file of tsFiles) {
    if (file === ENTRYPOINT) continue;
    const imports = findCssImports(contents(file));
    for (const css of imports) {
      const allowed = baseline.cssImports[file] ?? [];
      if (!allowed.includes(css)) {
        violations.push(
          `${file}: import "${css}" — CSS global chỉ qua ${ENTRYPOINT}; CSS cục bộ phải có trong allowlist css-baseline.json`,
        );
      }
    }
  }

  // 3. !important ratchet
  for (const file of cssFiles) {
    const n = countImportant(contents(file));
    const allowed = baseline.important[file] ?? 0;
    if (n > allowed) {
      violations.push(
        `${file}: ${n} !important (baseline ${allowed}) — không thêm !important mới`,
      );
    }
  }

  // 4. File CSS mới trong src/styles
  for (const file of cssFiles) {
    if (
      file.startsWith("src/styles/") &&
      !CSS_MANIFEST.includes("./" + file.replace("src/", ""))
    ) {
      violations.push(
        `${file}: file CSS mới trong src/styles ngoài manifest — không thêm lớp global mới (RC-03)`,
      );
    }
  }

  return violations;
}

function selfTest() {
  const baseline = { cssImports: {}, important: {} };
  const tsFiles = ["src/main.tsx", "src/modules/foo/Bad.tsx"];
  const cssFiles = ["src/styles/rogue-override.css"];
  const fixtures = {
    "src/main.tsx": 'import "./index.css";', // sai thứ tự manifest
    "src/modules/foo/Bad.tsx": 'import "./Bad.css";',
    "src/styles/rogue-override.css": "a { color: red !important; }",
  };
  const violations = checkStyles(
    tsFiles,
    cssFiles,
    (f) => fixtures[f] ?? "",
    baseline,
  );
  if (violations.length >= 4) {
    console.log(
      `[ui:styles --self-test] PASS (${violations.length} vi phạm tổng hợp được bắt)`,
    );
    return 0;
  }
  console.error(`[ui:styles --self-test] FAIL — chỉ bắt ${violations.length}:`);
  violations.forEach((v) => console.error("  - " + v));
  return 1;
}

const mode = process.argv[2];
if (mode === "--self-test") process.exit(selfTest());

const tsFiles = walk(path.join(REPO_ROOT, "src"), [".ts", ".tsx"], {
  exclude: EXCLUDES,
});
const cssFiles = walk(path.join(REPO_ROOT, "src"), [".css"], {
  exclude: EXCLUDES,
});

if (mode === "--update-baseline") {
  const cssImports = {};
  for (const file of tsFiles) {
    if (file === ENTRYPOINT) continue;
    const imports = findCssImports(read(file));
    if (imports.length > 0) cssImports[file] = imports;
  }
  const important = {};
  for (const file of cssFiles) {
    const n = countImportant(read(file));
    if (n > 0) important[file] = n;
  }
  saveJson(BASELINE_PATH, {
    meta: {
      owner: "FE1 Team",
      reason:
        "Hiện trạng CSS cục bộ + !important sau Part 2. Ratchet: !important chỉ được GIẢM; không thêm CSS import ngoài entrypoint.",
      deadline:
        "Part 3-4 — rút các lớp wireframe/exact/normalize theo 09-remediation §Phase C",
      generated_by: "scripts/check-ui-styles.mjs --update-baseline",
    },
    cssImports,
    important,
  });
  console.log(`Đã ghi ${BASELINE_PATH}.`);
  process.exit(0);
}

const baseline = loadJson(BASELINE_PATH);
process.exit(fail(checkStyles(tsFiles, cssFiles, read, baseline), "ui:styles"));
