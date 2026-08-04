#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const envExamplePath = join(root, ".env.example");
const healthPath = join(root, "public", "health.json");

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

const smokeContract = {
  frontendHealthPath: "/health.json",
  backendHealthKey: "VITE_API_HEALTH_PATH",
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
  if (!existsSync(path)) {
    fail(`Missing required file: ${relative(root, path)}`);
  }
  return readFileSync(path, "utf8");
}

function parseEnvExample(content) {
  const env = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    env.set(match[1], value);
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
  if (!["http:", "https:"].includes(parsed.protocol)) {
    fail(`${key} must use http or https.`);
  }
  if (value.endsWith("/")) {
    fail(`${key} must not include a trailing slash.`);
  }
}

function assertNoSecretBaseline(content, env) {
  const forbiddenKeyPattern =
    /(SECRET|PASSWORD|TOKEN|PRIVATE_KEY|CLIENT_SECRET|ACCESS_KEY|API_KEY)/i;
  for (const key of env.keys()) {
    if (forbiddenKeyPattern.test(key)) {
      fail(`${key} is not allowed in .env.example; use CI/runtime secrets.`);
    }
  }

  const suspiciousValuePattern =
    /(bearer\s+[a-z0-9._-]+|eyJ[a-zA-Z0-9_-]+|-----BEGIN|sk-[a-zA-Z0-9_-]+)/i;
  if (suspiciousValuePattern.test(content)) {
    fail(".env.example appears to contain a token or private credential.");
  }
}

function assertEnvExample() {
  const content = readRequiredFile(envExamplePath);
  const env = parseEnvExample(content);

  for (const key of requiredEnvKeys) {
    if (!env.has(key)) fail(`.env.example is missing ${key}.`);
  }

  const envName = env.get("VITE_APP_ENV");
  if (!allowedEnvNames.has(envName)) {
    fail(`VITE_APP_ENV must be one of ${Array.from(allowedEnvNames).join(", ")}.`);
  }

  assertUrl(env.get("VITE_API_BASE_URL"), "VITE_API_BASE_URL");
  assertUrl(env.get("VITE_STORAGE_URL"), "VITE_STORAGE_URL", { allowEmpty: true });

  const healthPathValue = env.get("VITE_API_HEALTH_PATH");
  if (!healthPathValue?.startsWith("/")) {
    fail("VITE_API_HEALTH_PATH must start with /.");
  }

  const timeout = Number(env.get("VITE_API_TIMEOUT_MS"));
  if (!Number.isFinite(timeout) || timeout <= 0) {
    fail("VITE_API_TIMEOUT_MS must be a positive number.");
  }

  for (const key of booleanKeys) {
    if (!["true", "false", "1", "0"].includes(env.get(key))) {
      fail(`${key} must be true, false, 1, or 0.`);
    }
  }

  assertNoSecretBaseline(content, env);
}

function assertHealthContract() {
  const health = JSON.parse(readRequiredFile(healthPath));
  const expected = {
    status: "ok",
    service: "wms-hoa-nam-frontend",
    component: "frontend",
    healthcheck: "static",
  };

  for (const [key, value] of Object.entries(expected)) {
    if (health[key] !== value) {
      fail(`public/health.json ${key} expected ${value}, got ${health[key]}.`);
    }
  }
}

function assertSmokeContract() {
  if (smokeContract.frontendHealthPath !== "/health.json") {
    fail("FE smoke contract must expose /health.json.");
  }
  if (smokeContract.backendHealthKey !== "VITE_API_HEALTH_PATH") {
    fail("Backend health smoke must use VITE_API_HEALTH_PATH.");
  }
  if (smokeContract.loginEndpoint !== "/auth/login") {
    fail("Login smoke endpoint must be /auth/login.");
  }
  if (smokeContract.masterApiSmokePaths.length < 3) {
    fail("Master API smoke must include product/category/reference paths.");
  }
}

assertEnvExample();
assertHealthContract();
assertSmokeContract();

console.log(
  "[env-contract] FE env matrix, static health, secret baseline, and smoke path contract are valid.",
);
