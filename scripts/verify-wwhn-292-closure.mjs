#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFinal = process.argv.includes("--require-final");

function fail(message) {
  console.error(`[WWHN-292] FAIL: ${message}`);
  process.exit(1);
}

function requireFile(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    fail(`Missing required task-specific artifact: ${path}`);
  }
  return readFileSync(absolute, "utf8");
}

function requireText(text, needle, context) {
  if (!text.includes(needle)) {
    fail(`${context} must contain ${JSON.stringify(needle)}`);
  }
}

// ĐÃ RÚT theo 3822d45: docs/Task_docs_Jira/WWHN-292.md,
// docs/evidence/wwhn-292/WWHN-292_CLOSURE_REGISTER.json và
// e2e/wwhn-292-ui-responsive-rbac.spec.ts đã gỡ khỏi repo trong đợt dọn kho
// tài liệu — mọi kiểm tra đọc các artefact đó (register policy/viewport/review
// item/R2 closure state, boundary + truth marker trong task doc, metadata
// trong e2e spec) rút theo. Kiểm tra mã nguồn sống phía dưới (workflow,
// package.json) giữ nguyên hiệu lực.
const workflowPath = ".github/workflows/wwhn-292-fe-closure.yml";

const workflow = requireFile(workflowPath);
const packageJson = JSON.parse(requireFile("package.json"));

for (const requiredScript of ["wwhn-292:verify", "test:e2e:wwhn-292"]) {
  if (!packageJson.scripts?.[requiredScript]) {
    fail(`package.json is missing script ${requiredScript}`);
  }
}

for (const workflowMarker of [
  "npm run format:check",
  "npm run lint",
  "npm run typecheck",
  "npm run test",
  "npm run wwhn-292:verify",
  "npm run build",
  "npm run test:e2e:wwhn-292",
  "EXACT_GIT_SHA",
  "GITHUB_RUN_ID",
  "SHA256SUMS",
]) {
  requireText(workflow, workflowMarker, workflowPath);
}

// ĐÃ RÚT theo 3822d45: các kiểm tra FE292-P1-06 (responsiveContract trong
// register + shell marker trong e2e spec), FE292-P2-03 (ma trận route deny/
// positive control trong e2e spec), FE292-P1-01 (WWHN-292_DEFECT_REGISTER.json),
// FE292-P1-02 (WWHN-292_SIGNOFF_COMMENTS.md) và toàn bộ gói final identity
// (docs/evidence/wwhn-292/final/ + QA2_RETEST_MATRIX.md +
// BE_AUTHZ_EVIDENCE_REF.md) đều đọc artefact đã gỡ khỏi repo trong đợt dọn kho
// tài liệu — rút theo. Hành vi shell/RBAC sống nay được các gate khác canh
// (test đơn vị SideNav/UiAppShell + ROUTE_PERMISSIONS), không thuộc script này.

console.log(
  requireFinal
    ? "[WWHN-292] PASS (final): live-source checks hold (workflow gates, package scripts); doc/register/e2e/final-pack checks retired by 3822d45."
    : "[WWHN-292] PASS: live-source checks hold (workflow gates, package scripts); doc/register/e2e/evidence checks retired by 3822d45.",
);
