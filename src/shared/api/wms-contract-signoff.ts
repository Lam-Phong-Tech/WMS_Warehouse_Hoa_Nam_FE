export type WmsGateStatus =
  | "FE_COMPLETE"
  | "FE_COMPLETE_EXTERNAL_BLOCKER"
  | "FE_CHANGES_REQUIRED_EXTERNAL_CONTRACT"
  | "EXTERNAL_BLOCKER";

export interface WmsReviewGate {
  id: string;
  severity: "P0" | "P1" | "P2";
  owner: string;
  status: WmsGateStatus;
  requiredEvidence: string;
}

export const WWHN_181_EXACT_REVIEW = {
  task: "WWHN-181",
  parentTask: "WWHN-40",
  contractTask: "WWHN-180",
  contractVersion: "1.7.0",
  exactBeSha: "fc534ed8c00dadd91ce60e7bac5a8660dda74d08",
  backendObservedFeBaselineSha:
    "f6e137d01ed7afec5d30e8fecde6a2cc31bb7c8b",
  remediationBaseFeSha: "aa185096211bc5bef7ec966097edfc106a5003b2",
  backendReleaseManifestSha256:
    "ba8bc5841b5865095e51d21064ead90ad4c37129ee28142a3f507b497ddcc776",
  backendReleasePackSha256:
    "a20b0d8d8a9145bceb2e797c51befa20d7da9e6439be512b39f72f3d8010cdb9",
  backendRepositorySha256sumsSha256:
    "0f4dcd23ceb84e39799fae5cb3f112932e6260a34ccff63b1ab7c623c839cb36",
  reviewResult: "CHANGES_REQUIRED_BE_HANDOFF_DRIFT",
  independentSourceFindings: [
    {
      id: "BE-HANDOFF-SCAN-CONTEXT-DRIFT",
      focusedArtifact:
        "docs/api-contract/WWHN-180-posting-openapi.yaml declares WARRANTY",
      exactRuntime:
        "Modules/Warehouse/app/Http/Controllers/ScanController.php validates WARRANTY_TEMP_ONLY",
      disposition:
        "FE stays on exact runtime WARRANTY_TEMP_ONLY and final sign-off remains blocked until WWHN-180 publishes one canonical source.",
    },
    {
      id: "BE-HANDOFF-WARRANTY-BODY-DRIFT",
      focusedArtifact:
        "WWHN-180 focused artifact omits the TEMP_ONLY request body",
      exactRuntime:
        "WarrantyController requires temporary_item_code, missing_code_reason and condition_status plus Idempotency-Key",
      disposition:
        "Do not infer a replacement contract in FE; require WWHN-180 independent approval/correction.",
    },
  ],
  reviewScope: [
    "scan-classify-and-line-scan",
    "post-receipt",
    "post-issue",
    "stocktake-apply-adjustment",
    "permission-alias-boundary",
    "idempotency",
    "cas-session-version",
    "response-meta-request-id",
  ],
  manifestPath: "docs/evidence/WWHN-181/generated/<FE_SHA>/manifest.json",
  runtimeEvidencePath:
    "docs/evidence/WWHN-181/RUNTIME_EVIDENCE_CHECKLIST.md",
} as const;

export const WMS_CONTRACT_BASELINE = {
  id: "HN-INT-001",
  parentTask: "WWHN-40",
  implementationTask: "WWHN-153",
  signoffTask: "WWHN-181",
  dependency: "HN-INT-001-ST01",
  source: "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json",
  apiBasePath: "/api/v1",
  officialContract: {
    jira: "WWHN-180",
    version: WWHN_181_EXACT_REVIEW.contractVersion,
    exactBeSha: WWHN_181_EXACT_REVIEW.exactBeSha,
    status: "PENDING_INDEPENDENT_APPROVAL_AND_HANDOFF_DRIFT_RESOLUTION",
  },
  scanClassify: {
    method: "POST",
    relativePath: "/scan/classify",
    runtimePath: "/api/v1/scan/classify",
    runtimeWarrantyContext: "WARRANTY_TEMP_ONLY",
  },
} as const;

