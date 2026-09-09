#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(
  root,
  process.env.WMS_EVIDENCE_DIR ?? "docs/evidence/wms-contract-signoff/generated",
);

function read(file) {
  return readFileSync(join(root, file), "utf8");
}

function requireValue(condition, label) {
  if (!condition) throw new Error(`[wms-contract] ${label}`);
}

function requirePattern(content, pattern, label) {
  requireValue(pattern.test(content), `Missing ${label}: ${pattern}`);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

const baselinePath = "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json";
const baselineText = read(baselinePath);
const baseline = JSON.parse(baselineText);
const m1Mapping = read("docs/api-evidence/M1_API_MAPPING.md");
const m2Mapping = read("docs/api-evidence/M2_DEPENDENCY_LIST.md");
const m3Mapping = read("docs/api-evidence/M3_DEPENDENCY_LIST.md");
// docs/Task_docs_Jira/WWHN-181.md — ĐÃ RÚT theo 3822d45 (dọn kho tài liệu);
// kiểm tra documentation trên task doc rút theo, gate sống giữ ở wms-contract-signoff.ts.
const ciWorkflow = read(".github/workflows/ci.yml");
const wwhn181Workflow = read(".github/workflows/wwhn-181-signoff.yml");
const packageJson = JSON.parse(read("package.json"));
const endpoints = read("src/shared/api/endpoints.ts");
const http = read("src/shared/api/http.ts");
const permissions = read("src/shared/constants/wms-permissions.ts");
const permissionHook = read("src/shared/hooks/usePermission.ts");
const permissionCatalog = read("src/shared/api/wms-permission-catalog.ts");
const scan = read("src/modules/scan/services/scanService.ts");
const receiving = read("src/modules/inbound/services/inboundService.ts");
const shipping = read("src/modules/shipping/services/shippingService.ts");
const warranty = read("src/modules/warranty/services/warrantyService.ts");
const componentIssue = read("src/modules/warranty/services/componentIssueService.ts");
// Trang báo cáo đã tách thành 8 route riêng (AlignedReportsPage.tsx xoá —
// phản hồi người dùng 2026-08-30); guard export permission thực chất nằm ở
// lớp report-export.ts dùng chung cho cả 8 trang, không phải ở shell UI.
const reports = read("src/modules/reports/operations/report-export.ts");
const tests = read("src/test/wms-contract-signoff-guards.test.ts");
const warrantyTests = read("src/test/warranty-v17-fail-closed.test.ts");
const signoff = read("src/shared/api/wms-contract-signoff.ts");
const exactVerifier = read("scripts/verify-wwhn-181-exact-sha.mjs");
const finalVerifier = read("scripts/verify-wwhn-181-final-gates.mjs");
const uiEvidence = read("scripts/run-wwhn-181-runtime-ui-evidence.mjs");

// Preserve historical WWHN-181 contract identity as evidence. Current runtime
// remediation must never silently turn its independent external gate into PASS.
requireValue(baseline.task === "WWHN-153", "historical baseline task must remain WWHN-153");
requireValue(baseline.signoffTask === "WWHN-181", "historical signoff task must remain WWHN-181");
requireValue(baseline.officialContract?.jira === "WWHN-180", "official contract gate must remain WWHN-180");
requireValue(baseline.officialContract?.version === "1.7.0", "official contract version must remain v1.7.0");
requireValue(
  String(baseline.officialContract?.status ?? "").includes("CHANGES_REQUIRED"),
  "historical WWHN-180 evidence must remain fail-closed until independently superseded",
);
for (const id of ["WWHN-180", "WWHN-182", "WWHN-183"]) {
  requirePattern(signoff, new RegExp(id, "u"), `external gate ${id}`);
  // Đối chiếu task doc WWHN-181 đã rút theo 3822d45 (xem chú thích đầu file).
}

// Current MVP runtime contract. Stocktake removal is required by REQ-SRS-037 in
// the adopted SRS/FRD v1.12 baseline (see docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json);
// correction after Post is reversal-only per DEC-REV-001/WWHN-26.
for (const [pattern, label] of [
  [/SCAN_BATCHES_CLASSIFY:\s*"\/scan\/classify"/u, "canonical scan classify endpoint"],
  [/INBOUND_SCAN:\s*"\/inbound-documents\/:id\/scans"/u, "canonical inbound scan endpoint"],
  [/OUTBOUND_SCAN:\s*"\/outbound-documents\/:id\/scans"/u, "canonical outbound scan endpoint"],
  [/INBOUND_POST_RECEIPT:\s*"\/inbound-documents\/:id\/post-receipt"/u, "post receipt endpoint"],
  [/OUTBOUND_POST_ISSUE:\s*"\/outbound-documents\/:id\/post-issue"/u, "post issue endpoint"],
  [/REVERSAL_POST:\s*"\/reversal-documents\/:id\/post"/u, "reversal post endpoint"],
]) {
  requirePattern(endpoints, pattern, label);
}
requireValue(
  !/STOCKTAKE_[A-Z0-9_]*\s*:/u.test(endpoints),
  "current MVP must not expose Stocktake endpoint constants",
);
requireValue(
  !/stocktake\./iu.test(permissions),
  "current MVP must not expose stocktake.* permissions",
);
requireValue(
  !existsSync(join(root, "src/modules/stocktake/services/stocktakeService.ts")),
  "current MVP must not restore the removed Stocktake runtime service",
);

for (const code of [
  "scan.classify",
  "scan.execute",
  "inbound.scan",
  "inbound.post",
  "outbound.scan",
  "outbound.post",
  "inventory.reversal.post",
  "warranty.manage",
  "warranty.component_issue",
  "report.view",
  "report.export",
]) {
  requirePattern(
    permissions,
    new RegExp(`"${code.replaceAll(".", "\\.")}"`, "u"),
    `permission ${code}`,
  );
}

requirePattern(
  permissionHook,
  /resolveWmsPermissionAlternatives\(codes\)/u,
  "fail-closed permission alternatives",
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
  [reports, "report export", "EXPORT_REPORT"],
]) {
  requirePattern(content, /assertWmsActionPermission/u, `${label} service guard`);
  requirePattern(content, new RegExp(permission, "u"), `${label} action permission`);
}

