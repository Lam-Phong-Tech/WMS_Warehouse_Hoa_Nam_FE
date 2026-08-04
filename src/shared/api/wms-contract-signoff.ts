/**
 * WWHN-181 FE implementation gate.
 *
 * This file distinguishes code readiness from final cross-role sign-off.
 * FE must never turn independent BE, QA2, or BA evidence into a self-signed
 * "final" result.
 */

export const WMS_CONTRACT_BASELINE = {
  id: "HN-INT-001",
  parentTask: "WWHN-40",
  feTask: "WWHN-181",
  dependency: "HN-INT-001-ST01",
  apiBasePath: "/api/v1",
  source: "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json",
  scanClassify: {
    endpointConstantPath: "/scan/classify",
    runtimePath: "/api/v1/scan/classify",
    method: "POST",
    permission: "scan.classify",
  },
  criticalActions: {
    postReceipt: "inbound.post",
    postIssue: "outbound.post",
    applyAdjustment: "stocktake.adjust",
    warrantyTempOnly: "warranty.temp_only",
    reportExport: "report.export",
  },
} as const;

export const WMS_FE_IMPLEMENTATION_READINESS = {
  status: "FE_IMPLEMENTED_PENDING_INDEPENDENT_GATES",
  completedIssues: [
    "FE1-P1-01",
    "FE1-P1-02",
    "FE1-P1-03",
  ],
  preparedEvidenceIssues: ["FE1-P1-04", "FE1-P1-05", "FE1-P2-01"],
  controls: [
    "CANONICAL-SCAN-PATH",
    "ROUTE_PERMISSIONS",
    "STOCK_CHANGING_CRITICAL_FLOWS",
    "REPORT-ENDPOINT-DISPOSITION",
    "PERMISSION-ALIAS-NORMALIZATION",
    "FAIL-CLOSED-UNAPPROVED-CONTRACT",
    "RUNTIME-EVIDENCE",
  ],
} as const;

export const WMS_EXTERNAL_GATES = {
  beContract: {
    id: "WWHN-180",
    token: "BE-CONFIRMATION-EVIDENCE",
    status: "PENDING_INDEPENDENT_SIGN_OFF",
    required:
      "BE1 + BA lock endpoint, payload, errors, permission, idempotency, and sample responses.",
  },
  qa2: {
    id: "WWHN-182",
    token: "QA-BA-GATES",
    status: "PENDING_QA2_EXECUTION",
    required:
      "QA2 executes happy, negative, RBAC, idempotency, retry, responsive, and runtime error evidence on a named build/environment.",
  },
  baDecision: {
    id: "WWHN-183",
    token: "QA-BA-GATES",
    status: "PENDING_BA_G1_DECISION",
    required:
      "BA records Go, Conditional Go, or No-Go and closes FE-SO-001..006 with disposition.",
  },
} as const;

/**
 * Compatibility exports kept for existing consumers. They now point to the
 * versioned FE baseline rather than a missing local Swagger snapshot.
 */
export const WMS_OPENAPI_LOCAL_SNAPSHOT = {
  source: WMS_CONTRACT_BASELINE.source,
  openapi: null,
  infoVersion: "FE-baseline-1.0.0",
  sha256: "GENERATED_BY_CI_VERIFIER",
  disposition:
    "FE implementation baseline only; not a final WWHN-180 or official BE OpenAPI sign-off artifact.",
} as const;

export const WMS_P0_P1_CONTRACT_GATES = [
  {
    id: "ROUTE_PERMISSIONS",
    status: "fe_guarded",
  },
  {
    id: "STOCK_CHANGING_CRITICAL_FLOWS",
    status: "fe_guarded",
  },
  {
    id: "BE-CONFIRMATION-EVIDENCE",
    status: "external_pending",
  },
  {
    id: "RUNTIME-EVIDENCE",
    status: "external_pending",
  },
  {
    id: "QA-BA-GATES",
    status: "external_pending",
  },
  {
    id: "FE-FINAL-SIGNOFF",
    status: "external_pending",
  },
] as const;

export function getOpenContractGateIds(): string[] {
  return WMS_P0_P1_CONTRACT_GATES.filter(
    (gate) => gate.status === "external_pending",
  ).map((gate) => gate.id);
}

export const WMS_FINAL_SIGNOFF = {
  id: "FE-FINAL-SIGNOFF",
  finalAllowed: false,
  status: "CONDITIONAL_PASS_NOT_FINAL",
  reason:
    "FE implementation can pass its automated guards, but WWHN-180, WWHN-182, and WWHN-183 require independent BE, QA2, and BA evidence.",
  dependentTasks: "WWHN-150-WWHN-151",
} as const;

export function assertFinalSignoffAllowed(): void {
  if (!WMS_FINAL_SIGNOFF.finalAllowed) {
    throw new Error(
      `${WMS_FINAL_SIGNOFF.id}: ${WMS_FINAL_SIGNOFF.reason}`,
    );
  }
}
