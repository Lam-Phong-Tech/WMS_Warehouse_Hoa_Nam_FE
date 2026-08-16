#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "fe-base-url": { type: "string" },
    "api-base-url": { type: "string" },
    "expected-fe-sha": { type: "string" },
    "expected-be-sha": { type: "string" },
    "output-dir": { type: "string" },
  },
});

const environment = (values.env ?? process.env.QA_SMOKE_ENV ?? "UNKNOWN").toUpperCase();
const feBaseUrlRaw = values["fe-base-url"] ?? process.env.FE_BASE_URL;
const apiBaseUrlRaw = values["api-base-url"] ?? process.env.API_BASE_URL;
const expectedFeSha = values["expected-fe-sha"] ?? process.env.EXPECTED_FE_SHA ?? "";
const expectedBeSha = values["expected-be-sha"] ?? process.env.EXPECTED_BE_SHA ?? "";
const outputDir = values["output-dir"] ?? process.env.QA_SMOKE_OUTPUT_DIR ?? `test-results/wwhn-157/${environment.toLowerCase()}`;
const timeoutMs = Number(process.env.QA_SMOKE_TIMEOUT_MS ?? 15000);
const requiredHealthFields = ["status", "version", "environment", "server_time", "request_id"];
const fullSha = /^[0-9a-f]{40}$/iu;
let requestCounter = 0;

function timestampPlus7() {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().replace("Z", "+07:00");
}

function normalizeBase(value, label) {
  if (!value) throw new Error(`Missing ${label}.`);
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`${label} must use http or https.`);
  url.username = "";
  url.password = "";
  url.hash = "";
  return url.toString().replace(/\/+$/u, "");
}

function resolveUrl(base, path) {
  return `${base}/${path.replace(/^\/+|\/+$/gu, "")}`;
}

function generatedRequestId(name) {
  requestCounter += 1;
  return `qa1-w157-${environment.toLowerCase()}-${Date.now()}-${requestCounter}-${name.replace(/[^a-z0-9_-]/giu, "-")}`;
}

const sensitiveKey = /(password|secret|token|authorization|cookie|set-cookie|credential)/iu;
const jwtLike = /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/u;

function sanitize(value, key = "") {
  if (sensitiveKey.test(key)) return "<REDACTED>";
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  if (typeof value === "string" && jwtLike.test(value)) return "<REDACTED_JWT>";
  return value;
}

function responseRequestId(response, body) {
  return response.headers.get("x-request-id") ?? body?.request_id ?? body?.meta?.request_id ?? body?.data?.request_id ?? null;
}

