#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(
  root,
  "docs/evidence/wms-contract-signoff/ci-contract-evidence.json",
);
const runtimeResultPath = join(
  root,
  "docs/evidence/wms-contract-signoff/runtime-evidence.json",
);

const paths = {
  baseline: "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json",
  signoff: "src/shared/api/wms-contract-signoff.ts",
  endpoints: "src/shared/api/endpoints.ts",
  permissions: "src/shared/constants/wms-permissions.ts",
  authPermission: "src/modules/auth/utils/permission.ts",
  routeAccess: "src/app/router/access.ts",
  scanService: "src/modules/scan/services/scanService.ts",
  warrantyService: "src/modules/warranty/services/warrantyService.ts",
  reportsService: "src/modules/reports/services/reportsService.ts",
  tests: "src/test/wms-contract-signoff-guards.test.ts",
  taskDoc: "docs/Task_docs_Jira/WWHN-181.md",
  runtimeTemplate:
    "docs/evidence/wms-contract-signoff/RUNTIME_EVIDENCE_TEMPLATE.md",
};

const failures = [];
const warnings = [];

function full(path) {
  return join(root, path);
}

function fail(message) {
  failures.push(message);
  console.error(`[wms-contract] ERROR: ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`[wms-contract] WARNING: ${message}`);
}

function read(path) {
  const target = full(path);
  if (!existsSync(target)) {
    fail(`Thiếu file bắt buộc: ${path}`);
    return "";
  }
  return readFileSync(target, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requirePattern(content, pattern, label) {
  if (!pattern.test(content)) fail(`${label}: thiếu ${pattern}`);
}

const source = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, read(path)]),
);
if (failures.length) process.exit(1);

let baseline;
try {
  baseline = JSON.parse(source.baseline);
} catch (error) {
  fail(`Baseline JSON không hợp lệ: ${error.message}`);
}
if (failures.length) process.exit(1);

if (baseline.apiBasePath !== "/api/v1") {
  fail(`apiBasePath phải là /api/v1, nhận ${baseline.apiBasePath}`);
}

const criticalEvidence = [];
for (const flow of baseline.criticalFlows ?? []) {
  const constantPattern = new RegExp(
    `${escapeRegExp(flow.endpointConstant)}\\s*:\\s*["']${escapeRegExp(
      flow.endpointPath,
    )}["']`,
  );
  const endpointMatched = constantPattern.test(source.endpoints);
  const permissionMatched = source.permissions.includes(`"${flow.permission}"`);
  const runtimePathMatched = source.tests.includes(flow.runtimePath);
  const pathInTests =
    source.tests.includes(flow.endpointPath) ||
    source.tests.includes(
      flow.endpointPath
        .replace(":id", "IN-1")
        .replace(":sessionId", "ST-1"),
    ) ||
    source.tests.includes(
      flow.endpointPath
        .replace(":id", "OUT-1")
        .replace(":sessionId", "ST-1"),
    );

  if (!endpointMatched) {
    fail(`${flow.id}: endpoint constant không khớp ${flow.endpointPath}`);
  }
  if (!permissionMatched) {
    fail(`${flow.id}: thiếu permission ${flow.permission}`);
  }
  if (!pathInTests) {
    fail(`${flow.id}: thiếu regression test cho endpoint`);
  }
  if (flow.id === "SCAN_CLASSIFY" && !runtimePathMatched) {
    fail("SCAN_CLASSIFY: test phải chứng minh effective URL /api/v1/scan/classify");
  }

  criticalEvidence.push({
    ...flow,
    endpointConstantMatched: endpointMatched,
    permissionCatalogMatched: permissionMatched,
    regressionGuardMatched: pathInTests,
  });
}

requirePattern(
  source.endpoints,
  /SCAN_BATCHES_CLASSIFY:\s*"\/scan\/classify"/,
  "Canonical Scan constant",
);
if (/SCAN_BATCHES_CLASSIFY:\s*"\/api\/v1\//.test(source.endpoints)) {
  fail("Scan endpoint constant không được lặp /api/v1 đã có trong base URL");
}
requirePattern(
  source.scanService,
  /POST \/api\/v1\/scan\/classify at runtime/,
  "Scan runtime contract explanation",
);
requirePattern(
  source.scanService,
  /WMS_FE_INVALID_SCAN_RESPONSE/,
  "Scan response validation",
);

requirePattern(
  source.routeAccess,
  /\[ROUTES\.STOCKTAKE\]:\s*\[P\.STOCKTAKE_COUNT\]/,
  "Stocktake route-entry permission",
);
requirePattern(
  source.routeAccess,
  /\[ROUTES\.REPORTS\]:\s*\[P\.REPORT_VIEW\]/,
  "Reports route-entry permission",
);
if (
  /\[ROUTES\.STOCKTAKE\]:[\s\S]{0,100}STOCKTAKE_ADJUST/.test(
    source.routeAccess,
  )
) {
  fail("stocktake.adjust không được dùng làm route-entry permission");
}
if (/\[ROUTES\.REPORTS\]:[\s\S]{0,100}REPORT_EXPORT/.test(source.routeAccess)) {
  fail("report.export không được dùng làm route-entry permission");
}

