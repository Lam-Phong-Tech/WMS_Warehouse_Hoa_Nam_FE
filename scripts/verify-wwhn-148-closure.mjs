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

const canonicalDoc = requirePatterns("docs/Task_docs_Jira/WWHN-148.md", [
  /WWHN-146/,
  /WWHN-147/,
  /WWHN-149/,
  /Conditional Pass/i,
  /403/,
  /409/,
  /422/,
  /Idempotency-Key/,
  /desktop/i,
  /tablet/i,
  /mobile/i,
  /normalization/i,
  /Vite\/Vitest/i,
]);

requirePatterns(
  "docs/Task_docs_Jira/[FE1] Rà soát khả năng triển khai và tái sử dụng.md",
  [/docs\/Task_docs_Jira\/WWHN-148\.md/],
);

const mapping = requirePatterns("docs/api-evidence/M1_API_MAPPING.md", [
  /POST\s+\|\s+`\/scan\/classify`/,
  /POST\s+\|\s+`\/inbound-documents\/\{id\}\/post-receipt`/,
  /POST\s+\|\s+`\/outbound-documents\/\{id\}\/post-issue`/,
  /POST\s+\|\s+`\/stocktake\/sessions\/\{sessionId\}\/apply-adjustment`/,
  /scan\.classify/,
  /inbound\.post/,
  /outbound\.post/,
  /stocktake\.adjust/,
]);

if (/final sign-off[\s\S]{0,160}fail-closed/i.test(mapping) === false) {
  fail("M1 API mapping must preserve the independent sign-off boundary.");
}

const normalizationPath =
  "docs/api-evidence/WWHN-148_NORMALIZATION_REGISTER.json";
const normalizationText = readRequired(normalizationPath);
if (normalizationText) {
  try {
    const normalization = JSON.parse(normalizationText);
    if (normalization.task !== "WWHN-148") {
      fail(`${normalizationPath} must be owned by WWHN-148.`);
    }
    if (!Array.isArray(normalization.criticalFlows)) {
      fail(`${normalizationPath} must define criticalFlows.`);
    } else {
      const ids = normalization.criticalFlows.map((flow) => flow.id);
      for (const id of ["POST_RECEIPT", "POST_ISSUE", "APPLY_ADJUSTMENT"]) {
        if (!ids.includes(id)) fail(`${normalizationPath} is missing ${id}.`);
      }
      for (const flow of normalization.criticalFlows) {
        if (flow.legacySuccessAliasesAllowed !== true) {
          fail(`${flow.id} must explicitly declare its temporary alias policy.`);
        }
        if (!Array.isArray(flow.explicitTemporaryAliases)) {
          fail(`${flow.id} must enumerate explicitTemporaryAliases.`);
        }
      }
    }
  } catch (error) {
    fail(`${normalizationPath} is invalid JSON: ${error.message}`);
  }
}

const viteConfig = readRequired("vite.config.ts");
for (const forbidden of [
  /vitest\/config/,
  /reference types=["']vitest\/config["']/,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\brequire\s*\(/,
]) {
  if (forbidden.test(viteConfig)) {
    fail(`vite.config.ts contains forbidden config-loader coupling ${forbidden}`);
  }
}
for (const required of [
  /from "vite"/,
  /from "node:path"/,
  /from "node:url"/,
  /fileURLToPath\(import\.meta\.url\)/,
]) {
  if (!required.test(viteConfig)) {
    fail(`vite.config.ts is missing ESM-safe pattern ${required}`);
  }
}

const vitestConfig = readRequired("vitest.config.ts");
for (const forbidden of [/\b__dirname\b/, /\b__filename\b/, /\brequire\s*\(/]) {
  if (forbidden.test(vitestConfig)) {
    fail(`vitest.config.ts contains forbidden config-loader pattern ${forbidden}`);
  }
}
for (const required of [
  /from "vitest\/config"/,
  /from "node:path"/,
  /from "node:url"/,
  /fileURLToPath\(import\.meta\.url\)/,
]) {
  if (!required.test(vitestConfig)) {
    fail(`vitest.config.ts is missing isolated ESM-safe pattern ${required}`);
  }
}

requirePatterns("e2e/wms-runtime-evidence.spec.ts", [
  /desktop-1440x900/,
  /tablet-1024x768/,
  /mobile-390x844/,
  /component-catalog/,
  /master-data/,
  /errors\/403/,
  /status\(\)\)\.toBe\(422\)/,
  /Loading/,
  /Empty/,
  /No permission/,
  /Confirm action/,
]);

requirePatterns("src/test/wwhn-148-critical-response-contract.test.ts", [
  /rejects undocumented receipt aliases/,
  /rejects undocumented issue aliases/,
  /rejects undocumented adjustment aliases/,
  /receipt_id/,
  /issue_id/,
  /movement_ref/,
  /request_id/,
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

if (!/FE-owned closure complete, final acceptance pending independent gates/i.test(canonicalDoc)) {
  fail("WWHN-148 canonical document must state the truthful final boundary.");
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[wwhn-148] ERROR: ${failure}`);
  }
  process.exit(1);
}

console.log(
  "[wwhn-148] PASS: canonical evidence, API mapping, normalization policy, config isolation, runtime scenarios and CI wiring are complete for FE-owned scope.",
);
