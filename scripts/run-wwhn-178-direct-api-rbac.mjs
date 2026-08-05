#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const contractOnly = args.has("--contract-only");
const sourceSha =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const environment = process.env.WWHN_178_ENV ?? "QA";
const evidenceDir =
  process.env.WWHN_178_EVIDENCE_DIR ??
  join("docs", "evidence", "wwhn-178", "generated", sourceSha);

const baseUrl = (process.env.WWHN_178_API_BASE_URL ?? "").replace(/\/+$/, "");
const deniedToken = process.env.WWHN_178_DENIED_TOKEN ?? "";
const deniedMethod = (process.env.WWHN_178_DENIED_METHOD ?? "POST").toUpperCase();
const deniedPath = process.env.WWHN_178_DENIED_PATH ?? "/products";
const deniedBody = parseJsonEnv(
  "WWHN_178_DENIED_BODY_JSON",
  {
    product_code: "WWHN-178-RBAC-PROBE",
    name: "WWHN-178 direct API authorization probe",
    uom_id: 1,
    list_price_net: 0,
    vat_rate: 0,
    status: "active",
  },
);

const scopeToken = process.env.WWHN_178_SCOPE_DENIED_TOKEN ?? deniedToken;
const scopeMethod = (
  process.env.WWHN_178_SCOPE_DENIED_METHOD ?? "GET"
).toUpperCase();
const scopePath = process.env.WWHN_178_SCOPE_DENIED_PATH ?? "";
const scopeBody = parseJsonEnv("WWHN_178_SCOPE_DENIED_BODY_JSON", undefined);
const expectedCodes = (
  process.env.WWHN_178_EXPECTED_DENY_CODES ??
  "FORBIDDEN,PERMISSION_DENIED,DATA_SCOPE_DENIED"
)
  .split(",")
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);

function parseJsonEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`[wwhn-178-rbac] ${name} is not valid JSON: ${error.message}`);
    process.exit(2);
  }
}

function assertSafeUrl(value) {
  const parsed = new URL(value);
  const localhost = ["127.0.0.1", "localhost"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localhost) {
    throw new Error(
      "WWHN_178_API_BASE_URL must use HTTPS outside localhost/127.0.0.1.",
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

async function executeProbe({ id, method, path, token, body }) {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Evidence-Source": "WWHN-178",
  };
  const startedAt = new Date().toISOString();
  const response = await fetch(url, {
    method,
    headers,
    body:
      method === "GET" || method === "HEAD" || body === undefined
        ? undefined
        : JSON.stringify(body),
    redirect: "manual",
  });
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
    task: "WWHN-178",
    qaTask: "WWHN-179",
    probeId: id,
    result:
      response.status === 403 &&
      (!errorCode || expectedCodes.includes(errorCode))
        ? "PASS"
        : "FAIL",
    sourceSha,
    environment,
    executedAt: startedAt,
    request: {
      method,
      url,
      headers: redactHeaders(headers),
      body,
    },
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
      "This record proves the observed API denial only. QA/BE must confirm the token role, permission catalog and data-scope setup for the named environment.",
  };

  const filename = `${id}.json`;
  writeFileSync(
    join(evidenceDir, filename),
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
    task: "WWHN-178",
    qaTask: "WWHN-179",
    sourceSha,
    environment,
    mode: contractOnly ? "CONTRACT_ONLY" : "LIVE_DIRECT_API",
    requiredSecrets: [
      "WWHN_178_DENIED_TOKEN",
      "WWHN_178_SCOPE_DENIED_TOKEN (optional; defaults to denied token)",
    ],
    probes: [
      {
        id: "permission-deny",
        method: deniedMethod,
        path: deniedPath,
        expectedStatus: 403,
      },
      ...(scopePath
        ? [
            {
              id: "data-scope-deny",
              method: scopeMethod,
              path: scopePath,
              expectedStatus: 403,
            },
          ]
        : []),
    ],
    controls: [
      "No browser/UI path is used",
      "Authorization headers are redacted",
      "HTTP 403 is mandatory",
      "Deny error code is checked when supplied by the backend",
      "Request ID and response payload are retained",
    ],
  };
  writeFileSync(
    join(evidenceDir, "WWHN-178_DIRECT_API_RBAC_PLAN.json"),
    `${JSON.stringify(plan, null, 2)}\n`,
    "utf8",
  );

  if (contractOnly) {
    console.log(
      `[wwhn-178-rbac] PASS contract-only: plan written to ${evidenceDir}`,
    );
    return;
  }

  if (!baseUrl || !deniedToken) {
    throw new Error(
      "Missing WWHN_178_API_BASE_URL or WWHN_178_DENIED_TOKEN for live evidence.",
    );
  }
  assertSafeUrl(baseUrl);

  const records = [];
  records.push(
    await executeProbe({
      id: "permission-deny",
      method: deniedMethod,
      path: deniedPath,
      token: deniedToken,
      body: deniedBody,
    }),
  );

  if (scopePath) {
    records.push(
      await executeProbe({
        id: "data-scope-deny",
        method: scopeMethod,
        path: scopePath,
        token: scopeToken,
        body: scopeBody,
      }),
    );
  }

  const summary = {
    schemaVersion: "1.0.0",
    task: "WWHN-178",
    sourceSha,
    environment,
    result: records.every((record) => record.result === "PASS")
      ? "PASS"
      : "FAIL",
    probes: records.map((record) => ({
      probeId: record.probeId,
      status: record.response.status,
      errorCode: record.response.errorCode,
      requestId: record.response.requestId,
    })),
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(evidenceDir, "WWHN-178_DIRECT_API_RBAC_SUMMARY.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `[wwhn-178-rbac] PASS live direct API evidence: ${records.length} probe(s).`,
  );
}

main().catch((error) => {
  console.error(`[wwhn-178-rbac] FAILED: ${error.message}`);
  process.exit(1);
});