for (const token of [
  "stocktake.adjust",
  "warranty.temp_only",
  "scan.inbound",
  "scan.outbound",
  "scan.warranty",
  "report.export",
]) {
  requirePattern(
    source.permissions,
    new RegExp(escapeRegExp(token)),
    `Permission mapping ${token}`,
  );
}
requirePattern(
  source.authPermission,
  /canonicalizeWmsPermission/,
  "Permission alias normalization",
);
requirePattern(
  source.warrantyService,
  /assertTempOnlyPermission/,
  "TEMP_ONLY service guard",
);
requirePattern(
  source.warrantyService,
  /WMS_ACTION_PERMISSIONS\.WARRANTY_TEMP_ONLY/,
  "TEMP_ONLY canonical permission",
);

for (const blockedPath of ["/reports/hub", "/reports/warranty-defects"]) {
  const item = (baseline.reportEndpoints ?? []).find(
    (report) => report.endpointPath === blockedPath,
  );
  if (item?.status !== "blocked_pending_canonical_contract") {
    fail(`${blockedPath}: baseline phải ghi blocked_pending_canonical_contract`);
  }
}
requirePattern(
  source.reportsService,
  /unapprovedReportContract/,
  "Report fail-closed helper",
);
requirePattern(
  source.reportsService,
  /WMS_FE_CONTRACT_NOT_APPROVED/,
  "Report contract error",
);

for (const token of [
  "WWHN-180",
  "WWHN-182",
  "WWHN-183",
  "FE-FINAL-SIGNOFF",
  "BE-CONFIRMATION-EVIDENCE",
  "QA-BA-GATES",
  "RUNTIME-EVIDENCE",
]) {
  requirePattern(source.signoff, new RegExp(token), `Sign-off gate ${token}`);
  requirePattern(source.taskDoc, new RegExp(token), `Task evidence ${token}`);
}
requirePattern(
  source.signoff,
  /finalAllowed:\s*false/,
  "Final sign-off fail-closed",
);
requirePattern(
  source.taskDoc,
  /Không tự nhận QA2 sign-off/i,
  "QA2 evidence boundary",
);
requirePattern(
  source.taskDoc,
  /Không tự nhận BE authorization sign-off/i,
  "BE evidence boundary",
);
requirePattern(
  source.runtimeTemplate,
  /loading, empty, error, success, disabled/i,
  "Runtime UI-state checklist",
);
requirePattern(
  source.runtimeTemplate,
  /\/api\/v1\/scan\/classify/,
  "Runtime Scan capture",
);

const runtimeEvidencePresent = existsSync(runtimeResultPath);
if (!runtimeEvidencePresent) {
  warn(
    "Chưa có runtime-evidence.json của QA2; FE gate pass nhưng final sign-off vẫn bị khóa.",
  );
}
for (const gate of baseline.externalGates ?? []) {
  warn(`${gate.id} (${gate.owner}): ${gate.status}`);
}

const baselineSha256 = createHash("sha256")
  .update(source.baseline)
  .digest("hex")
  .toUpperCase();

const evidence = {
  generatedAt: new Date().toISOString(),
  repository:
    process.env.GITHUB_REPOSITORY ??
    "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  ref: process.env.GITHUB_REF ?? null,
  commitSha: process.env.GITHUB_SHA ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runNumber: process.env.GITHUB_RUN_NUMBER ?? null,
  runnerOs: process.env.RUNNER_OS ?? process.platform,
  node: process.version,
  baseline: {
    path: paths.baseline,
    schemaVersion: baseline.schemaVersion,
    sha256: baselineSha256,
    apiBasePath: baseline.apiBasePath,
  },
  feImplementation: {
    status: failures.length
      ? "failed"
      : "implemented_pending_independent_gates",
    criticalFlows: criticalEvidence,
    reportEndpoints: baseline.reportEndpoints,
    permissionMapping: baseline.permissions,
  },
  finalSignoff: {
    allowed: false,
    status: "conditional_pass_not_final",
    externalGates: baseline.externalGates,
    runtimeEvidencePresent,
  },
  checkedFiles: Object.values(paths).map((path) =>
    relative(root, full(path)).replaceAll("\\", "/"),
  ),
  failures,
  warnings,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(
  `[wms-contract] Evidence: ${relative(root, outputPath).replaceAll("\\", "/")}`,
);

if (failures.length) process.exit(1);
console.log(
  "[wms-contract] PASS: FE canonical mapping, payload guards, RBAC actions, report disposition, tests, and fail-closed final gate are valid.",
);
