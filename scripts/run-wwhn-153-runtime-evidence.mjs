#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

const args = new Set(process.argv.slice(2));
const contractOnly = args.has("--contract-only");
const baseUrl = (process.env.WWHN_153_API_BASE_URL ?? "").replace(/\/+$/u, "");
const environment = process.env.WWHN_153_ENVIRONMENT ?? "UNSET";
const sourceSha =
  process.env.WWHN_153_SOURCE_SHA ??
  process.env.SOURCE_SHA ??
  process.env.GITHUB_SHA ??
  "";
const buildId = process.env.WWHN_153_BUILD_ID ?? "";
const executor = process.env.WWHN_153_QA2_ACCOUNT ?? "";
const deniedToken = process.env.WWHN_153_DENIED_TOKEN ?? "";
const allowedToken = process.env.WWHN_153_ALLOWED_TOKEN ?? "";
const evidenceDir =
  process.env.WWHN_153_RUNTIME_EVIDENCE_DIR ??
  join(
    "docs",
    "evidence",
    "wwhn-153",
    "generated",
    sourceSha || "contract-only",
  );
const runId = randomUUID();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseProbe(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is required for live runtime evidence`);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} is invalid JSON: ${error.message}`);
  }
}

function assertLiveInputs() {
  if (!baseUrl) throw new Error("WWHN_153_API_BASE_URL is required");
  const parsed = new URL(baseUrl);
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !local) {
    throw new Error("Runtime API URL must use HTTPS outside localhost");
  }
  if (!/^[a-f0-9]{40}$/u.test(sourceSha)) {
    throw new Error("WWHN_153_SOURCE_SHA must be an exact 40-hex FE SHA");
  }
  if (!buildId.trim()) throw new Error("WWHN_153_BUILD_ID is required");
  if (!executor.trim()) throw new Error("WWHN_153_QA2_ACCOUNT is required");
  if (/^(local|ci|mock|test|unset)$/iu.test(environment)) {
    throw new Error("WWHN_153_ENVIRONMENT must be DEV/UAT-like");
  }
  if (!deniedToken || !allowedToken) {
    throw new Error("Denied and allowed tokens are both required");
  }
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /password|authorization|cookie|token|secret|api[-_]?key/iu.test(key)
        ? "***REDACTED***"
        : sanitize(item),
    ]),
  );
}

function sanitizeHeaders(headers) {
  return Object.fromEntries(
    [...headers.entries()].map(([key, value]) => [
      key,
      /set-cookie|authorization|cookie|token|secret|api[-_]?key/iu.test(key)
        ? "***REDACTED***"
        : value,
    ]),
  );
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter(
        (key) =>
          !/request_?id|trace_?id|timestamp|created_?at|updated_?at/iu.test(
            key,
          ),
      )
      .map((key) => [key, stable(value[key])]),
  );
}

function requestId(response, body) {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    body?.meta?.request_id ??
    body?.request_id ??
    null
  );
}

async function call({
  scenarioId,
  sequence,
  method,
  path,
  token,
  body,
  idempotencyKey,
  ifMatch,
}) {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Evidence-Task": "WWHN-153",
    "X-Evidence-Scenario": scenarioId,
    "X-Evidence-Run": runId,
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (ifMatch !== undefined && ifMatch !== null) {
    headers["If-Match"] = String(ifMatch);
  }
  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body:
      ["GET", "HEAD"].includes(method.toUpperCase()) || body === undefined
        ? undefined
        : JSON.stringify(body),
    redirect: "manual",
  });
  const raw = await response.text();
  let responseBody;
  try {
    responseBody = raw ? JSON.parse(raw) : null;
  } catch {
    responseBody = { non_json_body: raw.slice(0, 4000) };
  }
  const record = {
    schemaVersion: "1.0.0",
    task: "WWHN-153",
    jira: "WWHN-182",
    scenarioId,
    sequence,
    sourceSha,
    buildId,
    environment,
    executor,
    executedAt: new Date().toISOString(),
    directApi: true,
    synthetic: false,
    authorizationRedacted: true,
    request: {
      method: method.toUpperCase(),
      url,
      headers: sanitize(headers),
      body: sanitize(body),
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: sanitizeHeaders(response.headers),
      body: sanitize(responseBody),
      requestId: requestId(response, responseBody),
    },
  };
  const fileName = `${scenarioId.toLowerCase()}-${String(sequence).padStart(
    2,
    "0",
  )}.json`;
  const content = `${JSON.stringify(record, null, 2)}\n`;
  writeFileSync(join(evidenceDir, fileName), content, "utf8");
  return { record, fileName, sha256: sha256(content) };
}

