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

const taskDoc = requireFile("docs/Task_docs_Jira/WWHN-274.md");
const e2e = requireFile("e2e/wwhn-274-release-signoff.spec.ts");
const workflow = requireFile(
  ".github/workflows/wwhn-274-fe-release-signoff.yml",
);
const envExample = requireFile(".env.example");
const techGuide = requireFile(
  "docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md",
);
const srs = requireFile("docs/HN_SRS_FRD_v1.12_FULL.md");
const erd = requireFile("docs/HoaNam_ERD_Moi_Nhat.md");
const wireframe = requireFile(
  "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html",
);

for (const [content, label] of [
  [srs, "SRS/FRD baseline"],
  [erd, "ERD baseline"],
  [wireframe, "wireframe baseline"],
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

for (const viewport of [
  "1440, height: 900",
  "768, height: 1024",
  "375, height: 812",
]) {
  requireText(e2e, viewport, `required viewport ${viewport}`);
}
for (const state of [
  "Loading",
  "Empty",
  "Error",
  "No permission",
  "API error + field errors",
  "Confirm action",
  "Disabled until valid",
]) {
  requireText(e2e, state, `shared UI state ${state}`);
}
requireText(e2e, "/errors/403", "direct URL permission fail-closed route");
requireText(
  e2e,
  "FE_CONTROLLED_NOT_QA_UAT",
  "controlled-evidence truth boundary",
);
requireText(e2e, "sourceSha", "exact SHA evidence metadata");
requireText(e2e, "timestamp", "timestamp evidence metadata");
requireText(e2e, "browserProject", "browser evidence metadata");
requireText(e2e, "role", "role evidence metadata");
requireText(e2e, "viewport", "viewport evidence metadata");
requireText(e2e, "login-api-422-retry-safe", "API error/retry scenario");

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

for (const boundary of [
  "FE-controlled",
  "WWHN-272",
  "WWHN-275",
  "Stocktake",
  "P0/P1/P2",
]) {
  requireText(taskDoc, boundary, `task traceability boundary ${boundary}`);
}

if (failures.length > 0) {
  console.error("WWHN-274 closure verification FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("WWHN-274 source-controlled closure contract PASS");
console.log(
  "Truth boundary: FE controlled evidence only; independent QA/UAT/DevOps evidence remains role-owned.",
);