requirePattern(scan, /unexpected code\(s\)/u, "scan response code-set guard");
// Inbound bỏ preflight classify CÓ CHỦ ĐÍCH (DEC-QR-001, Change Pack QR/SKU
// 20/08/2026): BE parse composite QR authoritative; classify 404 với item mới
// sẽ chặn nhầm luồng nhập. Pin marker quyết định thay cho classifyScanCodes.
requirePattern(receiving, /DEC-QR-001/u, "inbound raw-scan decision marker");
requirePattern(shipping, /classifyScanCodes/u, "outbound scan classify preflight");
requirePattern(
  receiving,
  /requireIdempotencyKeyHeader/u,
  "post receipt idempotency key guard",
);
requirePattern(
  shipping,
  /requireIdempotencyKeyHeader/u,
  "post issue idempotency key guard",
);
requirePattern(http, /postWithMeta/u, "metadata-preserving HTTP post");
requirePattern(http, /request_id/u, "request_id preservation");
requirePattern(
  warranty,
  /assertWmsActionPermission/u,
  "warranty mutation permission guard",
);
requirePattern(
  componentIssue,
  /assertWmsActionPermission/u,
  "component issue permission guard",
);
requirePattern(
  componentIssue,
  /requireIdempotencyKeyHeader/u,
  "component issue post idempotency guard",
);
requirePattern(
  warrantyTests,
  /fail-closed/iu,
  "warranty fail-closed regression coverage",
);

requirePattern(
  m1Mapping,
  /Removed-from-MVP boundary — Stocktake/u,
  "M1 no-stocktake boundary",
);
requirePattern(
  m3Mapping,
  /Removed-from-MVP boundary: Stocktake/u,
  "M3 no-stocktake boundary",
);
requirePattern(m2Mapping, /\/scan\/classify/u, "M2 canonical scan path");

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
  "check:api-mapping",
]) {
  requireValue(packageJson.scripts[script] !== undefined, `${script} script is required`);
}

requirePattern(ciWorkflow, /npm run typecheck/u, "CI typecheck gate");
requirePattern(ciWorkflow, /npm run test/u, "CI test gate");
requirePattern(ciWorkflow, /npm run build/u, "CI build gate");
requirePattern(ciWorkflow, /npm run check:api-mapping/u, "CI API mapping gate");
requirePattern(
  ciWorkflow,
  /npm run test:e2e:evidence/u,
  "CI Playwright evidence gate",
);
requirePattern(
  wwhn181Workflow,
  /sha256sum -c/u,
  "WWHN-181 SHA256SUMS verification",
);
requirePattern(
  exactVerifier,
  /beReleaseManifestSha256/u,
  "historical BE release manifest pin",
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
  signoff,
  /finalAllowed:\s*false/u,
  "static final sign-off fail-closed",
);
requirePattern(
  tests,
  /keeps every stocktake capability out of the FE permission surface/u,
  "no-stocktake regression test",
);
requirePattern(
  tests,
  /keeps final sign-off fail-closed/u,
  "final sign-off regression test",
);

const evidence = {
  schemaVersion: "4.0.0",
  generatedAt: new Date().toISOString(),
  sourceSha: process.env.WMS_SOURCE_SHA ?? process.env.GITHUB_SHA ?? null,
  executionSha: process.env.WMS_EXECUTION_SHA ?? process.env.GITHUB_SHA ?? null,
  historicalBaseline: {
    path: baselinePath,
    sha256: sha256(baselineText),
    officialContract: baseline.officialContract,
    disposition: "PRESERVED_FAIL_CLOSED_NOT_USED_AS_CURRENT_STOCKTAKE_RUNTIME",
  },
  currentMvp: {
    scanClassify: "/api/v1/scan/classify",
    inboundScan: "/api/v1/inbound-documents/{id}/scans",
    outboundScan: "/api/v1/outbound-documents/{id}/scans",
    stocktake: "REMOVED_FROM_MVP",
    correctionModel: "APPEND_ONLY_REVERSAL",
  },
  automatedChecks: {
    canonicalRuntimePaths: true,
    noStocktakeMvpBoundary: true,
    actionPermissionGuards: true,
    postingIdempotency: true,
    responseMetaRequestId: true,
    warrantyFailClosed: true,
    runtimePermissionReconciliation: true,
    exactShaArtifactControlsPresent: true,
    liveUiNoMockContractPresent: true,
    finalEvidenceEvaluatorPresent: true,
  },
  finalAllowed: false,
  boundary:
    "Current FE-owned runtime/build controls are machine-checked. Historical WWHN-180/WWHN-182/WWHN-183 and production DevOps/QA evidence remain independent and are never self-signed by this verifier.",
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "contract-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

console.log(
  "[wms-contract] PASS: current m1 runtime guards are internally consistent; Stocktake remains removed and independent final gates stay fail-closed.",
);
