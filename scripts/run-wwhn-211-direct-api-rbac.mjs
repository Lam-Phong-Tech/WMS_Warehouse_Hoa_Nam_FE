#!/usr/bin/env node
// WWHN-211 / DEV211-P1-04 — independent BE/QA1 direct API authorization evidence.
//
// UI hide/disable is NOT an authorization control. This harness proves, without
// touching the browser, that the six inventory read/trace endpoints deny a token
// lacking `inventory.view` / `inventory.trace`, and that a data-scope-limited
// token cannot read another scope's rows.
//
// --contract-only runs in CI without secrets: it publishes the executable probe
// plan so QA1/BE can run the exact same probes against a named environment.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const contractOnly = args.has("--contract-only");
const sourceSha =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const environment = process.env.WWHN_211_ENV ?? "QA";
const evidenceDir =
  process.env.WWHN_211_EVIDENCE_DIR ??
  join("docs", "evidence", "WWHN-211", "generated", sourceSha);

const baseUrl = (process.env.WWHN_211_API_BASE_URL ?? "").replace(/\/+$/, "");
const deniedToken = process.env.WWHN_211_DENIED_TOKEN ?? "";
const scopeToken = process.env.WWHN_211_SCOPE_DENIED_TOKEN ?? deniedToken;
const scopePath = process.env.WWHN_211_SCOPE_DENIED_PATH ?? "";

const expectedCodes = (
  process.env.WWHN_211_EXPECTED_DENY_CODES ??
  "FORBIDDEN,PERMISSION_DENIED,DATA_SCOPE_DENIED"
)
  .split(",")
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);

// Mirrors docs/evidence/WWHN-211/fe-contract-lock.json. A probe per endpoint so
// a partial backend guard cannot hide behind one passing route.
const SAMPLE_ID = process.env.WWHN_211_SAMPLE_ID ?? "1";
const READ_TRACE_PROBES = [
  {
    id: "inventory-balances-deny",
    permission: "inventory.view",
    method: "GET",
    path: "/inventory/balances",
  },
  {
    id: "inventory-balance-subledger-deny",
    permission: "inventory.view",
    method: "GET",
    path: `/inventory/balances/${SAMPLE_ID}/subledger`,
  },
  {
    id: "stock-movements-deny",
    permission: "inventory.view",
    method: "GET",
    path: "/stock-movements",
  },
  {
    id: "stock-movement-detail-deny",
    permission: "inventory.view",
    method: "GET",
    path: `/stock-movements/${SAMPLE_ID}`,
  },
  {
    id: "stock-movement-trace-source-deny",
    permission: "inventory.trace",
    method: "GET",
    path: `/stock-movements/${SAMPLE_ID}/trace-source`,
  },
  {
    id: "stock-movement-trace-by-code-deny",
    permission: "inventory.trace",
    method: "GET",
    path: "/stock-movements/trace-by-code?code=WWHN-211-RBAC-PROBE",
  },
];

function assertSafeUrl(value) {
  const parsed = new URL(value);
  const localhost = ["127.0.0.1", "localhost"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localhost) {
    throw new Error(
      "WWHN_211_API_BASE_URL must use HTTPS outside localhost/127.0.0.1.",
    );
  }
}

function redactHeaders(headers) {
  const copy = { ...headers };
  if (copy.Authorization) copy.Authorization = "Bearer ***REDACTED***";
  return copy;
}

function extractErrorCode(body) {
  if (!body || typeof body !== "object") return null;
  const candidates = [
    body.error_code,
    body.code,
    body.error?.code,
    body.errors?.code,
  ];
  return (
    candidates.find((value) => typeof value === "string")?.toUpperCase() ?? null
  );
}

