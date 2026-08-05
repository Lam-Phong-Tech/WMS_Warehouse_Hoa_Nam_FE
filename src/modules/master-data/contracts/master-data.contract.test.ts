import { describe, expect, it } from "vitest";
import {
  MASTER_DATA_CONTRACT,
  MasterDataContractBlockedError,
  assertMasterDataContractApproved,
  getMasterDataContract,
  isMasterDataContractApproved,
} from "@/modules/master-data/contracts/master-data.contract";

const blockedCapabilities = [
  ["ITEM_LIST", "/items"],
  ["PHYSICAL_CODE_LIST", "/physical-codes"],
  ["SKU_IMPORT", "/skus/import-excel"],
] as const;

describe("WWHN-178 master-data contract gate", () => {
  it("keeps published product and reference capabilities enabled", () => {
    expect(isMasterDataContractApproved("PRODUCT_LIST")).toBe(true);
    expect(isMasterDataContractApproved("PRODUCT_CREATE")).toBe(true);
    expect(isMasterDataContractApproved("PRODUCT_STATUS")).toBe(true);
    expect(isMasterDataContractApproved("PRODUCT_CATEGORY")).toBe(true);
    expect(isMasterDataContractApproved("REFERENCE_UOM")).toBe(true);
    expect(isMasterDataContractApproved("REFERENCE_SUPPLIER")).toBe(true);
  });

  it.each(blockedCapabilities)(
    "fails closed for %s before HTTP integration",
    (capability, path) => {
      expect(isMasterDataContractApproved(capability)).toBe(false);
      expect(() => assertMasterDataContractApproved(capability)).toThrow(
        MasterDataContractBlockedError,
      );

      try {
        assertMasterDataContractApproved(capability);
      } catch (error) {
        expect(error).toMatchObject({
          name: "MasterDataContractBlockedError",
          code: "WMS_FE_CONTRACT_NOT_APPROVED",
          capability,
          contractPath: path,
        });
        expect((error as Error).message).toContain(path);
        expect((error as MasterDataContractBlockedError).issueRefs).toEqual(
          expect.arrayContaining(["WWHN-14", "WWHN-36", "WWHN-37", "WWHN-171"]),
        );
      }
    },
  );

  it("requires baseline, contract, authorization and QA evidence", () => {
    const importGate = getMasterDataContract("SKU_IMPORT");

    expect(importGate.baselineIssues).toEqual(
      expect.arrayContaining([
        "WWHN-14",
        "WWHN-100",
        "WWHN-101",
        "WWHN-36",
        "WWHN-37",
        "WWHN-171",
      ]),
    );
    expect(importGate.requiredEvidence.join(" ")).toMatch(/atomicity/i);
    expect(importGate.requiredEvidence.join(" ")).toMatch(/403/i);
    expect(importGate.requiredEvidence.join(" ")).toMatch(/QA2/i);
  });

  it("does not expose mutable contract entries at runtime", () => {
    expect(Object.isFrozen(MASTER_DATA_CONTRACT)).toBe(true);
    expect(Object.keys(MASTER_DATA_CONTRACT)).toHaveLength(9);
  });
});
