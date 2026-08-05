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

const taskDoc = requirePatterns("docs/Task_docs_Jira/WWHN-175.md", [
  /FE-owned closure: COMPLETE/i,
  /Final Jira acceptance: PENDING_INDEPENDENT_APPROVAL/i,
  /P0 trực tiếp[\s\S]*CLOSED \/ N\/A/i,
  /WWHN-176/,
  /WWHN-177/,
  /HN-FE-001-REUSABLE-FE-FOUNDATION\.md/,
  /1440x900/,
  /768x1024/,
  /375x812/,
  /React\/Vite/,
  /Next\.js/,
  /BRANCH_SCOPE_MAP\.md/,
  /không tự ký thay/i,
]);

requirePatterns("docs/evidence/wwhn-175/README.md", [
  /FE_EVIDENCE_READY_FOR_INDEPENDENT_REVIEW/,
  /WWHN-175_CLOSURE_REGISTER\.json/,
  /WWHN-176_QA2_EXECUTION_MATRIX\.md/,
  /WWHN-177_DEVOPS_HANDOFF\.md/,
]);

requirePatterns("docs/evidence/wwhn-175/ARCHITECTURE_DISPOSITION.md", [
  /PROPOSED_FOR_FORMAL_ACCEPTANCE/,
  /React\/Vite SPA shell/,
  /Next\.js shell/,
  /React 19/,
  /Vite 8/,
  /BA\/Tech Lead/,
]);

requirePatterns(
  "docs/evidence/wwhn-175/WWHN-176_QA2_EXECUTION_MATRIX.md",
  [
    /READY_FOR_QA2_EXECUTION/,
    /Chrome\/Edge/,
    /1440x900/,
    /768x1024/,
    /375x812/,
    /keyboard/i,
    /screen-reader/i,
  ],
);

requirePatterns("docs/evidence/wwhn-175/WWHN-177_DEVOPS_HANDOFF.md", [
  /PIPELINE_READY_FOR_DEVOPS_ACCEPTANCE/,
  /dist\/build-manifest\.json/,
  /GitHub Environment `DEV`/,
  /NOT_CONFIGURED_ARTIFACT_ONLY/,
  /không invent|does not invent/i,
]);

requirePatterns("docs/evidence/wwhn-175/BRANCH_SCOPE_MAP.md", [
  /dev@3f168d816aad7d5e32690ec392c83992a3e3a494/,
  /m1@79321532b6325b9be598aabdc49f92806b116b1f/,
  /ahead by 81/,
  /Exact closure file allowlist/,
  /outside closure scope/i,
]);

requirePatterns("e2e/wwhn-175-foundation-evidence.spec.ts", [
  /WWHN-175/,
  /WWHN-176/,
  /1440/,
  /768/,
  /375/,
  /keyboard-modal-focus/,
  /toBeFocused/,
  /getByRole\("dialog"/,
  /evidenceBoundary/,
]);

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
  "src/modules/component-catalog/ComponentCatalogPage.tsx",
]) {
  readRequired(implementationPath);
}

const registerPath =
  "docs/evidence/wwhn-175/WWHN-175_CLOSURE_REGISTER.json";
const registerText = readRequired(registerPath);
if (registerText) {
  try {
    const register = JSON.parse(registerText);
    if (register.task !== "WWHN-175") fail(`${registerPath}: wrong task`);
    if (register.branch !== "m1") fail(`${registerPath}: branch must be m1`);
    if (register.feOwnedStatus !== "COMPLETE") {
      fail(`${registerPath}: feOwnedStatus must be COMPLETE`);
    }
    if (register.finalAcceptanceStatus !== "PENDING_INDEPENDENT_APPROVAL") {
      fail(`${registerPath}: final acceptance boundary is not truthful`);
    }
    if (register.severity?.p0?.status !== "CLOSED_NA") {
      fail(`${registerPath}: P0 disposition must be CLOSED_NA`);
    }
    for (const gate of ["qa2", "devops", "baTechLead"]) {
      if (register.independentGates?.[gate]?.status !== "PENDING") {
        fail(`${registerPath}: ${gate} must remain explicitly PENDING`);
      }
    }
  } catch (error) {
    fail(`${registerPath} invalid JSON: ${error.message}`);
  }
}

const packageJson = JSON.parse(readRequired("package.json") || "{}");
if (
  packageJson.scripts?.["wwhn-175:verify"] !==
  "node scripts/verify-wwhn-175-closure.mjs"
) {
  fail("package.json must expose exact wwhn-175:verify script");
}
if (
  packageJson.scripts?.["test:e2e:wwhn-175"] !==
  "playwright test e2e/wwhn-175-foundation-evidence.spec.ts --project=chromium"
) {
  fail("package.json must expose exact test:e2e:wwhn-175 script");
}
if (
  packageJson.scripts?.["wwhn-177:handoff"] !==
  "node scripts/create-wwhn-177-dev-handoff.mjs"
) {
  fail("package.json must expose exact wwhn-177:handoff script");
}

const workflow = requirePatterns(".github/workflows/ci.yml", [
  /Verify WWHN-175 foundation closure controls/,
  /npm run wwhn-175:verify/,
  /Capture WWHN-175 responsive accessibility smoke evidence/,
  /npm run test:e2e:wwhn-175/,
  /Create WWHN-177 immutable DEV handoff/,
  /npm run wwhn-177:handoff/,
  /WWHN_175_OUTCOME/,
  /WWHN_175_E2E_OUTCOME/,
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

if (!/không tự ký thay QA2, DevOps, BA hoặc Tech Lead/i.test(taskDoc)) {
  fail("Task document must preserve independent owner boundary");
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[wwhn-175] ERROR: ${failure}`);
  }
  process.exit(1);
}

console.log(
  "[wwhn-175] PASS: canonical evidence, architecture disposition, exact branch scope, QA2 runtime suite, immutable DEV handoff and independent acceptance boundaries are wired.",
);