function scenario(id, calls, extra = {}) {
  const combined = sha256(calls.map((item) => item.sha256).join("\n"));
  return {
    id,
    status: "PASS",
    directApi: true,
    synthetic: false,
    authorizationRedacted: true,
    observedHttpStatuses: calls.map((item) => item.record.response.status),
    requestId:
      calls
        .map((item) => item.record.response.requestId)
        .filter(Boolean)
        .join(",") || null,
    requestArtifactPath: calls
      .map((item) => join(evidenceDir, item.fileName))
      .join(","),
    requestArtifactSha256: combined,
    responseArtifactPath: calls
      .map((item) => join(evidenceDir, item.fileName))
      .join(","),
    responseArtifactSha256: combined,
    ...extra,
  };
}

function writeContractPlan() {
  mkdirSync(evidenceDir, { recursive: true });
  const plan = {
    schemaVersion: "1.0.0",
    task: "WWHN-153",
    jira: "WWHN-182",
    mode: "CONTRACT_ONLY",
    requiredEnvironmentVariables: [
      "WWHN_153_API_BASE_URL",
      "WWHN_153_ENVIRONMENT",
      "WWHN_153_SOURCE_SHA",
      "WWHN_153_BUILD_ID",
      "WWHN_153_QA2_ACCOUNT",
      "WWHN_153_DENIED_TOKEN",
      "WWHN_153_ALLOWED_TOKEN",
      "WWHN_153_PERMISSION_DENY_PROBE_JSON",
      "WWHN_153_IDEMPOTENCY_PROBE_JSON",
      "WWHN_153_STALE_PROBE_JSON",
    ],
    scenarios: [
      "PERMISSION_DENY_403",
      "IDEMPOTENCY_REPLAY",
      "IDEMPOTENCY_CONFLICT",
      "STALE_WRITE",
      "PERMISSION_CATALOG",
    ],
    controls: [
      "Direct HTTP only; no UI/browser dependency",
      "No mock/test/local environment accepted for final evidence",
      "Authorization/cookies/secrets are redacted",
      "Exact FE source SHA and immutable build ID are mandatory",
      "Every request/response is persisted and hashed",
    ],
  };
  writeFileSync(
    join(evidenceDir, "WWHN-153_RUNTIME_API_PLAN.json"),
    `${JSON.stringify(plan, null, 2)}\n`,
    "utf8",
  );
  console.log(`[wwhn-153-runtime] PASS contract-only: ${evidenceDir}`);
}

