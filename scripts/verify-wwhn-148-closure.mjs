#!/usr/bin/env node
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const fail = (message) => failures.push(message);

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
    if (!pattern.test(content)) fail(`${path} is missing required pattern ${pattern}`);
  }
  return content;
}

const canonicalDoc = requirePatterns("docs/Task_docs_Jira/WWHN-148.md", [
  /WWHN-146/,
  /WWHN-147/,
  /WWHN-149/,
  /WWHN-180/,
  /WWHN-182/,
  /WWHN-183/,
  /fail-closed/i,
  /403/,
  /409/,
  /412/,
  /422/,
  /Idempotency-Key/,
  /named DEV\/UAT/i,
  /blob/i,
  /SHA256/,
]);

const backReferenceFiles = globSync("docs/**/*.md", { cwd: root }).filter(
  (file) =>
    file.replace(/\\/g, "/") !== "docs/Task_docs_Jira/WWHN-148.md" &&
    /docs\/Task_docs_Jira\/WWHN-148\.md/.test(
      readFileSync(join(root, file), "utf8"),
    ),
);
if (!backReferenceFiles.length) {
  fail(
    "No published doc references docs/Task_docs_Jira/WWHN-148.md — the reuse/traceability back-reference was lost",
  );
}

// WWHN-296 refreshed the active M1 mapping to the current MVP baseline. Keep
// critical posting paths and explicitly prove that historical Stocktake was removed.
requirePatterns("docs/api-evidence/M1_API_MAPPING.md", [
  /POST\s+\|\s+`\/scan\/classify`/,
  /POST\s+\|\s+`\/inbound-documents\/\{id\}\/post-receipt`/,
  /POST\s+\|\s+`\/outbound-documents\/\{id\}\/post-issue`/,
  /Removed-from-MVP boundary — Stocktake/,
  /Reversal append-only/i,
  /independent gates/i,
]);

const manifestPath = "docs/evidence/wwhn-148/WWHN-148_CLOSURE_MANIFEST.json";
const manifestText = readRequired(manifestPath);
if (manifestText) {
  try {
    const manifest = JSON.parse(manifestText);
    if (manifest.schemaVersion !== "2.0.0") {
      fail(`${manifestPath} schemaVersion must be 2.0.0.`);
    }
    if (manifest.task !== "WWHN-148" || manifest.branch !== "m1") {
      fail(`${manifestPath} task/branch mismatch.`);
    }
    for (const key of [
      "WWHN-146",
      "WWHN-147",
      "WWHN-149",
      "WWHN-180",
      "WWHN-182",
      "WWHN-183",
    ]) {
      if (!manifest.gates?.[key]) fail(`${manifestPath} is missing gate ${key}.`);
    }
    if (manifest.finalPolicy?.failClosed !== true) {
      fail(`${manifestPath} must be fail-closed.`);
    }
    if (manifest.finalPolicy?.controlledMocksMayOpenFinal !== false) {
      fail(`${manifestPath} must reject controlled mocks for final.`);
    }
    if (manifest.finalPolicy?.blobImageCommentsAccepted !== false) {
      fail(`${manifestPath} must reject blob-image comments.`);
    }
    const scenarios = new Set(manifest.qa2RuntimeScenarios ?? []);
    for (const scenario of [
      "RESPONSIVE_DESKTOP_TABLET_MOBILE",
      "RBAC_ROUTE_DENY_403",
      "DIRECT_API_403",
      "VALIDATION_422_FIELD_MAPPING",
      "CONFLICT_409",
      "IDEMPOTENCY_REPLAY",
      "IDEMPOTENCY_CONFLICT",
      "STALE_WRITE_409_OR_412",
      "NO_STACK_TRACE_OR_SECRET",
      "REQUEST_ID_TRACEABILITY",
    ]) {
      if (!scenarios.has(scenario)) {
        fail(`${manifestPath} is missing runtime scenario ${scenario}.`);
      }
    }
  } catch (error) {
    fail(`${manifestPath} is invalid JSON: ${error.message}`);
  }
}

requirePatterns("docs/evidence/wwhn-148/QA2_RUNTIME_EVIDENCE_RUNBOOK.md", [
  /named DEV\/UAT/,
  /immutable build ID/i,
  /direct API 403/i,
  /HTTP 422/,
  /HTTP 409/,
  /409 hoặc 412/,
  /Idempotency replay/i,
  /SHA256SUMS/,
  /INVALID_EVIDENCE/,
  /blob URL/i,
]);

const normalizationPath = "docs/api-evidence/WWHN-148_NORMALIZATION_REGISTER.json";
const normalizationText = readRequired(normalizationPath);
if (normalizationText) {
  try {
    const normalization = JSON.parse(normalizationText);
    if (normalization.task !== "WWHN-148") {
      fail(`${normalizationPath} task mismatch.`);
    }
    if (!Array.isArray(normalization.criticalFlows)) {
      fail(`${normalizationPath} must define criticalFlows.`);
    }
    for (const flow of normalization.criticalFlows ?? []) {
      if (!flow.id || !flow.service || !Array.isArray(flow.requiredCanonicalFields)) {
        fail(`${normalizationPath} has an invalid critical flow entry.`);
      }
      if (flow.legacySuccessAliasesAllowed !== true) {
        fail(
          `${flow.id} must explicitly preserve current temporary alias policy until BE contract lock.`,
        );
      }
    }
  } catch (error) {
    fail(`${normalizationPath} is invalid JSON: ${error.message}`);
  }
}

const viteConfig = readRequired("vite.config.ts");
for (const forbidden of [
  /vitest\/config/,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\brequire\s*\(/,
]) {
  if (forbidden.test(viteConfig)) {
    fail(`vite.config.ts contains forbidden pattern ${forbidden}`);
  }
}
for (const required of [
  /from "vite"/,
  /from "node:path"/,
  /from "node:url"/,
  /fileURLToPath\(import\.meta\.url\)/,
]) {
  if (!required.test(viteConfig)) fail(`vite.config.ts is missing ${required}`);
}

requirePatterns("e2e/wms-runtime-evidence.spec.ts", [
  /desktop-1440x900/,
  /tablet-1024x768/,
  /mobile-390x844/,
  /errors\/403/,
  /status\(\)\)\.toBe\(422\)/,
]);

requirePatterns("src/test/wwhn-148-critical-response-contract.test.ts", [
  /accepts canonical snake_case success evidence/,
  /rejects undocumented receipt aliases/,
  /rejects undocumented issue aliases/,
  /REQ-SRS-037/,
]);

const packageJsonText = readRequired("package.json");
if (packageJsonText) {
  try {
    const packageJson = JSON.parse(packageJsonText);
    if (
      packageJson.scripts?.["wwhn-148:verify"] !==
      "node scripts/verify-wwhn-148-closure.mjs"
    ) {
      fail("package.json must expose the exact wwhn-148:verify script.");
    }
  } catch (error) {
    fail(`package.json is invalid JSON: ${error.message}`);
  }
}

requirePatterns(".github/workflows/ci.yml", [
  /Verify WWHN-148 FE closure/,
  /npm run wwhn-148:verify/,
]);

if (
  !/FE-owned remediation complete; final acceptance pending independent evidence/i.test(
    canonicalDoc,
  )
) {
  fail("WWHN-148 must state the independent-evidence boundary truthfully.");
}

if (failures.length) {
  for (const failure of failures) console.error(`[wwhn-148] ERROR: ${failure}`);
  process.exit(1);
}

console.log(
  "[wwhn-148] PASS: current MVP FE closure, runtime handoff, traceability and fail-closed independent-evidence boundary are consistent.",
);
