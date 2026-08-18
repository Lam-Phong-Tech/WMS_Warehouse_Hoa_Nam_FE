#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "contract-only": { type: "boolean", default: false },
    env: { type: "string" },
    "source-sha": { type: "string" },
    "fe-base-url": { type: "string" },
    "api-base-url": { type: "string" },
    "health-path": { type: "string" },
    "expected-backend-sha": { type: "string" },
    output: { type: "string" },
  },
});

const contractOnly = values["contract-only"];
const environment = values.env ?? process.env.QA_SMOKE_ENV ?? process.env.VITE_APP_ENV ?? "unknown";
const sourceSha = values["source-sha"] ?? process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "unknown";
const feBaseUrl = values["fe-base-url"] ?? process.env.FE_BASE_URL;
const apiBaseUrl = values["api-base-url"] ?? process.env.API_BASE_URL ?? process.env.VITE_API_BASE_URL;
const healthPath = values["health-path"] ?? process.env.VITE_API_HEALTH_PATH ?? "/health";
const timeoutMs = Number(process.env.QA_SMOKE_TIMEOUT_MS ?? 15000);
// WWHN-295/DEV295-P1-02: `build` là danh tính artifact backend đang chạy
// (`data.build.{sha,ref,built_at}`, xem components.schemas.HealthPayload). Thiếu nó
// trong danh sách bắt buộc thì smoke vẫn xanh trên một backend không khai được commit
// nào đang chạy — và mọi gate exact-SHA phía sau lại quay về tin lời khai.
const backendSuccessRequiredFields = ["status", "version", "build", "environment", "server_time", "request_id"];
// DEV295-P1-04/P1-05: buộc bằng chứng QA vào đúng candidate đã pin. Không khai thì chỉ
// cảnh báo (smoke vẫn dùng được lúc dev), khai rồi mà lệch là FAIL.
const expectedBackendSha = (values["expected-backend-sha"] ?? process.env.EXPECTED_BACKEND_SHA ?? "")
  .trim()
  .toLowerCase();
const masterPaths = ["/products", "/product-categories", "/uoms", "/suppliers"];

function normalizeBase(value, label) {
  if (!value) throw new Error(`[wwhn-156-smoke] Missing ${label}.`);
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`[wwhn-156-smoke] ${label} must use http or https.`);
  }
  return value.replace(/\/+$/u, "");
}

function resolveUrl(base, path) {
  return `${normalizeBase(base, "base URL")}/${path.replace(/^\/+|\/+$/gu, "")}`;
}

function sanitizeUrl(value) {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  return url.toString();
}

function requestIdFrom(response, body) {
  return (
    response.headers.get("x-request-id") ??
    body?.request_id ??
    body?.meta?.request_id ??
    body?.data?.request_id ??
    null
  );
}

async function requestJson(method, url, { headers = {}, body } = {}) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    method,
    headers: { Accept: "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let parsedBody = null;
  if (text) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = { nonJsonBodyPreview: text.slice(0, 300) };
    }
  }
  return {
    response,
    body: parsedBody,
    durationMs: Date.now() - startedAt,
  };
}

const normalizedApiBase = normalizeBase(apiBaseUrl, "API_BASE_URL/VITE_API_BASE_URL");
const backendHealthUrl = resolveUrl(normalizedApiBase, healthPath);
const backendHealthPath = new URL(backendHealthUrl).pathname;
if (backendHealthPath !== "/api/v1/health") {
  throw new Error(
    `[wwhn-156-smoke] Backend health must resolve to /api/v1/health, got ${backendHealthPath}. Legacy /api/health requires a versioned waiver.`,
  );
}

const plan = {
  schemaVersion: "1.0.0",
  task: "WWHN-156",
  mode: contractOnly ? "contract-only" : "runtime",
  environment,
  sourceSha,
  generatedAt: new Date().toISOString(),
  contract: {
    frontendHealthPath: "/health.json",
    backendHealthPath,
    backendSuccessRequiredFields,
    expectedBackendSha: expectedBackendSha === "" ? null : expectedBackendSha,
    loginPath: "/auth/login",
    masterPaths,
  },
  results: [],
};

function addResult(name, result) {
  plan.results.push({ name, timestamp: new Date().toISOString(), ...result });
}

