#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const registerPath = "docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json";
const taskDocPath = "docs/Task_docs_Jira/WWHN-156.md";

function fail(message) {
  console.error(`[wwhn-156] ${message}`);
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

function requireValue(condition, message) {
  if (!condition) fail(message);
}

function requirePattern(content, pattern, label) {
  if (!pattern.test(content)) fail(`Missing ${label}: ${pattern}`);
}

const registerText = readRequired(registerPath);
const taskDoc = readRequired(taskDocPath);
const workflow = readRequired(".github/workflows/ci.yml");
const packageText = readRequired("package.json");
const envExample = readRequired(".env.example");
const envVerifier = readRequired("scripts/verify-env-health-contract.mjs");
const smokeRunner = readRequired("scripts/run-wwhn-156-smoke.mjs");
const evidenceCollector = readRequired("scripts/collect-wms-runtime-evidence.mjs");
const buildManifestWriter = readRequired("scripts/write-build-manifest.mjs");
const healthChecker = readRequired("scripts/check-frontend-health.mjs");

let register;
let packageJson;
try {
  register = JSON.parse(registerText);
} catch (error) {
  fail(`Invalid ${registerPath}: ${error.message}`);
  register = {};
}
try {
  packageJson = JSON.parse(packageText);
} catch (error) {
  fail(`Invalid package.json: ${error.message}`);
  packageJson = {};
}

const expectedIds = [
  "WWHN156-P0-01",
  "WWHN156-P1-01",
  "WWHN156-P1-02",
  "WWHN156-P1-03",
  "WWHN156-P1-04",
  "WWHN156-P1-05",
  "WWHN156-P1-06",
  "WWHN156-P2-01",
  "WWHN156-P2-02",
];
const items = Array.isArray(register.reviewItems) ? register.reviewItems : [];
requireValue(register.schemaVersion === "1.0.0", "closure register schemaVersion must be 1.0.0");
requireValue(register.task === "WWHN-156", "closure register task must be WWHN-156");
requireValue(register.branch === "m1", "closure register branch must be m1");
requireValue(
  JSON.stringify(items.map((item) => item.id)) === JSON.stringify(expectedIds),
  "review item IDs/order must exactly match the P0/P1/P2 assessment",
);
requireValue(register.evidencePolicy?.failClosed === true, "evidence policy must be fail-closed");
requireValue(
  register.evidencePolicy?.noSelfSignForIndependentRoles === true,
  "independent roles must not be self-signed by FE",
);
requireValue(
  register.healthContract?.backendHealthResolvedPath === "/api/v1/health",
  "canonical backend health path must be /api/v1/health",
);
requireValue(
  register.healthContract?.legacyRejectedPath === "/api/health",
  "legacy rejected health path must be /api/health",
);

const externalItems = items.filter((item) => item.closureState === "BLOCKED_EXTERNAL");
requireValue(externalItems.length === 5, "exactly five independent P1 gates must remain BLOCKED_EXTERNAL");
for (const item of externalItems) {
  requireValue(
    Array.isArray(item.independentEvidenceRequired) && item.independentEvidenceRequired.length > 0,
    `${item.id} must list independent evidence required`,
  );
}
for (const item of items) {
  requireValue(item.owner?.length > 0, `${item.id} must have an owner`);
  requireValue(item.feDisposition?.trim(), `${item.id} must have an FE disposition`);
  if (/CLOSED|PASS|DONE/u.test(item.closureState)) {
    requireValue(
      item.closureState.startsWith("FE_CONTROL_IMPLEMENTED"),
      `${item.id} cannot claim independent closure from FE evidence`,
    );
  }
}

for (const id of expectedIds) requirePattern(taskDoc, new RegExp(id, "u"), `task document row ${id}`);
for (const heading of [
  "Root cause CI",
  "Health contract versioned",
  "QA1 smoke handoff",
  "Immutable GitHub/CI trace",
  "External gate register",
  "Definition of Done",
]) {
  requirePattern(taskDoc, new RegExp(heading, "iu"), `WWHN-156 section ${heading}`);
}

for (const [path, content] of [
  [taskDocPath, taskDoc],
  [registerPath, registerText],
]) {
  requireValue(!/blob:/iu.test(content), `${path} must not contain blob: evidence URLs`);
}

requireValue(packageJson.scripts?.["wwhn-156:verify"] === "node scripts/verify-wwhn-156-closure.mjs", "package.json must expose wwhn-156:verify");
requireValue(packageJson.scripts?.["smoke:wwhn-156"] === "node scripts/run-wwhn-156-smoke.mjs", "package.json must expose smoke:wwhn-156");
requirePattern(packageJson.scripts?.build ?? "", /write-build-manifest\.mjs/u, "build manifest generation");

for (const pattern of [
  /id:\s*wwhn_156/u,
  /npm run wwhn-156:verify/u,
  /id:\s*smoke_contract/u,
  /npm run smoke:wwhn-156[\s\S]*--contract-only/u,
  /WWHN_156_OUTCOME/u,
  /SMOKE_CONTRACT_OUTCOME/u,
  /dist\/build-manifest\.json/u,
  /wms-fe-closure-evidence-/u,
]) {
  requirePattern(workflow, pattern, `CI WWHN-156 contract ${pattern}`);
}

requirePattern(envExample, /VITE_API_BASE_URL=.*\/api\/v1/iu, "versioned API base URL");
requirePattern(envExample, /VITE_API_HEALTH_PATH=["']?\/health/iu, "relative backend health path");
requirePattern(envVerifier, /\/api\/v1\/health/u, "canonical resolved health verifier");
requirePattern(envVerifier, /\/api\/health/u, "legacy health rejection");
requirePattern(smokeRunner, /backendSuccessRequiredFields/u, "backend health response validation");
requirePattern(smokeRunner, /request_id/u, "request-id evidence capture");
requirePattern(evidenceCollector, /WWHN-156/u, "WWHN-156 runtime manifest trace");
requirePattern(evidenceCollector, /artifactName/u, "immutable artifact name");
requirePattern(buildManifestWriter, /sourceSha/u, "build source SHA");
requirePattern(buildManifestWriter, /executionSha/u, "build execution SHA");
requirePattern(healthChecker, /build-manifest\.json/u, "build manifest health gate");

const sourceSha = process.env.SOURCE_SHA ?? process.env.WMS_SOURCE_SHA;
if (process.env.CI === "true") {
  requireValue(/^[0-9a-f]{40}$/iu.test(sourceSha ?? ""), "CI SOURCE_SHA must be an exact 40-character commit SHA");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `[wwhn-156] PASS: ${relative(root, join(root, registerPath))} enforces all FE-owned P0/P1/P2 controls while independent QA/DevOps/BA/BE gates remain fail-closed.`,
);
