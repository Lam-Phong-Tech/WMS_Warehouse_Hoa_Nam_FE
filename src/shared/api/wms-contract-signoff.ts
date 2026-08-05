export type WmsGateStatus =
  | "FE_COMPLETE"
  | "FE_COMPLETE_EXTERNAL_BLOCKER"
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
  contractVersion: "1.5.0",
  exactBeSha: "54d5f4ff9cbaa678e16dcf322bd55836e177409a",
  observedFeSha: "5cd10ec46021cecd24949075cb4eeefaa1fcc9b2",
  reviewResult: "CONDITIONAL",
  reviewScope: [
    "scan-classify",
    "post-receipt",
    "post-issue",
    "apply-adjustment",
    "permission-alias-boundary",
    "idempotency-and-optimistic-locking",
  ],
  manifestPath: "docs/evidence/WWHN-181/exact-sha-manifest.json",
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
    status: "READY_FOR_FE_REVIEW_PENDING_INDEPENDENT_GATES",
  },
  scanClassify: {
    method: "POST",
    relativePath: "/scan/classify",
    runtimePath: "/api/v1/scan/classify",
  },
} as const;

export const WMS_REVIEW_GATES: readonly WmsReviewGate[] = [
  {
    id: "WWHN-181-P0-FINAL",
    severity: "P0",
    owner: "FE1 + BA + QA2",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "WWHN-180 PASS, WWHN-182 QA2 PASS and WWHN-183 BA decision on the same exact FE/BE build pair",
  },
  {
    id: "WWHN-181-P0-CONTRACT-V1.5.0",
    severity: "P0",
    owner: "FE1 + BE1",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "Independent FE review of BE 54d5f4ff9cbaa678e16dcf322bd55836e177409a with immutable CI manifest",
  },
  {
    id: "WWHN-181-P0-OFFICIAL-CONTRACT",
    severity: "P0",
    owner: "BE1 + BE2 + independent reviewer",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "WWHN-31 official OpenAPI/schema artifact with version, SHA256, changelog and independent confirmation",
  },
  {
    id: "WWHN-181-P1-CI-MANIFEST",
    severity: "P1",
    owner: "FE1 + BE1 + DevOps",
    status: "FE_COMPLETE",
    requiredEvidence:
      "CI URL, artifact name and SHA256 manifest generated from the exact workflow commit",
  },
  {
    id: "WWHN-181-P1-SCHEMA-REVIEW",
    severity: "P1",
    owner: "BE2 + QA1",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "WWHN-150/151/152 schema, API module and QA1 constraint review on the exact official contract hash",
  },
  {
    id: "WWHN-181-P1-QA2-RUNTIME",
    severity: "P1",
    owner: "QA2",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "Happy/negative/RBAC/idempotency/retry/DB/reconcile evidence on exact SHA/build/env",
  },
  {
    id: "WWHN-181-P1-BA-G1",
    severity: "P1",
    owner: "BA",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "GO, CONDITIONAL_GO or NO_GO with P0/P1 open count, conditions, owner and evidence URL",
  },
  {
    id: "WWHN-181-P1-BE-AUTHORIZATION",
    severity: "P1",
    owner: "BE/RBAC + QA",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "Direct API 403, data-scope denial and runtime permission catalog; FE guards are UX only",
  },
  {
    id: "WWHN-181-P2-RUNTIME-UI",
    severity: "P2",
    owner: "FE1 + QA2",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "Responsive screenshots/video and real API errors with role/env/build/request_id and sanitized HAR",
  },
] as const;

export const WMS_FE_IMPLEMENTATION_READINESS = {
  task: "WWHN-181",
  status: "FE_OWNED_REMEDIATIONS_COMPLETE_PENDING_INDEPENDENT_GATES",
  automatedGuardCoverage: "P0_P1_P2_FE_SCOPE",
  traceabilityRule:
    "WWHN-153 proves implementation guards; WWHN-181 proves exact-contract review and sign-off gating. Evidence is never interchangeable.",
  controls: [
    "CANONICAL-SCAN-PATH",
    "ACTION-PERMISSION-GUARDS",
    "BACKEND-AUTHORITY-DISCLAIMER",
    "STOCK-CHANGING-IDEMPOTENCY",
    "OPTIMISTIC-LOCKING",
    "FAIL-CLOSED-FINAL-SIGNOFF",
    "EXACT-SHA-CI-MANIFEST",
    "TASK-SCOPED-EVIDENCE",
  ],
} as const;

export const WMS_EXTERNAL_GATE_LIST = [
  { id: "WWHN-31", status: "pending_official_contract_approval" },
  { id: "WWHN-150", status: "pending_schema_package" },
  { id: "WWHN-151", status: "pending_api_module_handoff" },
  { id: "WWHN-152", status: "pending_qa1_constraint_review" },
  { id: "WWHN-180", status: "pending_pass_on_exact_contract" },
  { id: "WWHN-182", status: "pending_qa2_execution" },
  { id: "WWHN-183", status: "pending_ba_g1_decision" },
] as const;

export const WMS_EXTERNAL_GATES = {
  officialContract: {
    id: "WWHN-31",
    status: "PENDING_OFFICIAL_CONTRACT_APPROVAL",
    required:
      "Versioned OpenAPI/schema, changelog, exact SHA256 and independent reviewer evidence.",
  },
  schemaReview: {
    ids: ["WWHN-150", "WWHN-151", "WWHN-152"],
    status: "PENDING_SCHEMA_AND_QA1_REVIEW",
    required:
      "BE2 schema/API module handoff and QA1 constraints/error/testability review on the same contract hash.",
  },
  beContract: {
    id: "WWHN-180",
    token: "BE-CONFIRMATION-EVIDENCE",
    status: "PENDING_PASS_ON_EXACT_SHA",
    required: `Contract v1.5.0 at ${WWHN_181_EXACT_REVIEW.exactBeSha}.`,
  },
  qa2: {
    id: "WWHN-182",
    token: "QA-BA-GATES",
    status: "PENDING_QA2_EXECUTION",
    required:
      "Named-build happy/negative/RBAC/idempotency/retry/DB/reconcile evidence.",
  },
  baDecision: {
    id: "WWHN-183",
    token: "QA-BA-GATES",
    status: "PENDING_BA_G1_DECISION",
    required: "BA GO, CONDITIONAL_GO or NO_GO minutes.",
  },
} as const;

function toGateStatus(gate: WmsReviewGate) {
  return { id: gate.id, status: gate.status };
}

export const WMS_P0_P1_CONTRACT_GATES =
  WMS_REVIEW_GATES.map(toGateStatus);

export function getOpenContractGateIds(): string[] {
  return WMS_REVIEW_GATES.filter((gate) => gate.status !== "FE_COMPLETE").map(
    (gate) => gate.id,
  );
}

export const WMS_FINAL_SIGNOFF = {
  id: "FE-FINAL-SIGNOFF",
  task: "WWHN-181",
  finalAllowed: false,
  status: "CONDITIONAL_PASS_NOT_FINAL",
  reason:
    "Final is fail-closed until WWHN-31, WWHN-150/151/152, WWHN-180, WWHN-182 and WWHN-183 independently pass on the same exact FE/BE build pair.",
  dependentTasks:
    "WWHN-31/WWHN-150/WWHN-151/WWHN-152/WWHN-180/WWHN-182/WWHN-183",
} as const;

export function assertFinalSignoffAllowed(): void {
  if (!WMS_FINAL_SIGNOFF.finalAllowed) {
    throw new Error(`FE-FINAL-SIGNOFF blocked: ${WMS_FINAL_SIGNOFF.reason}`);
  }
}
