#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(
  root,
  process.env.WMS_EVIDENCE_DIR ??
    "docs/evidence/wms-contract-signoff/generated",
);

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function requirePattern(content, pattern, label) {
  if (!pattern.test(content)) {
    throw new Error(`[wms-contract] Missing ${label}: ${pattern}`);
  }
}

function requireValue(condition, label) {
  if (!condition) throw new Error(`[wms-contract] ${label}`);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

const baselinePath = "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json";
const baselineText = read(baselinePath);
const baseline = JSON.parse(baselineText);
const taskDoc = read("docs/Task_docs_Jira/WWHN-153.md");
const workflow = read(".github/workflows/ci.yml");
const packageJson = JSON.parse(read("package.json"));
const endpoints = read("src/shared/api/endpoints.ts");
const permissions = read("src/shared/constants/wms-permissions.ts");
const permissionHook = read("src/shared/hooks/usePermission.ts");
const permissionCatalog = read("src/shared/api/wms-permission-catalog.ts");
const scan = read("src/modules/scan/services/scanService.ts");
const receiving = read("src/modules/receiving/services/receivingService.ts");
const shipping = read("src/modules/shipping/services/shippingService.ts");
const stocktake = read("src/modules/stocktake/services/stocktakeService.ts");
const reports = read("src/modules/reports/services/reportsService.ts");
const tests = read("src/test/wms-contract-signoff-guards.test.ts");
const signoff = read("src/shared/api/wms-contract-signoff.ts");

const expectedReviewIds = [
  "BA-FE-P0-01",
  "BA-FE-P0-02",
  "BA-FE-P1-01",
  "BA-FE-P1-02",
  "BA-FE-P1-03",
  "BA-FE-P1-04",
  "BA-FE-P1-05",
  "BA-FE-P2-01",
  "BA-FE-P2-02",
];
const actualReviewIds = baseline.reviewClosureMatrix.map((item) => item.id);
requireValue(
  JSON.stringify(actualReviewIds) === JSON.stringify(expectedReviewIds),
  "review closure matrix IDs/order do not match the 72/100 assessment",
);
for (const id of expectedReviewIds) {
  requirePattern(taskDoc, new RegExp(id), `WWHN-153 matrix row ${id}`);
}

requireValue(baseline.task === "WWHN-153", "baseline task must be WWHN-153");
requireValue(
  baseline.officialContract.status === "PENDING_BE1_BE2_QA1_CLOSURE",
  "official WWHN-31 status must remain fail-closed",
);
requireValue(
  baseline.officialContract.sha256 === null &&
    baseline.officialContract.version === null,
  "FE must not fabricate official WWHN-31 version/hash",
);
requireValue(
  baseline.criticalFlows.length === 4,
  "critical flow matrix must contain exactly four reviewed flows",
);

const expectedPaths = {
  SCAN_CLASSIFY: "/scan/classify",
  POST_RECEIPT: "/inbound-documents/:id/post-receipt",
  POST_ISSUE: "/outbound-documents/:id/post-issue",
  APPLY_ADJUSTMENT: "/stocktake/sessions/:sessionId/apply-adjustment",
};
for (const flow of baseline.criticalFlows) {
  requireValue(
    flow.relativePath === expectedPaths[flow.id],
    `${flow.id} relative path does not match canonical FE mapping`,
  );
  requireValue(
    flow.officialSignoff === "PENDING_BE_BA_QA",
    `${flow.id} must not self-sign official contract evidence`,
  );
}

requirePattern(endpoints, /SCAN_BATCHES_CLASSIFY:\s*"\/scan\/classify"/u, "scan endpoint");
requirePattern(endpoints, /INBOUND_POST_RECEIPT:\s*"\/inbound-documents\/:id\/post-receipt"/u, "post receipt endpoint");
requirePattern(endpoints, /OUTBOUND_POST_ISSUE:\s*"\/outbound-documents\/:id\/post-issue"/u, "post issue endpoint");
requirePattern(endpoints, /STOCKTAKE_APPLY_ADJUSTMENT:\s*"\/stocktake\/sessions\/:sessionId\/apply-adjustment"/u, "apply adjustment endpoint");

for (const code of [
  "scan.classify",
  "inbound.post",
  "outbound.post",
  "stocktake.adjust",
  "report.export",
  "warranty.temp_only",
]) {
  requirePattern(permissions, new RegExp(code.replace(".", "\\.")), `permission ${code}`);
}
requirePattern(
  permissionHook,
  /resolveWmsPermissionAlternatives\(codes\)/u,
  "fail-closed useCanAny alternatives",
);
requirePattern(
  permissions,
  /canonical\.filter\(\(code\) => code !== "stocktake\.manage"\)/u,
  "stocktake.manage must not authorize stocktake.adjust",
);
requirePattern(permissionCatalog, /API_ENDPOINTS\.PERMISSIONS/u, "runtime /permissions fetch");
requirePattern(permissionCatalog, /missingCanonicalCodes/u, "runtime catalog reconciliation");

for (const [content, label, permission] of [
  [scan, "scan", "SCAN_CLASSIFY_GENERIC"],
  [receiving, "post receipt", "POST_RECEIPT"],
  [shipping, "post issue", "POST_ISSUE"],
  [stocktake, "apply adjustment", "APPLY_STOCKTAKE_ADJUSTMENT"],
  [reports, "report export", "EXPORT_REPORT"],
]) {
  requirePattern(content, /assertWmsActionPermission/u, `${label} service guard`);
  requirePattern(content, new RegExp(permission), `${label} action permission`);
}

requirePattern(receiving, /requireUniqueStrings/u, "receipt duplicate-line guard");
requirePattern(receiving, /movementRef/u, "receipt movement evidence");
requirePattern(receiving, /requestId/u, "receipt request evidence");
requirePattern(shipping, /requireUniqueStrings/u, "issue duplicate-line guard");
requirePattern(shipping, /movementRef/u, "issue movement evidence");
requirePattern(shipping, /requestId/u, "issue request evidence");
requirePattern(stocktake, /WMS_FE_MISSING_ADJUSTMENT_EVIDENCE/u, "adjustment evidence guard");
requirePattern(stocktake, /movement_ref/u, "adjustment movement evidence");
requirePattern(stocktake, /request_id/u, "adjustment request evidence");
requirePattern(scan, /unexpected code\(s\)/u, "scan exact code-set response guard");

requireValue(
  packageJson.scripts.typecheck === "tsc -b --pretty false",
  "dedicated typecheck script is required",
);
requireValue(
  packageJson.scripts["test:e2e:evidence"] !== undefined,
  "dedicated Playwright evidence script is required",
);
requireValue(
  packageJson.scripts["wms-evidence:collect"] !== undefined,
  "evidence collector script is required",
);
requirePattern(workflow, /Check formatting without mutating source/u, "read-only format step");
requireValue(
  !/run:\s*npm run format\s*$/mu.test(workflow),
  "CI must not run a source-mutating format command",
);
requirePattern(workflow, /npm run typecheck/u, "CI typecheck gate");
requirePattern(workflow, /npm run test:e2e:evidence/u, "CI Playwright evidence gate");
requirePattern(workflow, /SOURCE_SHA/u, "source SHA trace");
requirePattern(workflow, /EXECUTION_SHA/u, "execution/merge SHA trace");
requirePattern(workflow, /wms-fe-closure-evidence/u, "closure artifact");

requirePattern(signoff, /finalAllowed:\s*false/u, "final sign-off fail-closed");
requirePattern(signoff, /WWHN-31/u, "official contract external gate");
for (const id of ["WWHN-150", "WWHN-151", "WWHN-152", "WWHN-180", "WWHN-182", "WWHN-183"]) {
  requirePattern(signoff, new RegExp(id), `external gate ${id}`);
}

for (const phrase of [
  "blocks sensitive service calls without action permission",
  "rejects duplicate receipt and issue lines",
  "rejects incomplete adjustment success evidence",
  "reconciles runtime permission catalog",
  "keeps final sign-off blocked",
]) {
  requirePattern(tests, new RegExp(phrase), `regression test: ${phrase}`);
}

const evidence = {
  schemaVersion: "2.0.0",
  generatedAt: new Date().toISOString(),
  sourceSha: process.env.WMS_SOURCE_SHA ?? process.env.GITHUB_SHA ?? null,
  executionSha: process.env.WMS_EXECUTION_SHA ?? process.env.GITHUB_SHA ?? null,
  baseline: {
    path: baselinePath,
    sha256: sha256(baselineText),
    officialContractStatus: baseline.officialContract.status,
  },
  reviewClosure: baseline.reviewClosureMatrix,
  criticalFlows: baseline.criticalFlows.map((flow) => ({
    id: flow.id,
    relativePath: flow.relativePath,
    feDisposition: flow.feDisposition,
    officialSignoff: flow.officialSignoff,
  })),
  automatedChecks: {
    exactReviewMatrix: true,
    canonicalEndpoints: true,
    servicePermissionGuards: true,
    requestValidation: true,
    successEvidenceValidation: true,
    runtimePermissionReconciliation: true,
    readOnlyFormatGate: true,
    typecheckGate: true,
    playwrightEvidenceGate: true,
    finalSignoffFailClosed: true,
  },
  boundary:
    "FE automated remediation is complete; official BE, QA1, QA2 and BA evidence is intentionally not self-signed.",
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "contract-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

if (!existsSync(join(outputDir, "runtime-manifest.json"))) {
  console.warn(
    "[wms-contract] Runtime manifest is produced later in CI after build/Playwright; final cross-role sign-off remains blocked.",
  );
}
console.log(
  "[wms-contract] PASS: all FE-owned P0/P1/P2 guards and closure trace are enforced; independent WWHN-31/QA/BA gates remain fail-closed.",
);
