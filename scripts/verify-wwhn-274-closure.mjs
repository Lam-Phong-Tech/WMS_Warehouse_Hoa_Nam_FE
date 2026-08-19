import { existsSync, readFileSync } from "node:fs";

const failures = [];

function requireFile(path) {
  if (!existsSync(path)) {
    failures.push(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    failures.push(`Missing ${label}: ${needle}`);
  }
}

function rejectText(content, needle, label) {
  if (content.includes(needle)) {
    failures.push(`Rejected ${label}: ${needle}`);
  }
}

const taskDoc = requireFile("docs/Task_docs_Jira/WWHN-274.md");
const e2e = requireFile("e2e/wwhn-274-release-signoff.spec.ts");
const workflow = requireFile(
  ".github/workflows/wwhn-274-fe-release-signoff.yml",
);
const envExample = requireFile(".env.example");
const techGuide = requireFile(
  "docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md",
);
const srs = requireFile("docs/HN_SRS_FRD_v1.12_FULL.md");
const erd = requireFile("docs/HoaNam_ERD_Moi_Nhat.md");
const wireframe = requireFile(
  "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html",
);

for (const [content, label] of [
  [srs, "SRS/FRD baseline"],
  [erd, "ERD baseline"],
  [wireframe, "wireframe baseline"],
  [techGuide, "techstack baseline"],
]) {
  if (!content.trim()) failures.push(`${label} is empty`);
}

// Parse the env contract instead of matching raw text: .env.example legally quotes
// values (VITE_API_HEALTH_PATH="/health"), so a literal substring gate reports a
// false FAIL on a compliant file. Same parser shape as
// scripts/verify-env-health-contract.mjs.
function parseEnv(content) {
  const env = new Map();
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u);
    if (!match) continue;
    env.set(match[1], match[2].trim().replace(/^["']|["']$/gu, ""));
  }
  return env;
}

function requireEnv(env, key, expected, label) {
  if (!env.has(key)) {
    failures.push(`Missing ${label}: ${key} is not declared in .env.example`);
    return;
  }
  const actual = env.get(key);
  if (expected !== undefined && actual !== expected) {
    failures.push(
      `Invalid ${label}: ${key} must be "${expected}" but is "${actual}"`,
    );
  }
}

const envContract = parseEnv(envExample);
const apiBaseUrl = envContract.get("VITE_API_BASE_URL") ?? "";

requireEnv(
  envContract,
  "VITE_API_BASE_URL",
  undefined,
  "API base env contract",
);
if (!apiBaseUrl.endsWith("/api/v1")) {
  failures.push(
    `Invalid canonical API version prefix: VITE_API_BASE_URL must end at /api/v1 but is "${apiBaseUrl}"`,
  );
}
requireEnv(
  envContract,
  "VITE_API_HEALTH_PATH",
  "/health",
  "canonical relative backend health path",
);
requireEnv(
  envContract,
  "VITE_API_WITH_CREDENTIALS",
  "true",
  "credentialed browser requests",
);

for (const viewport of [
  "1440, height: 900",
  "768, height: 1024",
  "375, height: 812",
]) {
  requireText(e2e, viewport, `required viewport ${viewport}`);
}
for (const state of [
  "Loading",
  "Empty",
  "Error",
  "No permission",
  "API error + field errors",
  "Confirm action",
  "Disabled until valid",
]) {
  requireText(e2e, state, `shared UI state ${state}`);
}
requireText(e2e, "/errors/403", "direct URL permission fail-closed route");
requireText(
  e2e,
  "FE_CONTROLLED_NOT_QA_UAT",
  "controlled-evidence truth boundary",
);
requireText(e2e, "sourceSha", "exact SHA evidence metadata");
requireText(e2e, "timestamp", "timestamp evidence metadata");
requireText(e2e, "browserProject", "browser evidence metadata");
requireText(e2e, "role", "role evidence metadata");
requireText(e2e, "viewport", "viewport evidence metadata");
requireText(e2e, "login-api-422-retry-safe", "API error/retry scenario");

for (const gate of [
  "npm run format:check",
  "npm run lint",
  "npm run typecheck",
  "npm run test",
  "npm run env:verify",
  "npm run check:api-mapping",
  "npm run build",
  "npm run health:check",
  "VITE_API_HEALTH_PATH: /health",
  "npm run wwhn-274:verify",
  "npm run test:e2e:wwhn-274",
  "actions/upload-artifact@v4",
]) {
  requireText(workflow, gate, `workflow gate ${gate}`);
}
requireText(workflow, "branches: [m1]", "m1 release-signoff branch trigger");
requireText(workflow, "github.sha", "workflow exact SHA binding");
requireText(
  workflow,
  "release-signoff.json",
  "machine-readable release evidence",
);
rejectText(workflow, "/api/health", "legacy unversioned backend health route");

// Package-manager contract. This repository ships yarn.lock and no
// package-lock.json, so an `npm ci` / `cache: npm` workflow can never install
// and the whole exact-SHA gate would be permanently red.
requireText(
  workflow,
  "yarn install --frozen-lockfile",
  "locked yarn install (repository ships yarn.lock, not package-lock.json)",
);
requireText(workflow, "cache: yarn", "yarn dependency cache");
requireText(
  workflow,
  "cache-dependency-path: yarn.lock",
  "yarn cache key bound to the committed lockfile",
);
rejectText(
  workflow,
  "npm ci",
  "npm lockfile install without package-lock.json",
);
rejectText(workflow, "cache: npm", "npm cache without package-lock.json");

if (!existsSync("yarn.lock")) {
  failures.push(
    "Missing required file: yarn.lock (the workflow installs with --frozen-lockfile)",
  );
}

// Task-owned npm entry points must exist and resolve to the real evidence
// files, so the workflow cannot silently run a different or missing target.
let pkgScripts = {};
try {
  pkgScripts = JSON.parse(requireFile("package.json") || "{}").scripts ?? {};
} catch (error) {
  failures.push(`Unreadable package.json: ${error.message}`);
}
for (const [scriptName, mustContain] of [
  ["wwhn-274:verify", "scripts/verify-wwhn-274-closure.mjs"],
  ["test:e2e:wwhn-274", "e2e/wwhn-274-release-signoff.spec.ts"],
  ["test:e2e:wwhn-274:a11y", "e2e/wwhn-274-a11y-browser-matrix.spec.ts"],
  ["test:e2e:wwhn-274:real-env", "e2e/wwhn-274-real-env-smoke.spec.ts"],
  ["wwhn-274:exact-sha", "scripts/run-wwhn-274-exact-sha-evidence.mjs"],
]) {
  const command = pkgScripts[scriptName];
  if (!command) {
    failures.push(`Missing package script: ${scriptName}`);
  } else if (!command.includes(mustContain)) {
    failures.push(
      `Invalid package script ${scriptName}: must run ${mustContain} but runs "${command}"`,
    );
  }
}

// TypeScript incremental cache must never be version-controlled: a stale entry
// pointing at a deleted spec breaks `tsc -b` (and therefore `npm run build`) on
// every clean checkout of this SHA.
const gitignore = requireFile(".gitignore");
requireText(gitignore, "*.tsbuildinfo", "ignored TypeScript build cache");

for (const boundary of [
  "FE-controlled",
  "WWHN-272",
  "WWHN-275",
  "Stocktake",
  "P0/P1/P2",
]) {
  requireText(taskDoc, boundary, `task traceability boundary ${boundary}`);
}

// ---------------------------------------------------------------------------
// Vòng 2 — register FE274-*. Vòng 1 chỉ chứng minh "gate tồn tại"; reviewer bác
// bỏ vì (a) không truy xuất được run/artifact theo đúng candidate SHA, (b) toàn
// bộ E2E chạy trên API mock nên không chứng minh được FE↔BE thật, (c) không có
// bằng chứng bàn phím/a11y/ma trận trình duyệt. Ba nhóm assert dưới đây khoá
// từng nguyên nhân đó lại để một lần sửa sau này không âm thầm tụt về mức cũ.
// ---------------------------------------------------------------------------
const realEnvSpec = requireFile("e2e/wwhn-274-real-env-smoke.spec.ts");
const a11ySpec = requireFile("e2e/wwhn-274-a11y-browser-matrix.spec.ts");
const exactShaRunner = requireFile(
  "scripts/run-wwhn-274-exact-sha-evidence.mjs",
);
const playwrightConfig = requireFile("playwright.config.ts");

/** Bỏ comment trước khi kiểm cấm-dùng: docstring được phép *nhắc tên* API bị cấm. */
function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^[^\n]*?\/\/.*$/gmu, "");
}

