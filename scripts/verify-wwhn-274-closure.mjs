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

// ĐÃ RÚT theo 3822d45: docs/Task_docs_Jira/WWHN-274.md,
// e2e/wwhn-274-release-signoff.spec.ts và wireframe HTML
// (docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html) đã gỡ khỏi
// repo trong đợt dọn kho tài liệu — kiểm tra đọc các artefact đó rút theo.
// Kiểm tra mã nguồn sống (workflow, .env.example, docs baseline còn lại,
// playwright.config.ts, exact-SHA runner, package.json) giữ nguyên hiệu lực.
const workflow = requireFile(
  ".github/workflows/wwhn-274-fe-release-signoff.yml",
);
const envExample = requireFile(".env.example");
const techGuide = requireFile(
  "docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md",
);
const srs = requireFile("docs/HN_SRS_FRD_v1.12_FULL.md");
const erd = requireFile("docs/HoaNam_ERD_Moi_Nhat.md");

for (const [content, label] of [
  [srs, "SRS/FRD baseline"],
  [erd, "ERD baseline"],
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

// ĐÃ RÚT theo 3822d45: các assert viewport/shared-UI-state/metadata trên
// e2e/wwhn-274-release-signoff.spec.ts đọc spec đã gỡ khỏi repo — rút theo.

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

// ĐÃ RÚT theo 3822d45: vòng kiểm boundary truy vết (FE-controlled/WWHN-272/
// WWHN-275/Stocktake/P0-P1-P2) đọc docs/Task_docs_Jira/WWHN-274.md đã gỡ khỏi
// repo — rút theo.

// ---------------------------------------------------------------------------
// Vòng 2 — register FE274-*. Vòng 1 chỉ chứng minh "gate tồn tại"; reviewer bác
// bỏ vì (a) không truy xuất được run/artifact theo đúng candidate SHA, (b) toàn
// bộ E2E chạy trên API mock nên không chứng minh được FE↔BE thật, (c) không có
// bằng chứng bàn phím/a11y/ma trận trình duyệt. Ba nhóm assert dưới đây khoá
// từng nguyên nhân đó lại để một lần sửa sau này không âm thầm tụt về mức cũ.
// ---------------------------------------------------------------------------
// ĐÃ RÚT theo 3822d45: e2e/wwhn-274-real-env-smoke.spec.ts và
// e2e/wwhn-274-a11y-browser-matrix.spec.ts đã gỡ khỏi repo cùng toàn bộ bộ
// e2e — các assert FE274-P1-06 (cấm page.route/route.fulfill trong real-env
// smoke, kèm helper stripComments chỉ phục vụ nhóm này) và FE274-P2-03 (needle
// a11y NFR-SRS-006/getByLabel/ant-input-affix-wrapper trong spec) rút theo.
// Ma trận project trình duyệt trong playwright.config.ts + workflow và các
// gate real-env/a11y trong workflow bên dưới vẫn được kiểm nguyên vẹn.
const exactShaRunner = requireFile(
  "scripts/run-wwhn-274-exact-sha-evidence.mjs",
);
const playwrightConfig = requireFile("playwright.config.ts");
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
// ĐÃ RÚT theo 3822d45: vòng kiểm "evidence"/"generated"/cấm "test-results"
// trên ba e2e spec đọc spec đã gỡ khỏi repo — rút theo; assert phía workflow
// ngay dưới giữ nguyên.
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
  // Nếu để Playwright tự bật dev server, `reuseExistingServer` sẽ bám vào bất kỳ
  // server nào đang giữ cổng — kể cả của một cây làm việc khác — và manifest sẽ ghi
  // kết quả của ứng dụng KHÔNG thuộc SHA này.
  "E2E_BASE_URL",
  "e2eTargetBaseUrl",
]) {
  requireText(exactShaRunner, needle, `exact-SHA runner contract ${needle}`);
}
requireText(
  workflow,
  "inputs.source_sha",
  "workflow_dispatch chạy lại được trên đúng candidate SHA",
);
// Chạy lại theo SHA chỉ hoạt động khi có đủ lịch sử: `ref:` của actions/checkout
// không nhận SHA rút gọn và shallow clone không có commit cũ để checkout tiếp —
// run 32206344201 đã chết ngay ở bước checkout đúng vì lý do này.
requireText(
  workflow,
  "fetch-depth: 0",
  "đủ lịch sử để checkout candidate SHA",
);
rejectText(
  workflow,
  "ref: ${{ inputs.source_sha",
  "checkout theo input SHA (hỏng với SHA rút gọn) thay vì tự resolve",
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

// ĐÃ RÚT theo 3822d45: khối FE274-P2-01/P2-02 (URL repo canonical, cấm nhánh
// m1ee, đủ 9 ID register vòng 2, anchor NFR-SRS-006/REQ-SRS-037) đọc
// docs/Task_docs_Jira/WWHN-274.md đã gỡ khỏi repo — rút theo.

if (failures.length > 0) {
  console.error("WWHN-274 closure verification FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "WWHN-274 source-controlled closure contract PASS (env/workflow/playwright-config/exact-SHA-runner/package-script checks; task-doc, e2e-spec and wireframe checks retired by 3822d45)",
);
console.log(
  "Truth boundary: FE controlled evidence only; independent QA/UAT/DevOps evidence remains role-owned.",
);