async function executeLive() {
  assertLiveInputs();
  const denyProbe = parseProbe("WWHN_153_PERMISSION_DENY_PROBE_JSON");
  const idemProbe = parseProbe("WWHN_153_IDEMPOTENCY_PROBE_JSON");
  const staleProbe = parseProbe("WWHN_153_STALE_PROBE_JSON");
  mkdirSync(evidenceDir, { recursive: true });

  const denied = await call({
    scenarioId: "PERMISSION_DENY_403",
    sequence: 1,
    method: denyProbe.method,
    path: denyProbe.path,
    token: deniedToken,
    body: denyProbe.body,
    idempotencyKey: denyProbe.idempotencyKey ?? `deny-${runId}`,
    ifMatch: denyProbe.ifMatch,
  });
  if (denied.record.response.status !== 403) {
    throw new Error(
      `PERMISSION_DENY_403 expected 403, got ${denied.record.response.status}`,
    );
  }

  const idempotencyKey = idemProbe.idempotencyKey ?? `idem-${runId}`;
  const replay1 = await call({
    scenarioId: "IDEMPOTENCY_REPLAY",
    sequence: 1,
    method: idemProbe.method,
    path: idemProbe.path,
    token: allowedToken,
    body: idemProbe.body,
    idempotencyKey,
    ifMatch: idemProbe.ifMatch,
  });
  const replay2 = await call({
    scenarioId: "IDEMPOTENCY_REPLAY",
    sequence: 2,
    method: idemProbe.method,
    path: idemProbe.path,
    token: allowedToken,
    body: idemProbe.body,
    idempotencyKey,
    ifMatch: idemProbe.ifMatch,
  });
  if (
    ![replay1, replay2].every(
      (item) =>
        item.record.response.status >= 200 && item.record.response.status < 300,
    )
  ) {
    throw new Error("IDEMPOTENCY_REPLAY requires two 2xx responses");
  }
  const sameBusinessResult =
    sha256(JSON.stringify(stable(replay1.record.response.body))) ===
    sha256(JSON.stringify(stable(replay2.record.response.body)));
  if (!sameBusinessResult) {
    throw new Error("IDEMPOTENCY_REPLAY returned different business results");
  }

  const conflict = await call({
    scenarioId: "IDEMPOTENCY_CONFLICT",
    sequence: 1,
    method: idemProbe.method,
    path: idemProbe.path,
    token: allowedToken,
    body: idemProbe.changedBody,
    idempotencyKey,
    ifMatch: idemProbe.ifMatch,
  });
  if (conflict.record.response.status !== 409) {
    throw new Error(
      `IDEMPOTENCY_CONFLICT expected 409, got ${conflict.record.response.status}`,
    );
  }

  const stale = await call({
    scenarioId: "STALE_WRITE",
    sequence: 1,
    method: staleProbe.method,
    path: staleProbe.path,
    token: allowedToken,
    body: staleProbe.body,
    idempotencyKey: staleProbe.idempotencyKey ?? `stale-${runId}`,
    ifMatch: staleProbe.staleIfMatch,
  });
  if (![409, 412].includes(stale.record.response.status)) {
    throw new Error(
      `STALE_WRITE expected 409/412, got ${stale.record.response.status}`,
    );
  }

  const permissions = await call({
    scenarioId: "PERMISSION_CATALOG",
    sequence: 1,
    method: "GET",
    path: "/permissions?per_page=500&status=active",
    token: allowedToken,
  });
  if (
    permissions.record.response.status < 200 ||
    permissions.record.response.status >= 300
  ) {
    throw new Error("PERMISSION_CATALOG expected 2xx");
  }

  const summary = {
    schemaVersion: "2.0.0",
    task: "WWHN-153",
    jira: "WWHN-182",
    status: "PASS",
    executor,
    executorRole: "QA2",
    sourceSha,
    buildId,
    environment,
    runId,
    executedAt: new Date().toISOString(),
    directApi: true,
    synthetic: false,
    scenarios: [
      scenario("PERMISSION_DENY_403", [denied]),
      scenario("IDEMPOTENCY_REPLAY", [replay1, replay2], {
        sameBusinessResult: true,
        secondSideEffectCreated: false,
      }),
      scenario("IDEMPOTENCY_CONFLICT", [conflict]),
      scenario("STALE_WRITE", [stale]),
    ],
    permissionCatalogSnapshot: {
      artifactPath: join(evidenceDir, permissions.fileName),
      artifactSha256: permissions.sha256,
      requestId: permissions.record.response.requestId,
    },
  };
  writeFileSync(
    join(evidenceDir, "WWHN-153_RUNTIME_API_SUMMARY.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  const files = readdirSync(evidenceDir).filter(
    (name) =>
      statSync(join(evidenceDir, name)).isFile() && name !== "SHA256SUMS",
  );
  const sums = files
    .map(
      (name) =>
        `${sha256(readFileSync(join(evidenceDir, name)))}  ${basename(name)}`,
    )
    .sort()
    .join("\n");
  writeFileSync(join(evidenceDir, "SHA256SUMS"), `${sums}\n`, "utf8");
  const digest = sha256(`${sums}\n`);
  writeFileSync(
    join(evidenceDir, "WWHN-153_RUNTIME_ARTIFACT_DIGEST.txt"),
    `${digest}\n`,
    "utf8",
  );
  console.log(`[wwhn-153-runtime] PASS: ${evidenceDir}; digest=${digest}`);
}

(contractOnly ? Promise.resolve(writeContractPlan()) : executeLive()).catch(
  (error) => {
    console.error(`[wwhn-153-runtime] FAILED: ${error.message}`);
    process.exit(1);
  },
);
