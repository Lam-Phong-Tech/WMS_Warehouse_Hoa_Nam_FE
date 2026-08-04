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

export const WMS_CONTRACT_BASELINE = {
  id: "HN-INT-001",
  parentTask: "WWHN-40",
  feTask: "WWHN-153",
  dependency: "HN-INT-001-ST01",
  source: "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json",
  task: "WWHN-153",
  apiBasePath: "/api/v1",
  officialContract: {
    jira: "WWHN-31",
    status: "PENDING_BE1_BE2_QA1_CLOSURE",
    version: null,
    sha256: null,
    changelog: null,
  },
  scanClassify: {
    method: "POST",
    relativePath: "/scan/classify",
    runtimePath: "/api/v1/scan/classify",
  },
} as const;

export const WMS_REVIEW_GATES: readonly WmsReviewGate[] = [
  {
    id: "BA-FE-P0-01",
    severity: "P0",
    owner: "BE1 + BE2",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence:
      "WWHN-31 official OpenAPI/schema version, SHA256, changelog and independent reviewer",
  },
  {
    id: "BA-FE-P0-02",
    severity: "P0",
    owner: "FE1 + BA + QA",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "WWHN-31/WWHN-180 pass and independent BA/QA confirmation",
  },
  {
    id: "BA-FE-P1-01",
    severity: "P1",
    owner: "BE1 + BE2",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence: "WWHN-150/WWHN-151 versioned artifacts",
  },
  {
    id: "BA-FE-P1-02",
    severity: "P1",
    owner: "QA1",
    status: "EXTERNAL_BLOCKER",
    requiredEvidence: "WWHN-152 review on exact official OpenAPI SHA256",
  },
  {
    id: "BA-FE-P1-03",
    severity: "P1",
    owner: "QA2 + BA",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence: "WWHN-182 runtime evidence and WWHN-183 G1 minutes",
  },
  {
    id: "BA-FE-P1-04",
    severity: "P1",
    owner: "BE/RBAC + FE1 + BA",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence: "Approved /permissions catalog and backend 403 evidence",
  },
  {
    id: "BA-FE-P1-05",
    severity: "P1",
    owner: "BE1 + BA + QA",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "Official endpoint, payload, error, permission and sample-response sign-off",
  },
  {
    id: "BA-FE-P2-01",
    severity: "P2",
    owner: "FE1",
    status: "FE_COMPLETE",
    requiredEvidence: "WWHN-153 closure matrix and CI artifact",
  },
  {
    id: "BA-FE-P2-02",
    severity: "P2",
    owner: "FE1 + DevOps + QA2",
    status: "FE_COMPLETE_EXTERNAL_BLOCKER",
    requiredEvidence:
      "Named source/build/env logs plus QA2 real backend screenshots/video",
  },
] as const;

export const WMS_FE_IMPLEMENTATION_READINESS = {
  status: "FE_OWNED_REMEDIATIONS_COMPLETE_PENDING_INDEPENDENT_GATES",
  automatedGuardCoverage: "P0_P1_P2_FE_SCOPE",
  completedIssues: [
    "BA-FE-P0-02",
    "BA-FE-P1-04",
    "BA-FE-P1-05",
    "BA-FE-P2-01",
    "BA-FE-P2-02",
  ],
  preparedEvidenceIssues: [
    "BA-FE-P0-01",
    "BA-FE-P1-01",
    "BA-FE-P1-02",
    "BA-FE-P1-03",
  ],
  controls: [
    "CANONICAL-SCAN-PATH",
    "ACTION-PERMISSION-GUARDS",
    "RUNTIME-PERMISSION-RECONCILIATION",
    "STOCK-CHANGING-SUCCESS-EVIDENCE",
    "FAIL-CLOSED-UNAPPROVED-CONTRACT",
    "IMMUTABLE-CI-EVIDENCE",
  ],
} as const;

export const WMS_EXTERNAL_GATE_LIST = [
  { id: "WWHN-31", status: "pending_official_contract" },
  { id: "WWHN-150", status: "pending_be_core" },
  { id: "WWHN-151", status: "pending_be_schema" },
  { id: "WWHN-152", status: "pending_qa1_exact_hash_review" },
  { id: "WWHN-180", status: "pending_independent_signoff" },
  { id: "WWHN-182", status: "pending_qa2_execution" },
  { id: "WWHN-183", status: "pending_ba_g1_decision" },
] as const;

/** Compatibility shape used by existing consumers. */
export const WMS_EXTERNAL_GATES = {
  beContract: {
    id: "WWHN-180",
    token: "BE-CONFIRMATION-EVIDENCE",
    status: "PENDING_INDEPENDENT_SIGN_OFF",
    required: "Official contract and critical-flow sign-off from BE1/BA.",
  },
  qa2: {
    id: "WWHN-182",
    token: "QA-BA-GATES",
    status: "PENDING_QA2_EXECUTION",
    required: "Named-build happy/negative/RBAC/idempotency/runtime evidence.",
  },
  baDecision: {
    id: "WWHN-183",
    token: "QA-BA-GATES",
    status: "PENDING_BA_G1_DECISION",
    required: "BA Go, Conditional Go, or No-Go minutes.",
  },
} as const;

export const WMS_OPENAPI_LOCAL_SNAPSHOT = {
  source: WMS_CONTRACT_BASELINE.source,
  openapi: null,
  infoVersion: null,
  sha256: null,
  disposition:
    "FE implementation baseline only; not official WWHN-31 OpenAPI/schema evidence.",
} as const;

export const WMS_P0_P1_CONTRACT_GATES = WMS_REVIEW_GATES.map((gate) => ({
  id: gate.id,
  status: gate.status,
}));

export function getOpenContractGateIds(): string[] {
  return WMS_REVIEW_GATES.filter((gate) => gate.status !== "FE_COMPLETE").map(
    (gate) => gate.id,
  );
}

export const WMS_FINAL_SIGNOFF = {
  id: "FE-FINAL-SIGNOFF",
  finalAllowed: false,
  status: "CONDITIONAL_PASS_NOT_FINAL",
  reason:
    "Official WWHN-31 contract and independent BE/QA/BA gates are not complete.",
  dependentTasks:
    "WWHN-31/WWHN-150/WWHN-151/WWHN-152/WWHN-180/WWHN-182/WWHN-183",
} as const;

export function assertFinalSignoffAllowed(): void {
  if (!WMS_FINAL_SIGNOFF.finalAllowed) {
    throw new Error(`FE-FINAL-SIGNOFF blocked: ${WMS_FINAL_SIGNOFF.reason}`);
  }
}
