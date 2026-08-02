export type ContractGateLevel = "P0" | "P1";
export type ContractGateStatus = "external_blocker" | "fe_guarded";

export type ContractGate = {
  id: string;
  level: ContractGateLevel;
  status: ContractGateStatus;
  owner: string;
  requiredFix: string;
};

export const WMS_OPENAPI_LOCAL_SNAPSHOT = {
  source: "swagger-api.json",
  openapi: "3.0.0",
  infoVersion: "1.0.0",
  sha256:
    "5AF4D40AD5614ABC49CF7BDEF0849D6C1B073F77A9A6307AA07CA7464F83D4EF",
  capturedAt: "2026-08-02",
  disposition:
    "Local FE snapshot only. It is not a final WWHN-31/WWHN-150/WWHN-151 contract artifact until BE publishes version, hash, changelog, and independent QA/BA review evidence.",
} as const;

export const WMS_FINAL_SIGNOFF = {
  status: "conditional_pass_not_final",
  finalAllowed: false,
  blockers: [
    "WWHN-31 official OpenAPI/schema version/hash/changelog",
    "WWHN-180 Scan/Post Receipt/Post Issue/Apply Adjustment contract pass",
    "WWHN-150 Architecture/OpenAPI core evidence",
    "WWHN-151 Schema/API modules evidence",
    "WWHN-152 QA1 constraints/error/testability evidence",
    "WWHN-182 QA2 happy/negative/RBAC/idempotency/retry evidence",
    "WWHN-183 BA G1 Go/No-Go minutes",
  ],
} as const;

export const WMS_P0_P1_CONTRACT_GATES: readonly ContractGate[] = [
  {
    id: "WWHN-31",
    level: "P0",
    status: "external_blocker",
    owner: "BE1 + BE2 + QA1",
    requiredFix:
      "Publish official OpenAPI/schema with version, hash, changelog; QA1 reviews constraints, errors, and testability.",
  },
  {
    id: "FE-FINAL-SIGNOFF",
    level: "P0",
    status: "external_blocker",
    owner: "FE1 + BA + QA",
    requiredFix:
      "FE final sign-off only after WWHN-31/WWHN-180 contract pass and independent BA/QA confirmation.",
  },
  {
    id: "WWHN-150-WWHN-151",
    level: "P1",
    status: "external_blocker",
    owner: "BE1 + BE2",
    requiredFix:
      "Complete Architecture/OpenAPI core and Schema/API modules; attach versioned evidence.",
  },
  {
    id: "ROUTE_PERMISSIONS",
    level: "P1",
    status: "fe_guarded",
    owner: "BE/RBAC + FE1",
    requiredFix:
      "Sync to backend permission catalog or BE/BA-approved mapping with versioned evidence. FE route permissions remain UX gates only.",
  },
  {
    id: "STOCK_CHANGING_CRITICAL_FLOWS",
    level: "P1",
    status: "fe_guarded",
    owner: "BE1 + BA + QA",
    requiredFix:
      "Lock endpoint, payload, error code, idempotency, permission, and sample response for Scan/Post Receipt/Post Issue/Apply Adjustment.",
  },
  {
    id: "BE-CONFIRMATION-EVIDENCE",
    level: "P1",
    status: "external_blocker",
    owner: "BE1/BE2",
    requiredFix:
      "Replace informal BE comments with OpenAPI/Postman/schema version/hash and independent reviewer evidence.",
  },
  {
    id: "QA-BA-GATES",
    level: "P1",
    status: "external_blocker",
    owner: "QA1 + QA2 + BA",
    requiredFix:
      "WWHN-152 QA1, WWHN-182 QA2, and WWHN-183 BA G1 minutes must include pass/fail evidence.",
  },
] as const;

export function getOpenContractGateIds(): string[] {
  return WMS_P0_P1_CONTRACT_GATES.filter(
    (gate) => gate.status === "external_blocker",
  ).map((gate) => gate.id);
}

export function assertFinalSignoffAllowed(): never {
  throw new Error(
    `WMS FE final sign-off is blocked by: ${WMS_FINAL_SIGNOFF.blockers.join(
      "; ",
    )}`,
  );
}