if (!contractOnly) {
  const normalizedFeBase = normalizeBase(feBaseUrl, "FE_BASE_URL");
  const email = process.env.QA_SMOKE_EMAIL;
  const password = process.env.QA_SMOKE_PASSWORD;
  if (!email || !password) {
    throw new Error("[wwhn-156-smoke] QA_SMOKE_EMAIL and QA_SMOKE_PASSWORD must be injected through runtime/CI secrets.");
  }

  const feHealthUrl = resolveUrl(normalizedFeBase, "/health.json");
  const feHealth = await requestJson("GET", feHealthUrl);
  addResult("frontend-health", {
    method: "GET",
    url: sanitizeUrl(feHealthUrl),
    status: feHealth.response.status,
    durationMs: feHealth.durationMs,
    requestId: requestIdFrom(feHealth.response, feHealth.body),
    pass:
      feHealth.response.ok &&
      feHealth.body?.status === "ok" &&
      feHealth.body?.service === "wms-hoa-nam-frontend",
  });

  const backendHealth = await requestJson("GET", backendHealthUrl);
  // 200 đặt payload readiness ở `data`; 503 dùng respondError nên payload nằm ở
  // `errors`/`error.details`. Đọc cả hai để báo cáo nói đúng cái backend thực trả.
  const healthPayload =
    backendHealth.body?.data ?? backendHealth.body?.errors ?? backendHealth.body?.error?.details ?? backendHealth.body;
  const missingHealthFields = backendSuccessRequiredFields.filter(
    (field) => backendHealth.body?.[field] === undefined && healthPayload?.[field] === undefined,
  );
  const observedBackendSha = String(healthPayload?.build?.sha ?? "").toLowerCase();
  const shaMatchesCandidate = expectedBackendSha === "" ? null : observedBackendSha.startsWith(expectedBackendSha);
  addResult("backend-health", {
    method: "GET",
    url: sanitizeUrl(backendHealthUrl),
    status: backendHealth.response.status,
    durationMs: backendHealth.durationMs,
    requestId: requestIdFrom(backendHealth.response, backendHealth.body),
    missingRequiredFields: missingHealthFields,
    backendBuild: healthPayload?.build ?? null,
    expectedBackendSha: expectedBackendSha === "" ? null : expectedBackendSha,
    shaMatchesCandidate,
    pass: backendHealth.response.ok && missingHealthFields.length === 0 && shaMatchesCandidate !== false,
  });
  if (shaMatchesCandidate === null) {
    console.warn(
      "[wwhn-156-smoke] WARN: chưa khai --expected-backend-sha/EXPECTED_BACKEND_SHA — bằng chứng không buộc được vào candidate backend nào.",
    );
  }

  const loginUrl = resolveUrl(normalizedApiBase, "/auth/login");
  const login = await requestJson("POST", loginUrl, {
    headers: { "Content-Type": "application/json" },
    body: { email, password },
  });
  const token = login.body?.data?.access_token ?? login.body?.access_token;
  addResult("login", {
    method: "POST",
    url: sanitizeUrl(loginUrl),
    status: login.response.status,
    durationMs: login.durationMs,
    requestId: requestIdFrom(login.response, login.body),
    pass: login.response.ok && typeof token === "string" && token.length > 0,
  });

  if (typeof token === "string" && token.length > 0) {
    for (const path of masterPaths) {
      const url = resolveUrl(normalizedApiBase, path);
      const result = await requestJson("GET", url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      addResult(`master:${path}`, {
        method: "GET",
        url: sanitizeUrl(url),
        status: result.response.status,
        durationMs: result.durationMs,
        requestId: requestIdFrom(result.response, result.body),
        pass: result.response.ok,
      });
    }
  }
}

const safeSource = sourceSha.replace(/[^a-zA-Z0-9._-]/gu, "_");
const safeEnv = environment.replace(/[^a-zA-Z0-9._-]/gu, "_");
const outputPath =
  values.output ??
  join(
    "docs/evidence/wwhn-156/generated",
    `smoke-${contractOnly ? "contract" : "runtime"}-${safeEnv}-${safeSource}.json`,
  );
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`);

const failed = plan.results.filter((result) => !result.pass);
console.log(
  `[wwhn-156-smoke] ${contractOnly ? "CONTRACT PASS" : `${plan.results.length - failed.length}/${plan.results.length} runtime checks passed`}; evidence: ${outputPath}`,
);
if (failed.length > 0) {
  for (const result of failed) console.error(`[wwhn-156-smoke] FAIL ${result.name}: HTTP ${result.status}`);
  process.exit(1);
}
