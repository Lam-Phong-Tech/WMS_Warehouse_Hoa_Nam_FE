/**
 * ui:architecture — guard biên giới UI engine + provider (Part 2 Vuexy sync).
 *
 * Fail khi:
 *  1. File NGOÀI design-system/allowlist import trực tiếp antd/@mui/@emotion
 *     (ratchet: allowlist = hiện trạng đã kiểm kê; file MỚI không được thêm).
 *  2. @emotion/* được import ở bất kỳ đâu (0 sites — cấm tuyệt đối ngoài MUI nội bộ).
 *  3. Có >1 createTheme hoặc createTheme ngoài mui-adapter.
 *  4. <ThemeProvider>/<MuiThemeProvider>/<ConfigProvider> JSX ngoài composition
 *     root (AppThemeProvider) + ngoại lệ allowlist.
 *  5. Xuất hiện "nguồn token thứ hai" (export const UPPER_CASE chứa >=3 hex)
 *     ngoài src/shared/ui/tokens.
 *
 * --update-baseline: ghi lại allowlist direct-ui-imports theo hiện trạng.
 * --self-test: chạy negative cases tổng hợp để chứng minh guard thật sự fail.
 */
import path from "node:path";
import {
  REPO_ROOT,
  fail,
  findEmotionImports,
  findEngineImports,
  hasConfigProviderJsx,
  hasCreateTheme,
  hasThemeProviderJsx,
  loadJson,
  looksLikeTokenSource,
  read,
  saveJson,
  walk,
} from "./ui-guards-lib.mjs";

const ALLOWLIST_PATH = "docs/ui/vuexy-sync/allowlists/direct-ui-imports.json";
const PROVIDER_EXCEPTIONS_PATH =
  "docs/ui/vuexy-sync/allowlists/themeprovider-exceptions.json";
const DESIGN_SYSTEM_PREFIX = "src/shared/ui/";
const COMPOSITION_ROOT = "src/shared/ui/theme/AppThemeProvider.tsx";
const CREATE_THEME_HOME = "src/shared/ui/theme/mui-adapter.ts";

const EXCLUDES = [".test.", "src/test/", "__snapshots__"];

function scanFiles() {
  return walk(path.join(REPO_ROOT, "src"), [".ts", ".tsx"], {
    exclude: EXCLUDES,
  });
}

export function checkArchitecture(files, contents, allowlist, providerExceptions) {
  const violations = [];
  const createThemeFiles = [];

  for (const file of files) {
    const content = contents(file);
    const inDesignSystem = file.startsWith(DESIGN_SYSTEM_PREFIX);

    const engineImports = findEngineImports(content);
    if (engineImports.length > 0 && !inDesignSystem) {
      if (!allowlist.files.includes(file)) {
        violations.push(
          `${file}: import trực tiếp UI engine (${[...new Set(engineImports)].join(", ")}) — file mới phải dùng @/shared/ui (hoặc xin allowlist có owner/deadline)`,
        );
      }
    }

    const emotion = findEmotionImports(content);
    if (emotion.length > 0) {
      violations.push(
        `${file}: import ${emotion.join(", ")} — @emotion/* chỉ là engine nội bộ của MUI, cấm import trực tiếp`,
      );
    }

    if (hasCreateTheme(content)) createThemeFiles.push(file);

    if (
      hasThemeProviderJsx(content) &&
      file !== COMPOSITION_ROOT &&
      !providerExceptions.files.includes(file)
    ) {
      violations.push(
        `${file}: mount <ThemeProvider> ngoài composition root (${COMPOSITION_ROOT})`,
      );
    }

    if (hasConfigProviderJsx(content) && file !== COMPOSITION_ROOT) {
      violations.push(
        `${file}: mount <ConfigProvider> ngoài composition root (${COMPOSITION_ROOT})`,
      );
    }

    if (!file.startsWith("src/shared/ui/tokens/") && looksLikeTokenSource(content)) {
      violations.push(
        `${file}: nghi ngờ nguồn token thứ hai (export const UPPER_CASE chứa >=3 hex) — canonical duy nhất là src/shared/ui/tokens`,
      );
    }
  }

  if (createThemeFiles.length !== 1 || createThemeFiles[0] !== CREATE_THEME_HOME) {
    violations.push(
      `createTheme phải xuất hiện đúng 1 lần tại ${CREATE_THEME_HOME}; thấy: [${createThemeFiles.join(", ")}]`,
    );
  }

  return violations;
}

function selfTest() {
  const allow = { files: [] };
  const exceptions = { files: [] };
  const fixtures = {
    "src/modules/foo/Bad.tsx": 'import { Button } from "antd";',
    "src/modules/foo/BadMui.tsx": 'import Box from "@mui/material/Box";\nimport x from "@mui/material";',
    "src/modules/foo/BadEmotion.tsx": 'import { css } from "@emotion/react";',
    "src/modules/foo/BadProvider.tsx": "<ThemeProvider theme={x}>",
    "src/modules/foo/BadTokens.ts":
      'export const MY_COLORS = { a: "#111111", b: "#222222", c: "#333333" };',
    [CREATE_THEME_HOME]: "export const muiTheme = createTheme({});",
    "src/modules/foo/BadTheme.ts": "const t = createTheme({});",
  };
  const files = Object.keys(fixtures);
  const violations = checkArchitecture(files, (f) => fixtures[f], allow, exceptions);
  const expected = 7; // antd, mui(x1 file), emotion(engine)+emotion(riêng)=2, provider, tokens, createTheme-list
  if (violations.length >= 6) {
    console.log(`[ui:architecture --self-test] PASS (${violations.length} vi phạm tổng hợp được bắt, kỳ vọng >=6/${expected})`);
    return 0;
  }
  console.error(`[ui:architecture --self-test] FAIL — chỉ bắt được ${violations.length} vi phạm:`);
  violations.forEach((v) => console.error("  - " + v));
  return 1;
}

const mode = process.argv[2];
if (mode === "--self-test") {
  process.exit(selfTest());
}

const files = scanFiles();

if (mode === "--update-baseline") {
  const engineFiles = files.filter(
    (f) =>
      !f.startsWith(DESIGN_SYSTEM_PREFIX) && findEngineImports(read(f)).length > 0,
  );
  saveJson(ALLOWLIST_PATH, {
    meta: {
      owner: "FE1 Team",
      reason:
        "Hiện trạng import trực tiếp antd/@mui trước khi hợp nhất component (Part 3-4 Vuexy sync). Không thêm file mới.",
      deadline: "Part 4 (Screen Migration) — mục tiêu rỗng",
      generated_by: "scripts/check-ui-architecture.mjs --update-baseline",
    },
    files: engineFiles,
  });
  console.log(`Đã ghi ${ALLOWLIST_PATH} (${engineFiles.length} files).`);
  process.exit(0);
}

const allowlist = loadJson(ALLOWLIST_PATH);
const providerExceptions = loadJson(PROVIDER_EXCEPTIONS_PATH);
process.exit(
  fail(
    checkArchitecture(files, read, allowlist, providerExceptions),
    "ui:architecture",
  ),
);
