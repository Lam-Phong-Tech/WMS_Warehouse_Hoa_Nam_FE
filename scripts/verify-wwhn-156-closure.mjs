#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
// ĐÃ RÚT theo 3822d45: WWHN-156_CLOSURE_REGISTER.json (docs/evidence) và
// docs/Task_docs_Jira/WWHN-156.md không còn trong repo — mọi kiểm tra đọc
// hai artefact đó rút theo. Phần hợp đồng SỐNG (script smoke/health/manifest,
// .env.example, wiring package.json + CI) giữ nguyên hiệu lực bên dưới.

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

const workflow = readRequired(".github/workflows/ci.yml");
const packageText = readRequired("package.json");
const envExample = readRequired(".env.example");
const envVerifier = readRequired("scripts/verify-env-health-contract.mjs");
const smokeRunner = readRequired("scripts/run-wwhn-156-smoke.mjs");
const evidenceCollector = readRequired("scripts/collect-wms-runtime-evidence.mjs");
const buildManifestWriter = readRequired("scripts/write-build-manifest.mjs");
const healthChecker = readRequired("scripts/check-frontend-health.mjs");

let packageJson;
try {
  packageJson = JSON.parse(packageText);
} catch (error) {
  fail(`Invalid package.json: ${error.message}`);
  packageJson = {};
}

// ── Khối đối chiếu closure register + task doc — ĐÃ RÚT theo 3822d45 ───────

requireValue(packageJson.scripts?.["wwhn-156:verify"] === "node scripts/verify-wwhn-156-closure.mjs", "package.json must expose wwhn-156:verify");
requireValue(packageJson.scripts?.["smoke:wwhn-156"] === "node scripts/run-wwhn-156-smoke.mjs", "package.json must expose smoke:wwhn-156");
requirePattern(packageJson.scripts?.build ?? "", /write-build-manifest\.mjs/u, "build manifest generation");

for (const pattern of [
  /id:\s*wwhn_156/u,
  /npm run wwhn-156:verify/u,
  /id:\s*smoke_contract/u,
  /npm run smoke:wwhn-156[\s\S]*--contract-only/u,
  // WWHN_156_OUTCOME / SMOKE_CONTRACT_OUTCOME: rút 10/09/2026 — CI không còn biến outcome
  // từng bước; hai bước trên là cổng cứng trong job contracts, cổng tổng đọc kết quả job.
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
  "[wwhn-156] PASS: live health/smoke/build-manifest contract, env template and script/CI wiring hold (register/task-doc checks retired by 3822d45).",
);
