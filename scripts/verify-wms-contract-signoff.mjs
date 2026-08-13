#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(
  root,
  process.env.WMS_EVIDENCE_DIR ??
    "docs/evidence/wms-contract-signoff/generated",
);

function read(file) {
  return readFileSync(join(root, file), "utf8");
}
function requirePattern(content, pattern, label) {
  if (!pattern.test(content))
    throw new Error(`[wms-contract] Missing ${label}: ${pattern}`);
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
const taskDoc = read("docs/Task_docs_Jira/WWHN-181.md");
const ciWorkflow = read(".github/workflows/ci.yml");
const wwhn181Workflow = read(".github/workflows/wwhn-181-signoff.yml");
const packageJson = JSON.parse(read("package.json"));
const endpoints = read("src/shared/api/endpoints.ts");
const http = read("src/shared/api/http.ts");
const permissions = read("src/shared/constants/wms-permissions.ts");
const permissionHook = read("src/shared/hooks/usePermission.ts");
const permissionCatalog = read("src/shared/api/wms-permission-catalog.ts");
const scan = read("src/modules/scan/services/scanService.ts");
const receivingShim = read(
  "src/modules/receiving/services/receivingService.ts",
);
requirePattern(
  receivingShim,
  /export \* from "@\/modules\/inbound\/services\/inboundService"/u,
  "receiving legacy shim must re-export the active inbound service",
);
const receiving = read("src/modules/inbound/services/inboundService.ts");
const shipping = read("src/modules/shipping/services/shippingService.ts");
const stocktake = read("src/modules/stocktake/services/stocktakeService.ts");
const warranty = read("src/modules/warranty/services/warrantyService.ts");
const componentIssue = read(
  "src/modules/warranty/services/componentIssueService.ts",
);
const reports = read("src/modules/reports/services/reportsService.ts");
const tests = read("src/test/wms-contract-signoff-guards.test.ts");
const warrantyTests = read("src/test/warranty-v17-fail-closed.test.ts");
const signoff = read("src/shared/api/wms-contract-signoff.ts");
const exactVerifier = read("scripts/verify-wwhn-181-exact-sha.mjs");
const finalVerifier = read("scripts/verify-wwhn-181-final-gates.mjs");
const uiEvidence = read("scripts/run-wwhn-181-runtime-ui-evidence.mjs");

requireValue(
  baseline.task === "WWHN-153",
  "baseline implementation task must remain WWHN-153",
);
requireValue(
  baseline.signoffTask === "WWHN-181",
  "baseline signoffTask must be WWHN-181",
);
requireValue(
  baseline.officialContract.jira === "WWHN-180",
  "official contract gate must be WWHN-180",
);
requireValue(
  baseline.officialContract.version === "1.7.0",
  "WWHN-180 contract must be v1.7.0",
);
requireValue(
  baseline.officialContract.beSha ===
    "fc534ed8c00dadd91ce60e7bac5a8660dda74d08",
  "exact BE SHA mismatch",
);
requireValue(
  baseline.officialContract.status.includes("CHANGES_REQUIRED"),
  "BE handoff drift must remain fail-closed until independently resolved",
);
requireValue(
  Array.isArray(baseline.independentSourceFindings) &&
    baseline.independentSourceFindings.length === 2,
  "independent BE source findings must be recorded",
);

const expectedPaths = {
  SCAN_CLASSIFY: "/scan/classify",
  INBOUND_LINE_SCAN: "/inbound-documents/:id/scan",
  OUTBOUND_LINE_SCAN: "/outbound-documents/:id/scan",
  POST_RECEIPT: "/inbound-documents/:id/post-receipt",
  POST_ISSUE: "/outbound-documents/:id/post-issue",
  APPLY_ADJUSTMENT: "/stocktake-sessions/:sessionId/apply-adjustment",
};
const flowsById = new Map(
  baseline.criticalFlows.map((flow) => [flow.id, flow]),
);
requireValue(
  flowsById.size === baseline.criticalFlows.length,
  "critical flow matrix must not contain duplicate flow ids",
);
for (const [id, relativePath] of Object.entries(expectedPaths)) {
  const flow = flowsById.get(id);
  requireValue(
    flow !== undefined,
    `critical flow matrix must retain foundation v1.7 flow ${id}`,
  );
  requireValue(flow.relativePath === relativePath, `${id} path mismatch`);
}
for (const flow of baseline.criticalFlows) {
  requireValue(
    typeof flow.id === "string" && flow.id.length > 0,
    "every critical flow must declare a non-empty id",
  );
  requireValue(
    typeof flow.relativePath === "string" && flow.relativePath.startsWith("/"),
    `${flow.id} must declare an absolute relativePath`,
  );
}

requirePattern(
  endpoints,
  /SCAN_BATCHES_CLASSIFY:\s*"\/scan\/classify"/u,
  "scan classify endpoint",
);
requirePattern(
  endpoints,
  /INBOUND_SCAN:\s*"\/inbound-documents\/:id\/scan"/u,
  "inbound line scan endpoint",
);
requirePattern(
  endpoints,
  /OUTBOUND_SCAN:\s*"\/outbound-documents\/:id\/scan"/u,
  "outbound line scan endpoint",
);
requirePattern(
  endpoints,
  /INBOUND_POST_RECEIPT:\s*"\/inbound-documents\/:id\/post-receipt"/u,
  "post receipt endpoint",
);
requirePattern(
  endpoints,
  /OUTBOUND_POST_ISSUE:\s*"\/outbound-documents\/:id\/post-issue"/u,
  "post issue endpoint",
);
requirePattern(
  endpoints,
  /STOCKTAKE_APPLY_ADJUSTMENT:\s*\n?\s*"\/stocktake-sessions\/:sessionId\/apply-adjustment"/u,
  "exact stocktake apply endpoint",
);

for (const code of [
  "scan.classify",
  "scan.inbound",
  "scan.outbound",
  "inbound.post",
  "outbound.post",
  "stocktake.adjust",
  "report.export",
  "warranty.temp_only",
]) {
  requirePattern(
    permissions,
    new RegExp(code.replaceAll(".", "\\.")),
    `permission ${code}`,
  );
}
requirePattern(
  permissionHook,
  /resolveWmsPermissionAlternatives\(codes\)/u,
  "fail-closed permission alternatives",
);
requirePattern(
  permissions,
  /canonical\.filter\(\(code\) => code !== "stocktake\.manage"\)/u,
  "stocktake.manage must not authorize stocktake.adjust",
);
requirePattern(
  permissionCatalog,
  /API_ENDPOINTS\.PERMISSIONS/u,
  "runtime permission catalog fetch",
);

for (const [content, label, permission] of [
  [scan, "scan classify", "SCAN_CLASSIFY_GENERIC"],
  [receiving, "inbound scan", "SCAN_INBOUND"],
  [receiving, "post receipt", "POST_RECEIPT"],
  [shipping, "outbound scan", "SCAN_OUTBOUND"],
  [shipping, "post issue", "POST_ISSUE"],
  [stocktake, "apply adjustment", "APPLY_STOCKTAKE_ADJUSTMENT"],
  [reports, "report export", "EXPORT_REPORT"],
]) {
  requirePattern(
    content,
    /assertWmsActionPermission/u,
    `${label} service guard`,
  );
  requirePattern(content, new RegExp(permission), `${label} action permission`);
}

requirePattern(http, /postWithMeta/u, "HTTP metadata-preserving post");
requirePattern(http, /meta\.request_id/u, "request_id metadata rationale");
for (const [content, label] of [
  [receiving, "receipt"],
  [shipping, "issue"],
]) {
  requirePattern(
    content,
    /classifyScanCodes/u,
    `${label} raw-code classification preflight`,
  );
  requirePattern(
    content,
    /line_id:\s*lineId,\s*(?:qty|quantity)/u,
    `${label} canonical line_id+qty scan payload`,
  );
  requirePattern(
    content,
    /WMS_FE_POST_REQUIRES_FULL_SCAN/u,
    `${label} atomic whole-document preflight`,
  );
  requirePattern(
    content,
    /requireIdempotencyKeyHeader/u,
    `${label} exact idempotency header`,
  );
  requirePattern(
    content,
    /postWithMeta/u,
    `${label} metadata-preserving posting`,
  );
}
requirePattern(
  stocktake,
  /status\.toUpperCase\(\) === "APPROVED"/u,
  "full APPROVED variance selection",
);
requirePattern(
  stocktake,
  /session_version:\s*sessionVersion/u,
  "stocktake session_version CAS body",
);
requirePattern(
  stocktake,
  /variance_ids:\s*varianceIds/u,
  "stocktake variance_ids body",
);
requirePattern(
  stocktake,
  /postWithMeta/u,
  "stocktake metadata-preserving posting",
);
requirePattern(
  scan,
  /unexpected code\(s\)/u,
  "scan exact response code-set guard",
);
requirePattern(
  warranty,
  /assertWmsActionPermission/u,
  "warranty mutation permission guard",
);
requirePattern(
  warranty,
  /"If-Match":\s*String\(/u,
  "warranty optimistic-concurrency If-Match header",
);
requirePattern(
  componentIssue,
  /assertWmsActionPermission/u,
  "component issue permission guard",
);
requirePattern(
  componentIssue,
  /requireIdempotencyKeyHeader/u,
  "component issue post exact idempotency header",
);
requirePattern(
  componentIssue,
  /WMS_FE_MISSING_COMPONENT_MOVEMENT/u,
  "component issue post movement evidence guard",
);
requirePattern(
  warrantyTests,
  /does not POST the create payload when actor only holds the legacy temp_only permission/u,
  "warranty legacy-permission fail-closed regression test",
);

requireValue(
  packageJson.scripts.typecheck === "tsc -b --pretty false",
  "typecheck script is required",
);
for (const script of [
  "test:e2e:evidence",
  "wms-evidence:collect",
  "wwhn-181:verify",
  "wwhn-181:final",
  "wwhn-181:ui-runtime",
]) {
  requireValue(
    packageJson.scripts[script] !== undefined,
    `${script} script is required`,
  );
}
requirePattern(
  ciWorkflow,
  /Check formatting without mutating source/u,
  "read-only format gate",
);
requirePattern(ciWorkflow, /npm run typecheck/u, "CI typecheck gate");
requirePattern(ciWorkflow, /npm run test:e2e:evidence/u, "CI Playwright gate");
requirePattern(
  wwhn181Workflow,
  /npm run wwhn-181:verify/u,
  "WWHN-181 exact SHA verifier gate",
);
requirePattern(
  wwhn181Workflow,
  /sha256sum -c/u,
  "WWHN-181 SHA256SUMS verification",
);
requirePattern(
  wwhn181Workflow,
  /artifact-digest/u,
  "WWHN-181 artifact digest publication",
);
requirePattern(
  exactVerifier,
  /beReleaseManifestSha256/u,
  "BE release manifest pin",
);
requirePattern(finalVerifier, /WWHN-180-PASS/u, "final WWHN-180 PASS gate");
requirePattern(finalVerifier, /WWHN-182-PASS/u, "final WWHN-182 PASS gate");
requirePattern(finalVerifier, /WWHN-183-GO/u, "final BA GO gate");
requirePattern(
  uiEvidence,
  /mock_or_route_interception:\s*"FORBIDDEN"/u,
  "live UI no-mock policy",
);
requirePattern(
  uiEvidence,
  /real_api_error_with_request_id/u,
  "real API error request_id proof",
);

requirePattern(
  signoff,
  /finalAllowed:\s*false/u,
  "static source final sign-off fail-closed",
);
for (const id of ["WWHN-180", "WWHN-182", "WWHN-183"]) {
  requirePattern(signoff, new RegExp(id), `external gate ${id}`);
  requirePattern(taskDoc, new RegExp(id), `WWHN-181 documentation ${id}`);
}
for (const phrase of [
  "posts inbound atomically with If-Match + Idempotency-Key",
  "resolves outbound raw codes and sends item-level canonical scan with If-Match",
  "applies the complete APPROVED variance set",
  "keeps final sign-off fail-closed",
]) {
  requirePattern(
    tests,
    new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `regression test: ${phrase}`,
  );
}

const evidence = {
  schemaVersion: "3.1.0",
  generatedAt: new Date().toISOString(),
  sourceSha: process.env.WMS_SOURCE_SHA ?? process.env.GITHUB_SHA ?? null,
  executionSha: process.env.WMS_EXECUTION_SHA ?? process.env.GITHUB_SHA ?? null,
  baseline: {
    path: baselinePath,
    sha256: sha256(baselineText),
    officialContract: baseline.officialContract,
  },
  independentSourceFindings: baseline.independentSourceFindings,
  criticalFlows: baseline.criticalFlows.map((flow) => ({
    id: flow.id,
    relativePath: flow.relativePath,
    feDisposition: flow.feDisposition,
  })),
  automatedChecks: {
    exactV17Identity: true,
    sourceDriftFailClosed: true,
    canonicalLineScan: true,
    atomicPosting: true,
    responseMetaRequestId: true,
    stocktakeSessionVersionCas: true,
    warrantyLegacyMutationFailClosed: true,
    runtimePermissionReconciliation: true,
    exactShaArtifactAndChecksums: true,
    liveUiNoMockContract: true,
    finalEvidenceEvaluator: true,
  },
  finalAllowed: false,
  boundary:
    "FE code and evidence controls are machine-checked; WWHN-180/WWHN-182/WWHN-183 remain independent authorities and are never self-signed by this verifier.",
};
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "contract-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(
  "[wms-contract] PASS: exact v1.7 FE-owned guards are consistent; independent WWHN-180/WWHN-182/WWHN-183 remain fail-closed.",
);
