#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "docs/Task_docs_Jira/WWHN-156.md",
  "docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json",
  "e2e/auth-role-navigation-qa2.spec.ts",
  "e2e/wms-runtime-evidence.spec.ts",
  "scripts/capture-permission-403-evidence.mjs",
  "scripts/capture-role-scopes-screenshots.mjs",
  "scripts/run-wwhn-156-smoke.mjs",
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

// UAT/RBAC narrative docs were consolidated into the WWHN-156 closure package.
// Resolve the first candidate that exists so a doc rename cannot fail the gate,
// while still failing closed when the evidence disappears from every candidate.
function readFirstAvailable(candidates, label) {
  for (const candidate of candidates) {
    const fullPath = join(root, candidate);
    if (existsSync(fullPath)) {
      return { path: candidate, content: readFileSync(fullPath, "utf8") };
    }
  }
  fail(`${label}: none of the candidate files exist (${candidates.join(", ")})`);
  return { path: candidates[0], content: "" };
}

function requirePatterns(content, patterns, label, file) {
  const missing = patterns.filter((pattern) => !pattern.test(content));
  if (missing.length > 0) {
    fail(
      `${label} is incomplete in ${relative(root, join(root, file))}: missing ${missing
        .map((pattern) => pattern.toString())
        .join(", ")}`,
    );
  }
}

for (const file of requiredFiles) readRequired(file);

const { path: uatDocPath, content: uatDoc } = readFirstAvailable(
  [
    "docs/Task_docs_Jira/Khắc phục lỗi UI_responsive_RBAC.md",
    "docs/Task_docs_Jira/WWHN-156.md",
  ],
  "WWHN-78 UAT responsive/RBAC evidence",
);
requirePatterns(
  uatDoc,
  [
    /WWHN-78/iu,
    // HN-UAT-003 was retired as a temp key; WWHN-292/293 are its successors.
    /HN-UAT-003|WWHN-292|WWHN-293/iu,
    /module|màn hình|man hinh|screen/iu,
    /route/iu,
    /role|account/iu,
    /viewport/iu,
    /Before evidence|before-after|before\/after/iu,
    /severity|P0|P1/iu,
    /desktop/iu,
    /tablet/iu,
    /mobile/iu,
    /loading/iu,
    /empty/iu,
    /error/iu,
    /success/iu,
    /disabled/iu,
    /confirm/iu,
    /screenshot|video/iu,
  ],
  "WWHN-78 defect and after-evidence traceability",
  uatDocPath,
);

const taskDocPath = "docs/Task_docs_Jira/WWHN-156.md";
const taskDoc = readRequired(taskDocPath);
requirePatterns(
  taskDoc,
  [
    /WWHN-157/iu,
    /WWHN-32/iu,
    /WWHN-78/iu,
    /WWHN-292/iu,
    /WWHN-293/iu,
    /WWHN-20/iu,
    /WWHN-28/iu,
    /WWHN-140/iu,
    /WWHN-141/iu,
    /WWHN-142/iu,
    /direct API 403/iu,
    /data-scope deny/iu,
    /source SHA/iu,
    /execution.*SHA/iu,
    /artifact/iu,
    /pass\/fail/iu,
  ],
  "WWHN-156 P1 closure and handoff matrix",
  taskDocPath,
);
if (/blob:/iu.test(taskDoc)) fail(`${taskDocPath} contains non-traceable blob evidence.`);

const registerPath = "docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json";
let register = {};
try {
  register = JSON.parse(readRequired(registerPath));
} catch (error) {
  fail(`${registerPath} is invalid JSON: ${error.message}`);
}
const expectedBlockedOwners = new Set([
  "WWHN156-P1-01",
  "WWHN156-P1-02",
  "WWHN156-P1-03",
  "WWHN156-P1-04",
  "WWHN156-P1-05",
]);
const reviewItems = Array.isArray(register.reviewItems) ? register.reviewItems : [];
for (const item of reviewItems) {
  if (expectedBlockedOwners.has(item.id) && item.closureState !== "BLOCKED_EXTERNAL") {
    fail(`${item.id} must remain BLOCKED_EXTERNAL until its independent owner attaches evidence.`);
  }
}
if (reviewItems.filter((item) => expectedBlockedOwners.has(item.id)).length !== expectedBlockedOwners.size) {
  fail("Closure register is missing one or more independent P1 gates.");
}

const qa2Spec = readRequired("e2e/auth-role-navigation-qa2.spec.ts");
const runtimeSpec = readRequired("e2e/wms-runtime-evidence.spec.ts");
if (/test\.skip/iu.test(qa2Spec) || /test\.skip/iu.test(runtimeSpec)) {
  fail("Targeted QA2/runtime evidence tests must not be skipped.");
}
requirePatterns(
  runtimeSpec,
  [
    /desktop-1440x900/iu,
    /tablet-1024x768/iu,
    /mobile-390x844/iu,
    /limited role.*403/iu,
    /login API error/iu,
    /422/iu,
    /component-catalog/iu,
    /screenshot/iu,
    /video/iu,
    /trace/iu,
  ],
  "controlled responsive/RBAC/API-error evidence suite",
  "e2e/wms-runtime-evidence.spec.ts",
);

const { path: rbacDocPath, content: rbacDoc } = readFirstAvailable(
  [
    "docs/Task_docs_Jira/HN-FND-001-FE-AUTH-SESSION-403.md",
    "docs/Task_docs_Jira/WWHN-165.md",
  ],
  "independent backend RBAC boundary evidence",
);
requirePatterns(
  rbacDoc,
  [/backend authorization/iu, /403/iu, /permission catalog/iu, /BE\/RBAC|BE2|RBAC owner/iu, /independent|direct API/iu],
  "independent backend RBAC boundary",
  rbacDocPath,
);

if (process.exitCode) process.exit(process.exitCode);
console.log(
  "[uat-p0-p1] PASS: real defect traceability, controlled after-evidence generation and fail-closed external P1 ownership are enforced.",
);
