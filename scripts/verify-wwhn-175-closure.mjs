#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readRequired(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    fail(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(fullPath, "utf8");
}

function requirePatterns(path, patterns) {
  const content = readRequired(path);
  for (const pattern of patterns) {
    if (!pattern.test(content)) {
      fail(`${path} is missing required pattern ${pattern}`);
    }
  }
  return content;
}

// ── Tài liệu canonical + docs/evidence/wwhn-175 + e2e — ĐÃ RÚT theo 3822d45 ─
// docs/Task_docs_Jira/WWHN-175.md, toàn bộ docs/evidence/wwhn-175/* (README,
// ARCHITECTURE_DISPOSITION, QA2 matrix, DEVOPS_HANDOFF, BRANCH_SCOPE_MAP,
// CLOSURE_REGISTER) và e2e/wwhn-175-foundation-evidence.spec.ts đã được gỡ
// khỏi repo trong đợt dọn kho tài liệu (commit 3822d45); các kiểm tra đọc
// artefact đó rút theo. Kiểm tra mã nguồn sống phía dưới giữ nguyên hiệu lực.

for (const implementationPath of [
  "src/app/providers/AppProviders.tsx",
  "src/app/router/index.tsx",
  "src/app/router/ProtectedRoute.tsx",
  "src/app/router/RequirePermission.tsx",
  "src/app/layouts/MainLayout.tsx",
  "src/modules/auth/services/auth.service.ts",
  "src/shared/api/axios.ts",
  "src/shared/store/auth.store.ts",
  "src/shared/components/index.ts",
  "src/shared/components/README.md",
  // ComponentCatalogPage.tsx đã gỡ khi UI hợp nhất về canonical @/shared/ui
  // (chương trình Vuexy Part 4/5) — không còn là điều kiện đóng task.
]) {
  readRequired(implementationPath);
}

// ── WWHN-175_CLOSURE_REGISTER.json — ĐÃ RÚT theo 3822d45 (docs/evidence) ───

const packageJson = JSON.parse(readRequired("package.json") || "{}");
if (
  packageJson.scripts?.["wwhn-175:verify"] !==
  "node scripts/verify-wwhn-175-closure.mjs"
) {
  fail("package.json must expose exact wwhn-175:verify script");
}
// ĐÃ RÚT 10/09/2026: script test:e2e:wwhn-175 trỏ e2e/wwhn-175-foundation-evidence.spec.ts
// (gỡ ở 3822d45) nên bị xoá khỏi package.json, cùng bước capture tương ứng trong ci.yml.
if (
  packageJson.scripts?.["wwhn-177:handoff"] !==
  "node scripts/create-wwhn-177-dev-handoff.mjs"
) {
  fail("package.json must expose exact wwhn-177:handoff script");
}

const workflow = requirePatterns(".github/workflows/ci.yml", [
  /Verify WWHN-175 foundation closure controls/,
  /npm run wwhn-175:verify/,
  /Create WWHN-177 immutable DEV handoff/,
  /npm run wwhn-177:handoff/,
  /WWHN_175_OUTCOME/,
  /WWHN_177_HANDOFF_OUTCOME/,
  /name: DEV delivery evidence/,
  /environment:\s*\n\s*name: DEV/,
  /wwhn-177-dev-environment-evidence-/,
]);

const pushBlock =
  workflow.match(/push:\s*\n\s*branches:\s*\n((?:\s*-\s*[^\n]+\n?)+)/)?.[1] ?? "";
if (!/- dev/.test(pushBlock) || !/- m1/.test(pushBlock)) {
  fail("CI push branches must include actual dev and m1 branches");
}
if (/- main/.test(pushBlock)) {
  fail("CI push branches must not retain non-existent main branch");
}

// Ranh giới "không tự ký thay QA2/DevOps/BA/Tech Lead" từng nằm trong tài
// liệu canonical — đã rút theo 3822d45 cùng khối tài liệu phía trên.

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[wwhn-175] ERROR: ${failure}`);
  }
  process.exit(1);
}

console.log(
  "[wwhn-175] PASS: live foundation files, script/CI wiring and branch scope hold (doc/evidence/e2e checks retired by 3822d45).",
);