async function executeProbe({ id, permission, method, path, token }) {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Evidence-Source": "WWHN-211",
  };
  const startedAt = new Date().toISOString();
  const response = await fetch(url, { method, headers, redirect: "manual" });
  const raw = await response.text();
  let responseBody;
  try {
    responseBody = raw ? JSON.parse(raw) : null;
  } catch {
    responseBody = { non_json_body: raw.slice(0, 2000) };
  }

  const errorCode = extractErrorCode(responseBody);
  const requestId =
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    responseBody?.meta?.request_id ??
    responseBody?.request_id ??
    null;

  const record = {
    schemaVersion: "1.0.0",
    task: "WWHN-211",
    qaTask: "WWHN-212",
    blocker: "DEV211-P1-04",
    probeId: id,
    requiredPermission: permission,
    result:
      response.status === 403 &&
      (!errorCode || expectedCodes.includes(errorCode))
        ? "PASS"
        : "FAIL",
    sourceSha,
    environment,
    executedAt: startedAt,
    request: { method, url, headers: redactHeaders(headers) },
    response: {
      status: response.status,
      statusText: response.statusText,
      errorCode,
      requestId,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    },
    assertions: {
      directApiRequest: true,
      expectedHttpStatus: 403,
      acceptedErrorCodes: expectedCodes,
      tokenRedacted: true,
      noUiDependency: true,
    },
    evidenceBoundary:
      "Proves the observed API denial only. BE/QA1 must confirm the token role, permission catalog and data-scope setup for the named environment.",
  };

  writeFileSync(
    join(evidenceDir, `${id}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );

  if (record.result !== "PASS") {
    throw new Error(
      `${id} expected HTTP 403 with a deny code; got ${response.status} ${errorCode ?? "NO_ERROR_CODE"}.`,
    );
  }
  return record;
}

async function main() {
  mkdirSync(evidenceDir, { recursive: true });

  const plan = {
    schemaVersion: "1.0.0",
    task: "WWHN-211",
    qaTask: "WWHN-212",
    blocker: "DEV211-P1-04",
    sourceSha,
    environment,
    mode: contractOnly ? "CONTRACT_ONLY" : "LIVE_DIRECT_API",
    requiredSecrets: [
      "WWHN_211_API_BASE_URL",
      "WWHN_211_DENIED_TOKEN",
      "WWHN_211_SCOPE_DENIED_TOKEN (optional; defaults to denied token)",
      "WWHN_211_SCOPE_DENIED_PATH (optional; enables the data-scope probe)",
    ],
    probes: READ_TRACE_PROBES.map((probe) => ({
      id: probe.id,
      method: probe.method,
      path: probe.path,
      requiredPermission: probe.permission,
      expectedStatus: 403,
    })),
    dataScopeProbe: scopePath
      ? { id: "data-scope-deny", method: "GET", path: scopePath, expectedStatus: 403 }
      : "NOT_CONFIGURED — BE/QA1 must supply WWHN_211_SCOPE_DENIED_PATH to close the data-scope half of DEV211-P1-04",
    controls: [
      "No browser/UI path is used — UI hide/disable does not count as authorization evidence",
      "Every one of the six FE-consumed read/trace endpoints is probed independently",
      "Authorization headers are redacted",
      "HTTP 403 is mandatory",
      "Deny error code is checked when supplied by the backend",
      "Request ID and response payload are retained",
    ],
    evidenceBoundary:
      "FE publishes this executable plan only. The signed result must be produced by BE/QA1 against a named environment; FE cannot self-certify backend authorization.",
  };

  writeFileSync(
    join(evidenceDir, "WWHN-211_DIRECT_API_RBAC_PLAN.json"),
    `${JSON.stringify(plan, null, 2)}\n`,
    "utf8",
  );

  if (contractOnly) {
    console.log(
      `[wwhn-211-rbac] PASS contract-only: ${READ_TRACE_PROBES.length} probe plan written to ${evidenceDir}`,
    );
    return;
  }

  if (!baseUrl || !deniedToken) {
    throw new Error(
      "Missing WWHN_211_API_BASE_URL or WWHN_211_DENIED_TOKEN for live evidence.",
    );
  }
  assertSafeUrl(baseUrl);

  const records = [];
  for (const probe of READ_TRACE_PROBES) {
    records.push(await executeProbe({ ...probe, token: deniedToken }));
  }

  if (scopePath) {
    records.push(
      await executeProbe({
        id: "data-scope-deny",
        permission: "inventory.view (out-of-scope row)",
        method: "GET",
        path: scopePath,
        token: scopeToken,
      }),
    );
  }

  const summary = {
    schemaVersion: "1.0.0",
    task: "WWHN-211",
    qaTask: "WWHN-212",
    blocker: "DEV211-P1-04",
    sourceSha,
    environment,
    result: records.every((record) => record.result === "PASS")
      ? "PASS"
      : "FAIL",
    dataScopeProbeExecuted: Boolean(scopePath),
    probes: records.map((record) => ({
      probeId: record.probeId,
      requiredPermission: record.requiredPermission,
      status: record.response.status,
      errorCode: record.response.errorCode,
      requestId: record.response.requestId,
    })),
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(evidenceDir, "WWHN-211_DIRECT_API_RBAC_SUMMARY.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `[wwhn-211-rbac] PASS live direct API evidence: ${records.length} probe(s).`,
  );
}

main().catch((error) => {
  console.error(`[wwhn-211-rbac] FAILED: ${error.message}`);
  process.exit(1);
});