export const WMS_REVIEW_GATES: readonly WmsReviewGate[] = [
  {
    id: "WWHN-181-P0-FINAL",
    severity: "P0",
    owner: "FE1 + BA + QA2",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "WWHN-180 PASS, WWHN-182 QA2 PASS and WWHN-183 GO on the same exact FE SHA, BE SHA and manifest digest",
  },
  {
    id: "WWHN-181-P0-CONTRACT-V1.7.0",
    severity: "P0",
    owner: "BE1 + BA + FE1 independent reviewer",
    status: "FE_CHANGES_REQUIRED_EXTERNAL_CONTRACT",
    requiredEvidence:
      "Resolve the two exact-source handoff drifts, then independently approve OpenAPI/schema/artifact/digest/changelog on BE fc534ed8c00dadd91ce60e7bac5a8660dda74d08 or a formally superseding exact SHA",
  },
  {
    id: "WWHN-181-P1-CI-MANIFEST",
    severity: "P1",
    owner: "FE1 + BE1 + DevOps",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "Exact closure SHA workflow PASS with artifact URL/name/digest and SHA256SUMS verification; current GitHub Actions runner provisioning is blocked by WWHN-337",
  },
  {
    id: "WWHN-181-P1-QA2-RUNTIME",
    severity: "P1",
    owner: "QA2",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "WWHN-182 happy/negative/RBAC/idempotency replay+conflict/race/DB before-after/reconcile evidence on exact SHA/build/env",
  },
  {
    id: "WWHN-181-P1-BA-G1",
    severity: "P1",
    owner: "BA",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "WWHN-183 GO/CONDITIONAL_GO/NO_GO with P0/P1 counts, conditions, owner and evidence URL on the same identity",
  },
  {
    id: "WWHN-181-P1-BE-AUTHORIZATION",
    severity: "P1",
    owner: "BE/RBAC + QA2",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "Direct API 403, warehouse data-scope denial and runtime permission catalog. FE guard remains defense-in-depth only.",
  },
  {
    id: "WWHN-181-P2-RUNTIME-UI",
    severity: "P2",
    owner: "FE1 + QA2",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "Live non-mocked responsive screenshots plus at least one real API error carrying request_id and sanitized HAR metadata on exact env/build/SHA",
  },
] as const;

export const WMS_FE_IMPLEMENTATION_READINESS = {
  task: "WWHN-181",
  status: "FE_CRITICAL_RUNTIME_REMEDIATIONS_COMPLETE_EXTERNAL_GATES_BLOCKED",
  automatedGuardCoverage: "P0_P1_P2_FE_SCOPE",
  traceabilityRule:
    "Source review, CI artifact, direct runtime evidence, UI evidence and independent Jira decisions must share one exact identity; none is interchangeable with another.",
  controls: [
    "CANONICAL-SCAN-CLASSIFY-THEN-LINE-SCAN",
    "ACTION-PERMISSION-GUARDS",
    "BACKEND-AUTHORITY-DISCLAIMER",
    "STOCK-CHANGING-IDEMPOTENCY",
    "STOCKTAKE-CAS-IN-SESSION-VERSION-BODY",
    "PRESERVE-RESPONSE-META-REQUEST-ID",
    "WHOLE-DOCUMENT-POSTING-PREFLIGHT",
    "FAIL-CLOSED-FINAL-SIGNOFF",
    "EXACT-SHA-CI-MANIFEST",
    "LIVE-NON-MOCKED-UI-EVIDENCE",
  ],
} as const;

export const WMS_EXTERNAL_GATE_LIST = [
  {
    id: "WWHN-180",
    status: "pending_independent_pass_and_handoff_drift_resolution",
  },
  { id: "WWHN-182", status: "pending_qa2_execution" },
  { id: "WWHN-183", status: "pending_ba_g1_decision" },
] as const;

export const WMS_EXTERNAL_GATES = {
  beContract: {
    id: "WWHN-180",
    token: "BE-CONFIRMATION-EVIDENCE",
    status: "CHANGES_REQUIRED_BE_HANDOFF_DRIFT",
    required: `Contract v1.7.0 at ${WWHN_181_EXACT_REVIEW.exactBeSha}, immutable manifest ${WWHN_181_EXACT_REVIEW.backendReleaseManifestSha256}, independently approved after focused-artifact/runtime reconciliation.`,
  },
  qa2: {
    id: "WWHN-182",
    token: "QA-BA-GATES",
    status: "PENDING_QA2_EXECUTION",
    required:
      "Named-build happy/negative/RBAC/idempotency/retry/race/DB/reconcile evidence.",
  },
  baDecision: {
    id: "WWHN-183",
    token: "QA-BA-GATES",
    status: "PENDING_BA_G1_DECISION",
    required:
      "BA GO/CONDITIONAL_GO/NO_GO bound to the exact FE SHA, BE SHA and manifest digest.",
  },
} as const;

function toGateStatus(gate: WmsReviewGate) {
  return { id: gate.id, status: gate.status };
}

export const WMS_P0_P1_CONTRACT_GATES = WMS_REVIEW_GATES.map(toGateStatus);

export function getOpenContractGateIds(): string[] {
  return WMS_REVIEW_GATES.filter((gate) => gate.status !== "FE_COMPLETE").map(
    (gate) => gate.id,
  );
}

export const WMS_FINAL_SIGNOFF = {
  id: "FE-FINAL-SIGNOFF",
  task: "WWHN-181",
  finalAllowed: false,
  status: "BLOCKED_FAIL_CLOSED",
  reason:
    "Final is fail-closed until WWHN-180 PASS, WWHN-182 QA2 PASS, WWHN-183 GO, exact-SHA CI/SHA256SUMS PASS and live UI evidence PASS all share the same FE SHA, BE SHA and manifest digest.",
  dependentTasks: "WWHN-180/WWHN-182/WWHN-183",
  evaluator: "npm run wwhn-181:final -- <FINAL_GATE_EVIDENCE.json>",
} as const;

export function assertFinalSignoffAllowed(): void {
  if (!WMS_FINAL_SIGNOFF.finalAllowed) {
    throw new Error(
      `FE-FINAL-SIGNOFF blocked: ${WMS_FINAL_SIGNOFF.reason}`,
    );
  }
}
