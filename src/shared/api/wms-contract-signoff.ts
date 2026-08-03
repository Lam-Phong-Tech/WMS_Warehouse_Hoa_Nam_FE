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
    "WWHN-146 HN-UX-002 field/state matrix BAS approval",
    "WWHN-147 HN-UX-002 rule/label/validation BA approval",
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
    id: "HN-UX-002-WWHN-146-WWHN-147",
    level: "P1",
    status: "external_blocker",
    owner: "BAS + BA",
    requiredFix:
      "Complete and approve the HN-UX-002 field/state matrix in WWHN-146 plus rule, label, and validation baseline in WWHN-147.",
  },
  {
    id: "QA2-TESTABILITY-REVIEW",
    level: "P1",
    status: "external_blocker",
    owner: "QA2",
    requiredFix:
      "Review UI state, responsive behavior, RBAC, API errors, and testability; add explicit pass/fail evidence on the target build.",
  },
  {
    id: "API-MAPPING-EVIDENCE",
    level: "P1",
    status: "fe_guarded",
    owner: "FE1 + BE/BA",
    requiredFix:
      "Keep docs/api-evidence/M1_API_MAPPING.md present and make npm run check:api-mapping pass; BE/BA must approve any contract/script exception.",
  },
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
      "Confirm endpoints, payloads, error codes, permission catalog, and sample 403/409/422/idempotency responses with OpenAPI/Postman/schema version/hash and independent reviewer evidence.",
  },
  {
    id: "RUNTIME-EVIDENCE",
    level: "P1",
    status: "external_blocker",
    owner: "FE1 + QA",
    requiredFix:
      "Attach screenshot or video evidence for desktop, tablet, mobile, role scenarios, and API error states on a named build/env.",
  },
  {
    id: "QA-BA-GATES",
    level: "P1",
    status: "external_blocker",
    owner: "QA1 + QA2 + BA",
    requiredFix:
      "WWHN-152 QA1, WWHN-182 QA2, and WWHN-183 BA G1 minutes must include pass/fail evidence.",
  },
  {
    id: "SERVICE-NORMALIZATION",
    level: "P1",
    status: "fe_guarded",
    owner: "FE1 + BE",
    requiredFix:
      "After BE locks contracts, reduce multi-field fallback normalization and update official TypeScript types/schema.",
  },
  {
    id: "VITE-VITEST-CONFIG-WARNING",
    level: "P1",
    status: "fe_guarded",
    owner: "FE1 + Tech Lead",
    requiredFix:
      "Track the non-blocking Vite/Vitest config-loader warning as a separate technical task if the toolchain upgrade requires it.",
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
