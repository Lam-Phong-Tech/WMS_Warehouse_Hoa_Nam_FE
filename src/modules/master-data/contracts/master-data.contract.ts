export type MasterDataCapability =
  | "PRODUCT_LIST"
  | "PRODUCT_CREATE"
  | "PRODUCT_STATUS"
  | "PRODUCT_CATEGORY"
  | "REFERENCE_UOM"
  | "REFERENCE_SUPPLIER"
  | "ITEM_LIST"
  | "PHYSICAL_CODE_LIST"
  | "SKU_IMPORT";

export type MasterDataContractStatus =
  | "APPROVED"
  | "PENDING_BA_BASELINE"
  | "PENDING_BE_CONTRACT";

export interface MasterDataContractEntry {
  capability: MasterDataCapability;
  status: MasterDataContractStatus;
  approved: boolean;
  method: "GET" | "POST" | "PATCH";
  path: string;
  permissionAny: readonly string[];
  baselineIssues: readonly string[];
  requiredEvidence: readonly string[];
  reason?: string;
}

const APPROVED_PRODUCT_EVIDENCE = [
  "OpenAPI path and payload published for /products",
  "FE mapping covered by master-data.service.test.ts",
] as const;

export const MASTER_DATA_CONTRACT: Readonly<
  Record<MasterDataCapability, MasterDataContractEntry>
> = Object.freeze({
  PRODUCT_LIST: {
    capability: "PRODUCT_LIST",
    status: "APPROVED",
    approved: true,
    method: "GET",
    path: "/products",
    permissionAny: ["sku.manage", "master.manage"],
    baselineIssues: ["WWHN-14", "WWHN-36", "WWHN-37", "WWHN-171"],
    requiredEvidence: APPROVED_PRODUCT_EVIDENCE,
  },
  PRODUCT_CREATE: {
    capability: "PRODUCT_CREATE",
    status: "APPROVED",
    approved: true,
    method: "POST",
    path: "/products",
    permissionAny: ["sku.manage", "master.manage"],
    baselineIssues: ["WWHN-14", "WWHN-36", "WWHN-37", "WWHN-171"],
    requiredEvidence: APPROVED_PRODUCT_EVIDENCE,
  },
  PRODUCT_STATUS: {
    capability: "PRODUCT_STATUS",
    status: "APPROVED",
    approved: true,
    method: "PATCH",
    path: "/products/:id/enable|disable",
    permissionAny: ["sku.manage", "master.manage"],
    baselineIssues: ["WWHN-14", "WWHN-36", "WWHN-37", "WWHN-171"],
    requiredEvidence: APPROVED_PRODUCT_EVIDENCE,
  },
  PRODUCT_CATEGORY: {
    capability: "PRODUCT_CATEGORY",
    status: "APPROVED",
    approved: true,
    method: "GET",
    path: "/product-categories",
    permissionAny: ["master.manage"],
    baselineIssues: ["WWHN-14", "WWHN-36", "WWHN-37", "WWHN-171"],
    requiredEvidence: [
      "OpenAPI path and payload published for /product-categories",
    ],
  },
  REFERENCE_UOM: {
    capability: "REFERENCE_UOM",
    status: "APPROVED",
    approved: true,
    method: "GET",
    path: "/uoms",
    permissionAny: ["sku.manage", "master.manage"],
    baselineIssues: ["WWHN-36", "WWHN-37", "WWHN-171"],
    requiredEvidence: ["OpenAPI path and payload published for /uoms"],
  },
  REFERENCE_SUPPLIER: {
    capability: "REFERENCE_SUPPLIER",
    status: "APPROVED",
    approved: true,
    method: "GET",
    path: "/suppliers",
    permissionAny: ["sku.manage", "master.manage"],
    baselineIssues: ["WWHN-36", "WWHN-37", "WWHN-171"],
    requiredEvidence: ["OpenAPI path and payload published for /suppliers"],
  },
  ITEM_LIST: {
    capability: "ITEM_LIST",
    status: "PENDING_BE_CONTRACT",
    approved: false,
    method: "GET",
    path: "/items",
    permissionAny: ["master.manage"],
    baselineIssues: [
      "WWHN-14",
      "WWHN-100",
      "WWHN-101",
      "WWHN-36",
      "WWHN-37",
      "WWHN-171",
    ],
    requiredEvidence: [
      "BA/BAS baseline field and item semantics",
      "Official OpenAPI/Postman endpoint, payload, error and permission",
      "QA2 executable UI and validation evidence on exact build",
    ],
    reason: "/items is not in OpenAPI (approved contract).",
  },
  PHYSICAL_CODE_LIST: {
    capability: "PHYSICAL_CODE_LIST",
    status: "PENDING_BE_CONTRACT",
    approved: false,
    method: "GET",
    path: "/physical-codes",
    permissionAny: ["master.manage"],
    baselineIssues: [
      "WWHN-14",
      "WWHN-100",
      "WWHN-101",
      "WWHN-36",
      "WWHN-37",
      "WWHN-171",
    ],
    requiredEvidence: [
      "BA/BAS baseline physical-code identity and duplicate semantics",
      "Official OpenAPI/Postman endpoint, payload, error and permission",
      "QA2 executable UI and validation evidence on exact build",
    ],
    reason: "/physical-codes is not in OpenAPI (approved contract).",
  },
  SKU_IMPORT: {
    capability: "SKU_IMPORT",
    status: "PENDING_BE_CONTRACT",
    approved: false,
    method: "POST",
    path: "/skus/import-excel",
    permissionAny: ["sku.manage", "master.manage"],
    baselineIssues: [
      "WWHN-14",
      "WWHN-100",
      "WWHN-101",
      "WWHN-36",
      "WWHN-37",
      "WWHN-171",
    ],
    requiredEvidence: [
      "BA/BAS baseline file format, row validation and atomicity rule",
      "Official OpenAPI/Postman endpoint, multipart payload and result schema",
      "Backend 403, validation and data-scope evidence",
      "QA2 import evidence on exact build",
    ],
    reason: "/skus/import-excel is not in OpenAPI (approved contract).",
  },
});

export class MasterDataContractBlockedError extends Error {
  readonly code = "WMS_FE_CONTRACT_NOT_APPROVED";
  readonly capability: MasterDataCapability;
  readonly contractPath: string;
  readonly issueRefs: readonly string[];

  constructor(entry: MasterDataContractEntry) {
    super(
      `${entry.reason ?? `${entry.path} is not approved.`} ` +
        `Blocked capability ${entry.capability}; evidence owner issues: ${entry.baselineIssues.join(
          ", ",
        )}.`,
    );
    this.name = "MasterDataContractBlockedError";
    this.capability = entry.capability;
    this.contractPath = entry.path;
    this.issueRefs = entry.baselineIssues;
  }
}

export function getMasterDataContract(
  capability: MasterDataCapability,
): MasterDataContractEntry {
  return MASTER_DATA_CONTRACT[capability];
}

export function isMasterDataContractApproved(
  capability: MasterDataCapability,
): boolean {
  return getMasterDataContract(capability).approved;
}

export function assertMasterDataContractApproved(
  capability: MasterDataCapability,
): MasterDataContractEntry {
  const entry = getMasterDataContract(capability);
  if (!entry.approved) {
    throw new MasterDataContractBlockedError(entry);
  }
  return entry;
}
