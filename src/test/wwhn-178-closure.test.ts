import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("WWHN-178 immutable closure package", () => {
  it("publishes the machine-readable contract and owner boundaries", () => {
    const baseline = JSON.parse(
      read("docs/api-evidence/WWHN-178_MASTER_SKU_CONTRACT_BASELINE.json"),
    ) as {
      task: string;
      blockedCapabilities: Array<{
        capability: string;
        feStatus: string;
        requiredOwnerIssues: string[];
      }>;
      signoffBoundary: { feMustNotClaim: string[] };
    };

    expect(baseline.task).toBe("WWHN-178");
    expect(baseline.blockedCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "ITEM_LIST",
          feStatus: "FAIL_CLOSED",
        }),
        expect.objectContaining({
          capability: "PHYSICAL_CODE_LIST",
          feStatus: "FAIL_CLOSED",
        }),
        expect.objectContaining({
          capability: "SKU_IMPORT",
          feStatus: "FAIL_CLOSED",
        }),
      ]),
    );
    expect(
      baseline.blockedCapabilities.flatMap(
        (capability) => capability.requiredOwnerIssues,
      ),
    ).toEqual(
      expect.arrayContaining([
        "WWHN-14",
        "WWHN-100",
        "WWHN-101",
        "WWHN-36",
        "WWHN-37",
        "WWHN-171",
      ]),
    );
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
      "contract-fail-closed",
      "route-rbac-deny",
      "1440",
      "768",
      "375",
    ]) {
      expect(e2e).toContain(token);
    }

    expect(directApi).toContain("expectedHttpStatus: 403");
    expect(directApi).toContain("Bearer ***REDACTED***");
    expect(directApi).toContain("data-scope-deny");
    expect(directApi).toContain("SOURCE_SHA");

    for (const token of [
      "WWHN-179",
      "HN-MC-001",
      "WWHN-14/100/101",
      "WWHN-36/37/171",
      "Backend authorization",
      "Trace PR / CI",
      "không tự nhận QA2 sign-off",
    ]) {
      expect(taskDoc).toContain(token);
    }
  });

  it("wires WWHN-178 evidence into mandatory CI outcomes", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const workflow = read(".github/workflows/ci.yml");
    const gate = read("scripts/assert-ci-gates.mjs");
    const manifest = read("scripts/collect-wms-runtime-evidence.mjs");

    expect(packageJson.scripts["test:e2e:wwhn-178"]).toContain(
      "wwhn-178-master-sku-qa2.spec.ts",
    );
    expect(packageJson.scripts["wwhn-178:rbac:contract"]).toContain(
      "--contract-only",
    );

    for (const token of [
      "Capture WWHN-178 Master/SKU QA2 evidence",
      "WWHN_178_RBAC_CONTRACT_OUTCOME",
      "WWHN_178_E2E_OUTCOME",
      "docs/evidence/wwhn-178",
    ]) {
      expect(workflow).toContain(token);
    }

    expect(gate).toContain("WWHN_178_RBAC_CONTRACT_OUTCOME");
    expect(gate).toContain("WWHN_178_E2E_OUTCOME");
    expect(manifest).toContain('"WWHN-178"');
    expect(manifest).toContain('"WWHN-179"');
  });
});
