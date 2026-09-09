#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const envExamplePath = join(root, ".env.example");
const healthPath = join(root, "public", "health.json");
// ĐÃ RÚT theo 3822d45: WWHN-156_CLOSURE_REGISTER.json (docs/evidence) không
// còn trong repo — hợp đồng health canonical/legacy được khoá ngay tại các
// hằng số canonicalBackendHealthPath/legacyBackendHealthPath bên dưới.

const requiredEnvKeys = [
  "VITE_APP_ENV",
  "VITE_APP_TITLE",
  "VITE_APP_VERSION",
  "VITE_API_BASE_URL",
  "VITE_API_HEALTH_PATH",
  "VITE_API_TIMEOUT_MS",
  "VITE_API_WITH_CREDENTIALS",
  "VITE_STORAGE_URL",
  "VITE_ENABLE_ANALYTICS",
  "VITE_ENABLE_DEBUG",
  "VITE_ENABLE_PERF_MONITOR",
];
const allowedEnvNames = new Set(["local", "dev", "uat", "prod", "test"]);
const booleanKeys = [
  "VITE_API_WITH_CREDENTIALS",
  "VITE_ENABLE_ANALYTICS",
  "VITE_ENABLE_DEBUG",
  "VITE_ENABLE_PERF_MONITOR",
];
const canonicalBackendHealthPath = "/api/v1/health";
const legacyBackendHealthPath = "/api/health";
const smokeContract = {
  frontendHealthPath: "/health.json",
  backendHealthRelativePath: "/health",
  loginEndpoint: "/auth/login",
  masterApiSmokePaths: [
    "/products",
    "/product-categories",
    "/uoms",
    "/suppliers",
  ],
};

function fail(message) {
  console.error(`[env-contract] ${message}`);
  process.exit(1);
}

function readRequiredFile(path) {
  if (!existsSync(path)) fail(`Missing required file: ${relative(root, path)}`);
  return readFileSync(path, "utf8");
}

function parseEnv(content) {
  const env = new Map();
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u);
    if (!match) continue;
    env.set(match[1], match[2].trim().replace(/^["']|["']$/gu, ""));
  }
  return env;
}

function assertUrl(value, key, { allowEmpty = false } = {}) {
  if (!value && allowEmpty) return;
  if (!value) fail(`${key} must not be empty.`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    fail(`${key} must be a valid URL: ${error.message}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) fail(`${key} must use http or https.`);
  if (parsed.username || parsed.password) fail(`${key} must not embed credentials.`);
  if (value.endsWith("/")) fail(`${key} must not include a trailing slash.`);
}

function normalizeRelativePath(value, key) {
  if (!value) fail(`${key} must not be empty.`);
  if (/[?#]/u.test(value)) fail(`${key} must not contain query/hash fragments.`);
  return `/${value.replace(/^\/+|\/+$/gu, "")}`;
}

function resolveApiPath(baseUrl, relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath, "VITE_API_HEALTH_PATH");
  return new URL(`${baseUrl.replace(/\/+$/u, "")}${normalizedPath}`).pathname;
}

function assertNoSecretBaseline(content, env) {
  const forbiddenKeyPattern = /(SECRET|PASSWORD|TOKEN|PRIVATE_KEY|CLIENT_SECRET|ACCESS_KEY|API_KEY)/iu;
  for (const key of env.keys()) {
    if (forbiddenKeyPattern.test(key)) {
      fail(`${key} is not allowed in .env.example; use CI/runtime secrets.`);
    }
  }
  const suspiciousValuePattern = /(bearer\s+[a-z0-9._-]+|eyJ[a-zA-Z0-9_-]+|-----BEGIN|sk-[a-zA-Z0-9_-]+)/iu;
  if (suspiciousValuePattern.test(content)) {
    fail(".env.example appears to contain a token or private credential.");
  }
}

function assertEnvironment(env, sourceLabel) {
  for (const key of requiredEnvKeys) {
    if (!env.has(key)) fail(`${sourceLabel} is missing ${key}.`);
  }
  const envName = env.get("VITE_APP_ENV");
  if (!allowedEnvNames.has(envName)) {
    fail(`VITE_APP_ENV must be one of ${Array.from(allowedEnvNames).join(", ")}.`);
  }
  assertUrl(env.get("VITE_API_BASE_URL"), "VITE_API_BASE_URL");
  assertUrl(env.get("VITE_STORAGE_URL"), "VITE_STORAGE_URL", { allowEmpty: true });
  const timeout = Number(env.get("VITE_API_TIMEOUT_MS"));
  if (!Number.isFinite(timeout) || timeout <= 0) fail("VITE_API_TIMEOUT_MS must be a positive number.");
  for (const key of booleanKeys) {
    if (!["true", "false", "1", "0"].includes(env.get(key))) {
      fail(`${key} must be true, false, 1, or 0.`);
    }
  }

  const apiBase = new URL(env.get("VITE_API_BASE_URL"));
  if (apiBase.pathname.replace(/\/+$/u, "") !== "/api/v1") {
    fail(`VITE_API_BASE_URL must end at the versioned /api/v1 base, got ${apiBase.pathname}.`);
  }
  const healthRelativePath = normalizeRelativePath(
    env.get("VITE_API_HEALTH_PATH"),
    "VITE_API_HEALTH_PATH",
  );
  if (healthRelativePath !== smokeContract.backendHealthRelativePath) {
    fail(`VITE_API_HEALTH_PATH must be /health, got ${healthRelativePath}.`);
  }
  const resolvedPath = resolveApiPath(env.get("VITE_API_BASE_URL"), healthRelativePath);
  if (resolvedPath === legacyBackendHealthPath) {
    fail(`${legacyBackendHealthPath} is legacy and rejected without a versioned waiver.`);
  }
  if (resolvedPath !== canonicalBackendHealthPath) {
    fail(`Backend health must resolve to ${canonicalBackendHealthPath}, got ${resolvedPath}.`);
  }
}

const envExampleContent = readRequiredFile(envExamplePath);
const envExample = parseEnv(envExampleContent);
assertEnvironment(envExample, ".env.example");
assertNoSecretBaseline(envExampleContent, envExample);

if (process.env.VITE_API_BASE_URL && process.env.VITE_API_HEALTH_PATH) {
  const runtimeEnv = new Map(envExample);
  for (const key of requiredEnvKeys) {
    if (process.env[key] !== undefined) runtimeEnv.set(key, process.env[key]);
  }
  assertEnvironment(runtimeEnv, "runtime CI environment");
}

const health = JSON.parse(readRequiredFile(healthPath));
const expectedHealth = {
  status: "ok",
  service: "wms-hoa-nam-frontend",
  component: "frontend",
  healthcheck: "static",
};
for (const [key, value] of Object.entries(expectedHealth)) {
  if (health[key] !== value) fail(`public/health.json ${key} expected ${value}, got ${health[key]}.`);
}

// Đối chiếu closure register — ĐÃ RÚT theo 3822d45 (xem chú thích đầu file).
if (smokeContract.frontendHealthPath !== "/health.json") fail("FE smoke contract must expose /health.json.");
if (smokeContract.loginEndpoint !== "/auth/login") fail("Login smoke endpoint must be /auth/login.");
if (smokeContract.masterApiSmokePaths.length < 4) {
  fail("Master API smoke must include product/category/UOM/supplier paths.");
}

console.log(
  `[env-contract] PASS: FE /health.json and versioned backend ${canonicalBackendHealthPath} contracts are locked; ${legacyBackendHealthPath} is rejected.`,
);