async function request(method, url, { headers = {}, body } = {}) {
  const requestId = generatedRequestId(method.toLowerCase());
  const startedAt = Date.now();
  const response = await fetch(url, {
    method,
    headers: { Accept: "application/json", "X-Request-ID": requestId, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let parsedBody = null;
  if (text) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = { nonJsonBodyPreview: text.slice(0, 500) };
    }
  }
  return {
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    sentRequestId: requestId,
    responseRequestId: responseRequestId(response, parsedBody),
    headers: {
      contentType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
      location: response.headers.get("location"),
    },
    body: sanitize(parsedBody),
    rawBody: parsedBody,
  };
}

const plan = {
  schemaVersion: "1.1.0",
  task: "WWHN-157",
  parentTask: "WWHN-32",
  parentTempKey: "HN-DEVOPS-001",
  epicTempKey: "HN-EPIC-03",
  dependency: "HN-DEVOPS-001-ST01",
  role: "QA1",
  assigneePlaceholder: "HN-QA-01",
  environment,
  generatedAt: timestampPlus7(),
  runner: {
    repository: process.env.GITHUB_REPOSITORY ?? null,
    workflowRunId: process.env.GITHUB_RUN_ID ?? null,
    workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    sourceRef: process.env.GITHUB_REF_NAME ?? null,
    runnerCommitSha: process.env.GITHUB_SHA ?? null,
  },
  candidate: {
    expectedFeSha: expectedFeSha || null,
    observedFeSha: null,
    observedFeBuildVersion: null,
    expectedBeSha: expectedBeSha || null,
  },
  endpoints: { feBaseUrl: null, apiBaseUrl: null },
  results: [],
  summary: {},
};

function addResult(name, { pass, required = true, actual, expected, evidence = {}, note = null }) {
  plan.results.push({ name, required, pass: Boolean(pass), timestamp: timestampPlus7(), expected, actual, evidence: sanitize(evidence), note });
}

function httpResult(name, response, { expectedStatus, required = true, extraPass = true, expected, note = null }) {
  addResult(name, {
    pass: response.status === expectedStatus && extraPass,
    required,
    expected: expected ?? `HTTP ${expectedStatus}`,
    actual: `HTTP ${response.status}`,
    note,
    evidence: {
      durationMs: response.durationMs,
      sentRequestId: response.sentRequestId,
      responseRequestId: response.responseRequestId,
      headers: response.headers,
      responseBody: response.body,
    },
  });
}

function createMarkdown() {
  const lines = [
    `# WWHN-157 QA1 Pipeline Smoke — ${environment}`,
    "",
    `- Generated: ${plan.generatedAt}`,
    `- FE URL: ${plan.endpoints.feBaseUrl ?? "MISSING"}`,
    `- API URL: ${plan.endpoints.apiBaseUrl ?? "MISSING"}`,
    `- Expected FE SHA: ${plan.candidate.expectedFeSha ?? "NOT PROVIDED"}`,
    `- Observed FE SHA: ${plan.candidate.observedFeSha ?? "NOT OBSERVED"}`,
    `- Observed FE build: ${plan.candidate.observedFeBuildVersion ?? "NOT OBSERVED"}`,
    `- Expected BE SHA: ${plan.candidate.expectedBeSha ?? "MISSING"}`,
    `- GitHub run: ${plan.runner.workflowRunId ?? "local"}`,
    "",
    "| Case | Required | Result | Expected | Actual | Request ID |",
    "|---|---:|---|---|---|---|",
  ];
  for (const result of plan.results) {
    lines.push(`| ${result.name} | ${result.required ? "Yes" : "No"} | ${result.pass ? "PASS" : "FAIL"} | ${String(result.expected ?? "").replace(/\|/gu, "\\|")} | ${String(result.actual ?? "").replace(/\|/gu, "\\|")} | ${result.evidence?.responseRequestId ?? result.evidence?.sentRequestId ?? "-"} |`);
  }
  lines.push(
    "",
    `**Required PASS:** ${plan.summary.requiredPassed}/${plan.summary.requiredTotal}`,
    `**Required FAIL/BLOCK:** ${plan.summary.requiredFailed}`,
    "",
    "Secrets/tokens/cookies are redacted by the runner. Credentials are referenced only through GitHub Environment secrets.",
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  let feBaseUrl;
  let apiBaseUrl;
  try {
    feBaseUrl = normalizeBase(feBaseUrlRaw, "FE_BASE_URL");
    apiBaseUrl = normalizeBase(apiBaseUrlRaw, "API_BASE_URL");
    plan.endpoints.feBaseUrl = feBaseUrl;
    plan.endpoints.apiBaseUrl = apiBaseUrl;
  } catch (error) {
    addResult("environment-configuration", { pass: false, expected: "Valid FE_BASE_URL and API_BASE_URL", actual: error.message });
    return;
  }

  addResult("be-candidate-binding", {
    pass: fullSha.test(expectedBeSha),
    expected: "Exact deployed BE SHA is supplied as a full 40-char commit SHA",
    actual: expectedBeSha || "MISSING",
    note: "The current public backend health response does not expose commit SHA. Reconcile this value with the exact deploy manifest/Jira/CI evidence; do not infer it from API version.",
  });

  try {
    const loginPage = await request("GET", resolveUrl(feBaseUrl, "/login"), { headers: { Accept: "text/html,application/xhtml+xml" } });
    httpResult("frontend-login-page", loginPage, {
      expectedStatus: 200,
      extraPass: (loginPage.headers.contentType ?? "").includes("text/html"),
      expected: "HTTP 200 and HTML content",
    });
  } catch (error) {
    addResult("frontend-login-page", { pass: false, expected: "HTTP 200 and HTML content", actual: error.message });
  }

  try {
    const feHealth = await request("GET", resolveUrl(feBaseUrl, "/health.json"));
    const oldContract = feHealth.rawBody?.status === "ok" && feHealth.rawBody?.service === "wms-hoa-nam-frontend";
    const runtimeSha = feHealth.rawBody?.source_sha;
    const currentContract = feHealth.rawBody?.success === true && feHealth.rawBody?.service === "wms-hoa-nam-fe" && fullSha.test(runtimeSha ?? "");
    if (fullSha.test(runtimeSha ?? "")) plan.candidate.observedFeSha = runtimeSha;
    if (typeof feHealth.rawBody?.build_version === "string") plan.candidate.observedFeBuildVersion = feHealth.rawBody.build_version;

    httpResult("frontend-health", feHealth, {
      expectedStatus: 200,
      extraPass: oldContract || currentContract,
      expected: "HTTP 200 and recognized FE health contract; current contract includes success=true, service=wms-hoa-nam-fe, full source_sha",
    });

    const observedFeSha = plan.candidate.observedFeSha;
    addResult("fe-candidate-binding", {
      pass: fullSha.test(observedFeSha ?? "") && (!expectedFeSha || observedFeSha.toLowerCase() === expectedFeSha.toLowerCase()),
      expected: expectedFeSha ? `Observed FE source_sha equals ${expectedFeSha}` : "Live FE /health.json exposes a full 40-char source_sha",
      actual: observedFeSha ?? "MISSING",
      evidence: { buildVersion: plan.candidate.observedFeBuildVersion },
      note: expectedFeSha ? "Runtime SHA compared with configured expected deployed SHA." : "Runtime exact SHA captured directly from live FE; reviewer should reconcile it with deployment/CI evidence.",
    });
  } catch (error) {
    addResult("frontend-health", { pass: false, expected: "HTTP 200 recognized FE health JSON", actual: error.message });
    addResult("fe-candidate-binding", { pass: false, expected: "Full runtime FE source_sha", actual: "NOT OBSERVED" });
  }

  try {
    const backendHealth = await request("GET", resolveUrl(apiBaseUrl, "/api/v1/health"));
    const data = backendHealth.rawBody?.data ?? backendHealth.rawBody ?? {};
    const missingFields = requiredHealthFields.filter((field) => data?.[field] === undefined);
    const cacheControl = backendHealth.headers.cacheControl ?? "";
    httpResult("backend-health", backendHealth, {
      expectedStatus: 200,
      extraPass: missingFields.length === 0 && /no-store/iu.test(cacheControl),
      expected: `HTTP 200; fields=${requiredHealthFields.join(",")}; Cache-Control contains no-store`,
      note: missingFields.length > 0 ? `Missing fields: ${missingFields.join(", ")}` : null,
    });

    const healthEnvironment = data?.environment ?? null;
    addResult("backend-health-environment-label", {
      required: false,
      pass: typeof healthEnvironment === "string" && healthEnvironment.toUpperCase() === environment,
      expected: `health.environment=${environment}`,
      actual: `health.environment=${healthEnvironment ?? "MISSING"}`,
      note: "Advisory only. If the runtime profile intentionally reports production on DEV/UAT, DO must provide a formal environment-mapping disposition.",
    });
  } catch (error) {
    addResult("backend-health", { pass: false, expected: "HTTP 200 valid readiness health", actual: error.message });
  }

  try {
    const legacyHealth = await request("GET", resolveUrl(apiBaseUrl, "/api/health"));
    httpResult("legacy-health-disabled", legacyHealth, { expectedStatus: 404 });
  } catch (error) {
    addResult("legacy-health-disabled", { pass: false, expected: "HTTP 404", actual: error.message });
  }

  try {
    const unauthMe = await request("GET", resolveUrl(apiBaseUrl, "/api/v1/auth/me"));
    httpResult("auth-me-without-token", unauthMe, { expectedStatus: 401 });
  } catch (error) {
    addResult("auth-me-without-token", { pass: false, expected: "HTTP 401", actual: error.message });
  }

  try {
    const invalidLogin = await request("POST", resolveUrl(apiBaseUrl, "/api/v1/auth/login"), {
      headers: { "Content-Type": "application/json" },
      body: { email: `qa1-negative-${Date.now()}@example.invalid`, password: "QA1-INTENTIONALLY-INVALID-CREDENTIAL" },
    });
    httpResult("login-invalid-credential", invalidLogin, { expectedStatus: 401 });
  } catch (error) {
    addResult("login-invalid-credential", { pass: false, expected: "HTTP 401", actual: error.message });
  }

  const email = process.env.QA_SMOKE_EMAIL;
  const password = process.env.QA_SMOKE_PASSWORD;
  if (!email || !password) {
    addResult("qa-runtime-credentials", {
      pass: false,
      expected: "QA_SMOKE_EMAIL and QA_SMOKE_PASSWORD injected from GitHub Environment secrets",
      actual: "One or both required secrets are missing",
      note: "Do not place secret values in workflow inputs, source code, Jira comments, or evidence files.",
    });
    return;
  }

  let token = null;
  try {
    const login = await request("POST", resolveUrl(apiBaseUrl, "/api/v1/auth/login"), {
      headers: { "Content-Type": "application/json" },
      body: { email, password },
    });
    token = login.rawBody?.data?.access_token ?? login.rawBody?.access_token ?? null;
    httpResult("login-valid-credential", login, {
      expectedStatus: 200,
      extraPass: typeof token === "string" && token.length > 0,
      expected: "HTTP 200 and access_token present",
    });
  } catch (error) {
    addResult("login-valid-credential", { pass: false, expected: "HTTP 200 and access_token present", actual: error.message });
  }

  if (!token) return;

  const authenticatedCases = [
    ["auth-me", "/api/v1/auth/me"],
    ["master-warehouses", "/api/v1/warehouses?per_page=1"],
    ["master-products", "/api/v1/products?per_page=1"],
    ["master-product-categories", "/api/v1/product-categories?per_page=1"],
    ["master-brands", "/api/v1/brands?per_page=1"],
  ];

  for (const [name, path] of authenticatedCases) {
    try {
      const response = await request("GET", resolveUrl(apiBaseUrl, path), { headers: { Authorization: `Bearer ${token}` } });
      httpResult(name, response, { expectedStatus: 200 });
    } catch (error) {
      addResult(name, { pass: false, expected: "HTTP 200", actual: error.message });
    }
  }
}

try {
  await main();
} catch (error) {
  addResult("runner-unhandled-error", { pass: false, expected: "Runner completes without unhandled exception", actual: error?.message ?? String(error) });
} finally {
  const requiredResults = plan.results.filter((result) => result.required);
  const requiredFailed = requiredResults.filter((result) => !result.pass);
  plan.summary = {
    total: plan.results.length,
    passed: plan.results.filter((result) => result.pass).length,
    failed: plan.results.filter((result) => !result.pass).length,
    requiredTotal: requiredResults.length,
    requiredPassed: requiredResults.length - requiredFailed.length,
    requiredFailed: requiredFailed.length,
    verdict: requiredFailed.length === 0 ? "PASS" : "FAIL_OR_BLOCKED",
  };

  mkdirSync(outputDir, { recursive: true });
  const jsonPath = join(outputDir, `WWHN-157-${environment}-smoke-evidence.json`);
  const markdownPath = join(outputDir, `WWHN-157-${environment}-smoke-summary.md`);
  writeFileSync(jsonPath, `${JSON.stringify(plan, null, 2)}\n`);
  writeFileSync(markdownPath, createMarkdown());
  console.log(`[wwhn-157] ${environment}: ${plan.summary.requiredPassed}/${plan.summary.requiredTotal} required checks passed.`);
  console.log(`[wwhn-157] Evidence: ${jsonPath}`);
  if (plan.summary.requiredFailed > 0) process.exitCode = 1;
}
