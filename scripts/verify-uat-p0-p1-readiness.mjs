#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "docs/Task_docs_Jira/Khắc phục lỗi UI_responsive_RBAC.md",
  "docs/Task_docs_Jira/[FE1] Chuẩn hóa Xây dựng_env_health.md",
  "docs/Task_docs_Jira/HN-FND-001-FE-AUTH-SESSION-403.md",
  "e2e/auth-role-navigation-qa2.spec.ts",
  "scripts/capture-permission-403-evidence.mjs",
  "scripts/capture-role-scopes-screenshots.mjs",
];

const readinessChecks = [
  {
    id: "WWHN-78/HN-UAT-003 defect traceability",
    file: "docs/Task_docs_Jira/Khắc phục lỗi UI_responsive_RBAC.md",
    patterns: [
      /WWHN-78/i,
      /HN-UAT-003/i,
      /module/i,
      /route/i,
      /role|account/i,
      /viewport/i,
      /Before evidence|before-after|before\/after/i,
      /severity|P0|P1/i,
    ],
  },
  {
    id: "Code/build artifact proof",
    file: "docs/Task_docs_Jira/[FE1] Chuẩn hóa Xây dựng_env_health.md",
    patterns: [
      /Code da cap nhat|Code đã cập nhật/i,
      /scripts\/verify-env-health-contract\.mjs/i,
      /scripts\/verify-uat-p0-p1-readiness\.mjs/i,
      /package\.json/i,
      /\.github\/workflows\/ci\.yml/i,
      /npm\.cmd run build|npm run build/i,
      /SHA|commit|build ID|CI/i,
    ],
  },
  {
    id: "After evidence and UI states",
    file: "docs/Task_docs_Jira/Khắc phục lỗi UI_responsive_RBAC.md",
    patterns: [
      /desktop/i,
      /tablet/i,
      /mobile/i,
      /loading/i,
      /empty/i,
      /error/i,
      /success/i,
      /disabled/i,
      /confirm/i,
      /screenshot|video/i,
    ],
  },
  {
    id: "QA2 WWHN-293 retest disposition",
    file: "docs/Task_docs_Jira/[FE1] Chuẩn hóa Xây dựng_env_health.md",
    patterns: [/WWHN-293/i, /QA2/i, /retest/i, /pass\/fail/i, /browser/i, /role/i],
  },
  {
    id: "Parent WWHN-78 blocker disposition",
    file: "docs/Task_docs_Jira/[FE1] Chuẩn hóa Xây dựng_env_health.md",
    patterns: [/WWHN-78/i, /Blocked|Pending/i, /disposition/i, /Lead/i, /QA2/i],
  },
  {
    id: "BA DEC-UAT baseline traceability",
    file: "docs/Task_docs_Jira/[FE1] Chuẩn hóa Xây dựng_env_health.md",
    patterns: [/DEC-UAT/i, /WWHN-20/i, /WWHN-28/i, /WWHN-140/i, /WWHN-141/i, /WWHN-142/i, /approval|baseline|source register/i],
  },
  {
    id: "Independent RBAC/backend authorization evidence",
    file: "docs/Task_docs_Jira/HN-FND-001-FE-AUTH-SESSION-403.md",
    patterns: [/backend authorization/i, /403/i, /permission catalog/i, /BE\/RBAC|BE2|RBAC owner/i, /independent|direct API/i],
  },
];

function fail(message) {
  console.error(`[uat-p0-p1] ${message}`);
  process.exitCode = 1;
}

function readRequired(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    fail(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(fullPath, "utf8");
}

for (const file of requiredFiles) {
  readRequired(file);
}

for (const check of readinessChecks) {
  const content = readRequired(check.file);
  const missing = check.patterns.filter((pattern) => !pattern.test(content));
  if (missing.length > 0) {
    fail(
      `${check.id} is incomplete in ${relative(root, join(root, check.file))}: missing ${missing
        .map((pattern) => pattern.toString())
        .join(", ")}`,
    );
  }
}

const qa2Spec = readRequired("e2e/auth-role-navigation-qa2.spec.ts");
if (/test\.skip\([^)]*PASSWORD_CHANGE_REQUIRED/i.test(qa2Spec)) {
  fail("QA2 PASSWORD_CHANGE_REQUIRED retest must not be skipped.");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(
  "[uat-p0-p1] P0/P1 readiness checks cover UAT defect traceability, code proof, after evidence, QA2 retest, parent disposition, BA baseline, and RBAC backend evidence.",
);
