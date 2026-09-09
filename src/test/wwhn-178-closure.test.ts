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

  /*
   * 3822d45 (09/2026) chủ đích rút kho lưu trữ docs/evidence + Task_docs_Jira +
   * e2e spec khỏi repo ("remove stale docs/evidence + Task_docs_Jira archives").
   * Theo nguyên tắc của chính các gate này — guard không sống lâu hơn artefact
   * nó khoá — các test ĐỌC những artefact đã rút được gỡ theo tại đây; phần khoá
   * baseline/hợp đồng còn trong repo giữ nguyên hiệu lực.
   */

});
