#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const swaggerPath = join(root, "swagger-api.json");
const signoffPath = join(root, "src/shared/api/wms-contract-signoff.ts");
const endpointsPath = join(root, "src/shared/api/endpoints.ts");
const permissionsPath = join(root, "src/shared/constants/wms-permissions.ts");
const routeAccessPath = join(root, "src/app/router/access.ts");
const guardTestPath = join(root, "src/test/wms-contract-signoff-guards.test.ts");
const outputPath = join(
  root,
  "docs/evidence/wms-contract-signoff/ci-contract-evidence.json",
);

const requiredFiles = [
  swaggerPath,
  signoffPath,
  endpointsPath,
  permissionsPath,
  routeAccessPath,
  guardTestPath,
];

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
  console.error(`[wms-contract] ERROR: ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`[wms-contract] WARNING: ${message}`);
}

for (const path of requiredFiles) {
  if (!existsSync(path)) fail(`Thiếu file bắt buộc: ${path.replace(`${root}/`, "")}`);
}

if (failures.length > 0) process.exit(1);

const swaggerBytes = readFileSync(swaggerPath);
const swaggerText = swaggerBytes.toString("utf8");
const swagger = JSON.parse(swaggerText);
const signoff = readFileSync(signoffPath, "utf8");
const endpoints = readFileSync(endpointsPath, "utf8");
const permissions = readFileSync(permissionsPath, "utf8");
const routeAccess = readFileSync(routeAccessPath, "utf8");
const guardTests = readFileSync(guardTestPath, "utf8");
const sha256 = createHash("sha256").update(swaggerBytes).digest("hex").toUpperCase();

const declaredHash = signoff.match(/sha256:\s*\n?\s*"([A-Fa-f0-9]{64})"/)?.[1]?.toUpperCase();
if (!declaredHash) fail("Không đọc được SHA256 OpenAPI snapshot từ wms-contract-signoff.ts.");
else if (declaredHash !== sha256) {
  fail(`OpenAPI snapshot bị drift: khai báo ${declaredHash}, thực tế ${sha256}.`);
}

if (swagger.openapi !== "3.0.0") {
  fail(`OpenAPI version không đúng baseline 3.0.0: ${swagger.openapi ?? "missing"}.`);
}

const criticalFlows = [
  {
    id: "SCAN_CLASSIFY",
    method: "post",
    path: "/scan-batches/classify",
    endpointConstant: "SCAN_BATCHES_CLASSIFY",
    permission: "scan.classify",
    contractRequired: true,
  },
  {
    id: "POST_RECEIPT",
    method: "post",
    path: "/inbound-documents/{id}/post-receipt",
    endpointConstant: "INBOUND_POST_RECEIPT",
    permission: "inbound.post",
    contractRequired: true,
  },
  {
    id: "POST_ISSUE",
    method: "post",
    path: "/outbound-documents/{id}/post-issue",
    endpointConstant: "OUTBOUND_POST_ISSUE",
    permission: "outbound.post",
    contractRequired: true,
  },
  {
    id: "APPLY_ADJUSTMENT",
    method: "post",
    path: "/stocktake/sessions/{sessionId}/apply-adjustment",
    endpointConstant: "STOCKTAKE_APPLY_ADJUSTMENT",
    permission: "stocktake.adjust",
    contractRequired: true,
  },
];

const flowEvidence = criticalFlows.map((flow) => {
  const swaggerOperation = swagger.paths?.[flow.path]?.[flow.method];
  const constantPattern = new RegExp(
    `${flow.endpointConstant}\\s*:\\s*["']${flow.path.replaceAll("{id}", ":id").replaceAll("{sessionId}", ":sessionId")}["']`,
  );
  const constantMatched = constantPattern.test(endpoints);
  const permissionMatched = permissions.includes(`"${flow.permission}"`);
  const testMatched = guardTests.includes(flow.path.replaceAll("{id}", "IN-1").replaceAll("{sessionId}", "ST-1")) ||
    guardTests.includes(flow.path.replaceAll("{id}", "OUT-1").replaceAll("{sessionId}", "ST-1")) ||
    guardTests.includes(flow.path);

  if (!swaggerOperation) {
    fail(`${flow.id}: thiếu ${flow.method.toUpperCase()} ${flow.path} trong swagger-api.json.`);
  }
  if (!constantMatched) fail(`${flow.id}: endpoint constant không khớp contract.`);
  if (!permissionMatched) fail(`${flow.id}: permission ${flow.permission} chưa có trong catalog FE.`);
  if (!testMatched) fail(`${flow.id}: chưa có regression evidence trong wms-contract-signoff-guards.test.ts.`);

  return {
    ...flow,
    swaggerPresent: Boolean(swaggerOperation),
    operationId: swaggerOperation?.operationId ?? null,
    endpointConstantMatched: constantMatched,
    permissionCatalogMatched: permissionMatched,
    regressionGuardMatched: testMatched,
  };
});

const requiredGateTokens = [
  "WWHN-31",
  "FE-FINAL-SIGNOFF",
  "WWHN-150-WWHN-151",
  "ROUTE_PERMISSIONS",
  "STOCK_CHANGING_CRITICAL_FLOWS",
  "BE-CONFIRMATION-EVIDENCE",
  "QA-BA-GATES",
  "RUNTIME-EVIDENCE",
];
for (const token of requiredGateTokens) {
  if (!signoff.includes(token)) fail(`Thiếu contract gate ${token}.`);
}

if (!/finalAllowed:\s*false/.test(signoff)) {
  fail("FE final sign-off phải fail-closed khi chưa có gate BE/BA/QA độc lập.");
}
if (!routeAccess.includes("backend still owns RBAC")) {
  fail("ROUTE_PERMISSIONS phải ghi rõ backend là nguồn enforcement RBAC.");
}

const runtimeCatalogPresent = existsSync(
  join(root, ".agent-cache/permission-catalog-live.json"),
);
if (!runtimeCatalogPresent) {
  warn("Không có permission catalog runtime cache; mapping FE vẫn là UX gate và chưa đủ final sign-off.");
}

const evidence = {
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY ?? "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  ref: process.env.GITHUB_REF ?? null,
  commitSha: process.env.GITHUB_SHA ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runNumber: process.env.GITHUB_RUN_NUMBER ?? null,
  runnerOs: process.env.RUNNER_OS ?? process.platform,
  node: process.version,
  openapi: {
    source: "swagger-api.json",
    version: swagger.openapi,
    infoVersion: swagger.info?.version ?? null,
    sha256,
    declaredHash,
    pathCount: Object.keys(swagger.paths ?? {}).length,
  },
  finalSignoff: {
    allowed: false,
    status: "conditional_pass_not_final",
    reason:
      "FE code guards can pass, but official BE contract plus independent QA/BA evidence remain mandatory.",
  },
  permissionCatalog: {
    runtimeEvidencePresent: runtimeCatalogPresent,
    routePermissionsAreUxGateOnly: true,
  },
  criticalFlows: flowEvidence,
  failures,
  warnings,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`[wms-contract] Evidence: ${outputPath.replace(`${root}/`, "")}`);

if (failures.length > 0) process.exit(1);
console.log("[wms-contract] PASS: hash, endpoint, permission, regression và fail-closed gates hợp lệ.");