// FE274-P1-06 — bằng chứng tích hợp thật. Một dòng `page.route(` ở đây là đủ để
// biến "real integration" trở lại thành mock, tức là đúng lỗi mà reviewer đã chỉ.
const realEnvCode = stripComments(realEnvSpec);
rejectText(realEnvCode, "page.route(", "mock route trong real-env smoke");
rejectText(realEnvCode, "route.fulfill(", "mock response trong real-env smoke");
for (const needle of [
  "WWHN_274_REQUIRE_REAL_ENV",
  "WWHN_274_REAL_BASE_URL",
  "WWHN_274_REAL_API_BASE_URL",
  "/auth/refresh",
  "/auth/login",
  "/auth/me",
  "/health",
  "FE_BE_REAL_INTEGRATION",
]) {
  requireText(realEnvSpec, needle, `real-env smoke contract ${needle}`);
}

// FE274-P2-03 — a11y + ma trận trình duyệt/thiết bị neo vào NFR-SRS-006
// (desktop >=1280, tablet >=768, mobile >=360; Chrome/Edge, Chrome Android, Safari iOS).
for (const needle of [
  "NFR-SRS-006",
  "1280",
  "768",
  "360",
  "getByLabel",
  "toBeFocused",
  // Phép đo focus phải đọc trên wrapper của AntD. Đo thẳng trên <input> trả
  // "none|3px|none" ở CẢ hai trạng thái, làm bài test vô nghĩa và báo đỏ giả.
  "ant-input-affix-wrapper",
]) {
  requireText(a11ySpec, needle, `a11y/browser matrix contract ${needle}`);
}
for (const project of [
  "wwhn-274-desktop-chromium",
  "wwhn-274-chrome-android",
  "wwhn-274-safari-ios",
]) {
  requireText(playwrightConfig, project, `browser matrix project ${project}`);
  requireText(workflow, project, `workflow browser matrix project ${project}`);
}
requireText(
  playwrightConfig,
  "iPhone",
  "WebKit/Safari iOS device profile (NFR-SRS-006)",
);
requireText(
  workflow,
  "playwright install --with-deps chromium webkit",
  "cài đủ engine cho ma trận Chromium + WebKit",
);

