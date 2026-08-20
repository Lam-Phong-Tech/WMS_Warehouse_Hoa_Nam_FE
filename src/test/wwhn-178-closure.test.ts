import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("WWHN-178 R2 closure package", () => {
  it("publishes the pinned-contract baseline and owner boundaries", () => {
    const baseline = JSON.parse(
      read("docs/api-evidence/WWHN-178_MASTER_SKU_CONTRACT_BASELINE.json"),
    ) as {
      task: string;
      blockedCapabilities: Array<{
        capability: string;
        feStatus: string;
        requiredOwnerIssues?: string[];
      }>;
      divergenceRegister: Array<{ id: number; topic: string }>;
      signoffBoundary: { feMustNotClaim: string[] };
    };

    expect(baseline.task).toBe("WWHN-178");
    // Endpoint ma (không route/spec BE) phải fail-closed vĩnh viễn — không
    // phải chờ owner sign-off vì không có gì để owner mở.
    expect(baseline.blockedCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "REFERENCE_UOM",
          feStatus: "FORBIDDEN_PHANTOM",
        }),
        expect.objectContaining({
          capability: "REFERENCE_SUPPLIER",
          feStatus: "FORBIDDEN_PHANTOM",
        }),
      ]),
    );
    // UI list còn thiếu baseline (item/physical-code trên MST-01) vẫn chờ
    // đúng 3 owner issue của HN-MC-001.
    expect(
      baseline.blockedCapabilities
        .filter((capability) => capability.requiredOwnerIssues)
        .flatMap((capability) => capability.requiredOwnerIssues ?? []),
    ).toEqual(expect.arrayContaining(["WWHN-14", "WWHN-100", "WWHN-101"]));
    expect(baseline.divergenceRegister.length).toBeGreaterThanOrEqual(8);
    expect(baseline.signoffBoundary.feMustNotClaim.join(" ")).toMatch(/QA2/i);
    expect(baseline.signoffBoundary.feMustNotClaim.join(" ")).toMatch(/BE/i);
  });

  it("keeps executable QA2 and direct API evidence packs traceable", () => {
    const e2e = read("e2e/wwhn-178-master-sku-qa2.spec.ts");
    const directApi = read("scripts/run-wwhn-178-direct-api-rbac.mjs");
    const taskDoc = read("docs/Task_docs_Jira/WWHN-178.md");

    for (const token of [
      "success-responsive",
      "loading-empty",
      "api-error-403",
      "validation-keyboard-focus",
      "import-modal-permission",
      "view-only-actions-hidden",
      "route-rbac-deny",
      "contract-boundary",
      "ACCESS_DENIED",
      "1440",
      "768",
      "375",
    ]) {
      expect(e2e).toContain(token);
    }

    expect(directApi).toContain("expectedStatus = 403");
    expect(directApi).toContain("Bearer ***REDACTED***");
    expect(directApi).toContain("data-scope-deny");
    expect(directApi).toContain("positive-control");
    expect(directApi).toContain("SOURCE_SHA");

    for (const token of [
      "WWHN-179",
      "HN-MC-001",
      "WWHN-14/100/101",
      "WWHN-36/37/171",
      "Backend authorization",
      "DEC-178-CI-LOCAL-01",
      "không tự nhận QA2 sign-off",
    ]) {
      expect(taskDoc).toContain(token);
    }
  });

  it("wires WWHN-178 evidence into mandatory local enforcement", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const verifyScript = read("scripts/verify-master-sku-closure.mjs");
    const register = JSON.parse(
      read("docs/evidence/wwhn-178/WWHN-178_CLOSURE_REGISTER.json"),
    ) as {
      schemaVersion: string;
      beContractPin?: { be_sha?: string; spec_sha256?: string };
      acceptancePolicy: { ciSubstitutionDecision?: string };
    };
    const contractPin = JSON.parse(
      read("docs/api-evidence/BE_CONTRACT_PIN.json"),
    ) as { be_sha: string; spec_sha256: string };

    expect(packageJson.scripts["test:e2e:wwhn-178"]).toContain(
      "wwhn-178-master-sku-qa2.spec.ts",
    );
    expect(packageJson.scripts["wwhn-178:rbac:contract"]).toContain(
      "--contract-only",
    );
    expect(packageJson.scripts["master-sku:verify"]).toContain(
      "verify-master-sku-closure.mjs",
    );

    expect(verifyScript).toContain("Phantom endpoint");
    expect(verifyScript).toContain("beContractPin");

    // Register phải khớp đúng pin thật — chống register rot (đây chính là lỗ
    // hổng khiến R1 PASS giả khi UI/import đã đổi thật).
    expect(register.schemaVersion).toBe("2.1.0");
    expect(register.beContractPin?.be_sha).toBe(contractPin.be_sha);
    expect(register.beContractPin?.spec_sha256).toBe(contractPin.spec_sha256);
    expect(register.acceptancePolicy.ciSubstitutionDecision).toBe(
      "DEC-178-CI-LOCAL-01",
    );
  });
});
