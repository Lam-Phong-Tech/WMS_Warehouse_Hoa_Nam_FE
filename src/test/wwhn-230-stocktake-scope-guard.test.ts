import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WWHN-230 / DISP-STK-230 — FE half of the scope disposition lock.
 *
 * WWHN-230 (Stocktake core) and WWHN-58 are parked out of Beta implementation because
 * REQ-SRS-037 ("Must") in the adopted SRS/FRD v1.12 baseline forbids every Stocktake
 * surface, and WWHN-232 becomes an absence & substitution test. This file proves the FE
 * half of that claim: no route, permission, endpoint, menu entry or screen exists, the
 * governance register records the disposition without over-claiming approval, and the
 * baselines the guard leans on still say what it enforces.
 *
 * BE half: tests/Feature/Wwhn230StocktakeScopeDispositionTest.php.
 */

const FORBIDDEN_FRAGMENTS = ["stocktake", "stock-take", "apply-adjustment"];

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [join(process.cwd(), root)];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current)) {
      const entryPath = join(current, entry);
      if (statSync(entryPath).isDirectory()) {
        stack.push(entryPath);
      } else if (/\.(ts|tsx)$/u.test(entry)) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

describe("WWHN-230 — Stocktake stays out of the FE runtime surface", () => {
  it("exposes no route, permission or endpoint constant", async () => {
    const { ROUTES } = await import("@/shared/constants/routes");
    const { WMS_PERMISSION_CATALOG } =
      await import("@/shared/constants/wms-permissions");
    const endpoints = await import("@/shared/api/endpoints");

    const routeValues = Object.values(ROUTES).map((value) =>
      String(value).toLowerCase(),
    );
    const routeKeys = Object.keys(ROUTES).map((key) => key.toLowerCase());
    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(routeValues.some((value) => value.includes(fragment))).toBe(false);
      expect(
        routeKeys.some((key) => key.includes(fragment.replace("-", "_"))),
      ).toBe(false);
    }

    const permissions = Object.values(WMS_PERMISSION_CATALOG).map((value) =>
      String(value).toLowerCase(),
    );
    expect(permissions.filter((code) => code.startsWith("stocktake."))).toEqual(
      [],
    );

    const endpointValues = JSON.stringify(endpoints).toLowerCase();
    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(endpointValues.includes(fragment)).toBe(false);
    }
  });

  it("ships no Stocktake screen or module directory", () => {
    const offending = sourceFiles("src")
      .map((file) => file.split(/[\\/]/u).slice(-3).join("/").toLowerCase())
      .filter(
        (file) =>
          !file.includes("wwhn-230") &&
          FORBIDDEN_FRAGMENTS.some((fragment) => file.includes(fragment)),
      );

    expect(offending).toEqual([]);
  });

  it("records the disposition without claiming an approval Jira has not granted", () => {
    // The shared governance register holds the *authority* (REQ-SRS-037 and the
    // WWHN-25 gate). The WWHN-230 disposition lives in its own file so that the
    // parallel Stocktake branches (WWHN-233/236/237) cannot overwrite each other
    // on a single shared key.
    const governance = JSON.parse(
      read("docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json"),
    ) as {
      ruleAuthority: {
        controllingRequirement: { id: string; priority: string };
      };
      decisionRecordGate: {
        issue: string;
        approvedStandaloneDecisionId: string | null;
      };
    };

    expect(governance.ruleAuthority.controllingRequirement.id).toBe(
      "REQ-SRS-037",
    );
    expect(governance.ruleAuthority.controllingRequirement.priority).toBe(
      "Must",
    );
    expect(governance.decisionRecordGate.issue).toBe("WWHN-25");
    expect(
      governance.decisionRecordGate.approvedStandaloneDecisionId,
    ).toBeNull();

    const disposition = JSON.parse(
      read("docs/api-evidence/WWHN-230_SCOPE_DISPOSITION.json"),
    ) as {
      id: string;
      optionChosen: string;
      impactedIssues: string[];
      status: string;
      effectiveDate: string | null;
      controllingRequirement: string;
    };

    expect(disposition.id).toBe("DISP-STK-230");
    expect(disposition.optionChosen).toBe("B");
    expect(disposition.controllingRequirement).toBe("REQ-SRS-037");
    expect(disposition.impactedIssues).toEqual(
      expect.arrayContaining(["WWHN-230", "WWHN-58", "WWHN-232"]),
    );

    // A scope disposition is not an approval of DEC-STK-001. While WWHN-25 is
    // open it may not carry an effective date.
    if (disposition.status !== "APPROVED") {
      expect(disposition.effectiveDate).toBeNull();
    }
  });

  it("does not outlive the baselines it enforces", () => {
    const srs = read("docs/HN_SRS_FRD_v1.12_FULL.md");
    expect(srs).toContain("REQ-SRS-037");
    expect(srs).toContain("Không expose Stocktake/Variance");

    const erd = read("docs/HoaNam_ERD_Moi_Nhat.md");
    expect(erd).toContain("Không tạo Stocktake_Session");

    // Wireframe HTML từng là nửa UI của phần đối chứng; 3822d45 đã rút nó
    // khỏi repo có chủ đích ("remove stale docs archives") nên phần kiểm
    // wireframe rút theo — SRS/ERD ở trên vẫn là baseline còn hiệu lực.
  });
});