// Evidence phải nằm NGOÀI `outputDir` của Playwright. `test-results/` bị dọn sạch ở
// đầu mỗi lệnh `playwright test`, nên bước E2E sau xoá bằng chứng của bước trước —
// artifact "exact-SHA" khi đó chỉ còn lần chạy cuối; thư mục này cũng nằm trong
// .gitignore nên không pin theo SHA được.
for (const [spec, label] of [
  [e2e, "controlled evidence"],
  [a11ySpec, "a11y evidence"],
  [realEnvSpec, "real-env evidence"],
]) {
  requireText(spec, '"evidence"', `${label} ghi dưới docs/evidence`);
  requireText(spec, '"generated"', `${label} ghi dưới generated/<sha>`);
  rejectText(
    stripComments(spec),
    '"test-results"',
    `${label} ghi vào outputDir bị Playwright dọn giữa các lần chạy`,
  );
}
rejectText(
  workflow,
  "test-results/wwhn-274",
  "artifact trỏ vào thư mục bị dọn giữa các lần chạy",
);

// FE274-P1-01 — mọi tuyên bố PASS phải gắn với một commit truy xuất được.
for (const needle of [
  "rev-parse",
  "--allow-dirty",
  "evidenceValidity",
  "INVALID_FOR_CLOSURE",
  "gate-results.json",
]) {
  requireText(exactShaRunner, needle, `exact-SHA runner contract ${needle}`);
}
requireText(
  workflow,
  "inputs.source_sha",
  "workflow_dispatch chạy lại được trên đúng candidate SHA",
);
requireText(
  workflow,
  "npm run test:e2e:wwhn-274:a11y",
  "workflow gate a11y/browser matrix",
);
requireText(
  workflow,
  "npm run test:e2e:wwhn-274:real-env",
  "workflow gate real-env FE<->BE smoke",
);
requireText(
  workflow,
  "WWHN_274_REQUIRE_REAL_ENV",
  "real-env gate fail-closed (không skip im lặng)",
);

// FE274-P2-01/P2-02 — nguồn review phải là m1 của repo canonical, và register
// vòng 2 phải nêu đủ ID để reviewer đối chiếu 1-1 với comment trên Jira.
requireText(
  taskDoc,
  "https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  "canonical FE repository URL",
);
// Chỉ chặn URL review thật trỏ nhánh không tồn tại; tài liệu vẫn được phép *nói về*
// nhánh sai đó khi mô tả FE274-P2-01.
rejectText(
  taskDoc,
  "Hoa_Nam_FE/tree/m1ee",
  "non-canonical review branch URL",
);
rejectText(
  taskDoc,
  "Hoa_Nam_FE/blob/m1ee",
  "non-canonical review branch URL",
);
for (const id of [
  "FE274-P1-01",
  "FE274-P1-02",
  "FE274-P1-03",
  "FE274-P1-04",
  "FE274-P1-05",
  "FE274-P1-06",
  "FE274-P2-01",
  "FE274-P2-02",
  "FE274-P2-03",
]) {
  requireText(taskDoc, id, `round-2 register entry ${id}`);
}
requireText(taskDoc, "NFR-SRS-006", "browser/device matrix requirement anchor");
requireText(taskDoc, "REQ-SRS-037", "no-Stocktake requirement anchor");

if (failures.length > 0) {
  console.error("WWHN-274 closure verification FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("WWHN-274 source-controlled closure contract PASS");
console.log(
  "Truth boundary: FE controlled evidence only; independent QA/UAT/DevOps evidence remains role-owned.",
);
