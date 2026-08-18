import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WWHN-233 / DISP-STK-233 — FE half of the count/recount deferral lock.
 *
 * `WWHN-59` → `WWHN-233` → `WWHN-235` carries the AC for count / recount / partial /
 * stale of a stocktake session. `REQ-SRS-037` ("Must") in the adopted SRS/FRD v1.12
 * baseline forbids that whole surface, so the disposition is DEFERRED — NO CODE and the
 * obligation for this MVP is negative.
 *
 * Complements rather than repeats `wwhn-230-stocktake-scope-guard.test.ts` (scope of the
 * Stocktake core) and `wms-contract-signoff-guards.test.ts` (permission surface). What is
 * locked here is specific to WWHN-233:
 *
 *   1. the count/recount fragments a `stocktake`-only filter does not catch;
 *   2. ANTI-DANGLING — every FE gate the disposition promises is a real file. This is the
 *      root cause of the 34/100 review: `DISP-STK-236` §5 described four guard artifacts,
 *      none of which existed on `m1` when WWHN-233 audited them;
 *   3. PIN ROT — the digests recorded in the governance register match the files on disk.
 *      `wwhn-296:verify` deliberately downgrades corroborating drift to a note, which let
 *      the ERD digest go stale unnoticed (DEV233-P1-03).
 *
 * BE half: `tests/Feature/Wwhn233CountDeferredGateTest.php`.
 */

const DISPOSITION_PATH = "docs/api-evidence/WWHN-233_DEFERRAL_DISPOSITION.json";
const GOVERNANCE_PATH = "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json";

/**
 * The last three fragments are WWHN-233's own contribution: a screen or endpoint that
 * recounts stock does not necessarily carry the word `stocktake` or `adjustment`.
 */
const COUNT_FRAGMENTS = ["recount", "cycle-count", "physical-count"];
const ALL_FORBIDDEN = [
  "stocktake",
  "adjustment",
  "variance",
  ...COUNT_FRAGMENTS,
];

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(read(path)) as T;
}

function sha256(path: string): string {
  return createHash("sha256")
    .update(readFileSync(join(process.cwd(), path)))
    .digest("hex");
}

interface Disposition {
  id: string;
  task: string;
  parent: string;
  qaGate: string;
  status: string;
  effectiveDate: string | null;
  optionChosen: string;
  controllingRequirement: string;
  qaGateDisposition: string;
  impactedIssues: string[];
  gates: string[];
  forbiddenPathFragments: string[];
  antiDanglingRule?: { enforcement?: string };
  reintroductionGate: string;
}

describe("WWHN-233 — count/recount stays out of the FE runtime surface", () => {
  it("exposes no count, recount or variance route, permission or endpoint", async () => {
    const { ROUTES } = await import("@/shared/constants/routes");
    const { WMS_PERMISSION_CATALOG } =
      await import("@/shared/constants/wms-permissions");
    const endpoints = await import("@/shared/api/endpoints");

    const routeValues = Object.values(ROUTES).filter(
      (value) => typeof value === "string",
    );
    for (const fragment of ALL_FORBIDDEN) {
      expect(
        routeValues.filter((path) => path.toLowerCase().includes(fragment)),
        `route path containing [${fragment}]`,
      ).toEqual([]);
    }
    expect(Object.keys(ROUTES)).not.toContain("STOCKTAKE");
    expect(Object.keys(ROUTES)).not.toContain("RECOUNT");

    const permissionCodes = Object.values(WMS_PERMISSION_CATALOG)
      .flatMap((group) =>
        Array.isArray(group) ? group : Object.values(group ?? {}),
      )
      .filter((code): code is string => typeof code === "string");
    for (const fragment of ALL_FORBIDDEN) {
      expect(
        permissionCodes.filter((code) => code.toLowerCase().includes(fragment)),
        `permission containing [${fragment}]`,
      ).toEqual([]);
    }

    const endpointValues = JSON.stringify(endpoints).toLowerCase();
    for (const fragment of ALL_FORBIDDEN) {
      expect(
        endpointValues.includes(`/${fragment}`),
        `endpoint path containing [${fragment}]`,
      ).toBe(false);
    }
  });

  it("records the disposition without claiming an approval Jira has not granted", () => {
    const disposition = readJson<Disposition>(DISPOSITION_PATH);

    expect(disposition.id).toBe("DISP-STK-233");
    expect(disposition.task).toBe("WWHN-233");
    expect(disposition.parent).toBe("WWHN-59");
    expect(disposition.qaGate).toBe("WWHN-235");
    expect(disposition.controllingRequirement).toBe("REQ-SRS-037");
    expect(disposition.optionChosen).toBe("DEFERRED_NO_CODE");
    expect(disposition.impactedIssues).toEqual(
      expect.arrayContaining(["WWHN-59", "WWHN-233", "WWHN-235", "WWHN-25"]),
    );

    // WWHN-235 must not sit in an open-ended Blocked/Pending state: there is nothing to
    // unblock while REQ-SRS-037 excludes the capability.
    expect(disposition.qaGateDisposition).toMatch(/DEFERRED \/ N\/A/u);

    // A scope disposition is not an approval of DEC-STK-001. While WWHN-25 is open it may
    // not carry an effective date.
    if (disposition.status !== "APPROVED") {
      expect(disposition.effectiveDate).toBeNull();
    }

    // Re-opening requires the same four conditions as the parallel WWHN-60/236 branch, so
    // the two halves of the Stocktake chain cannot drift apart.
    expect(disposition.reintroductionGate).toMatch(/Change Request/u);
    expect(disposition.reintroductionGate).toMatch(/WWHN-25/u);
    expect(disposition.reintroductionGate).toMatch(/REQ-SRS-037/u);
  });

  it("covers the count fragments a stocktake-only filter would miss", () => {
    const disposition = readJson<Disposition>(DISPOSITION_PATH);
    for (const fragment of COUNT_FRAGMENTS) {
      expect(disposition.forbiddenPathFragments).toContain(fragment);
    }
  });

  it("proves every FE guard the disposition promises is a real file (ANTI-DANGLING)", () => {
    const disposition = readJson<Disposition>(DISPOSITION_PATH);

    const feGates = disposition.gates
      .filter((gate) => gate.startsWith("FE "))
      .map((gate) => gate.slice(3));

    expect(feGates.length).toBeGreaterThan(0);
    for (const gate of feGates) {
      expect(
        existsSync(join(process.cwd(), gate)),
        `promised FE guard missing: ${gate}`,
      ).toBe(true);
    }

    expect(disposition.antiDanglingRule?.enforcement).toBeTruthy();

    // The shared governance register must point at this file, so the disposition cannot
    // be orphaned by a later edit to the register.
    const governance = readJson<{
      deferralDispositionPointers?: { dispositionId: string; file: string }[];
    }>(GOVERNANCE_PATH);
    const pointer = (governance.deferralDispositionPointers ?? []).find(
      (entry) => entry.dispositionId === "DISP-STK-233",
    );
    expect(pointer?.file).toBe(DISPOSITION_PATH);
  });

  it("keeps the governance register digests in step with the files on disk (PIN ROT)", () => {
    const governance = readJson<{
      ruleAuthority: {
        controllingBaseline: { repositoryPath: string; sha256: string };
        corroboratingBaselines: { repositoryPath: string; sha256: string }[];
      };
    }>(GOVERNANCE_PATH);

    const pinned = [
      governance.ruleAuthority.controllingBaseline,
      ...governance.ruleAuthority.corroboratingBaselines,
    ];

    for (const entry of pinned) {
      expect(
        sha256(entry.repositoryPath),
        `${entry.repositoryPath} drifted from the digest recorded in the governance register`,
      ).toBe(entry.sha256);
    }
  });

  it("keeps the baselines the guard leans on saying what it enforces", () => {
    const srs = read("docs/HN_SRS_FRD_v1.12_FULL.md");
    expect(srs).toContain("REQ-SRS-037");
    expect(srs).toContain("Không expose Stocktake/Variance");

    const erd = read("docs/HoaNam_ERD_Moi_Nhat.md");
    expect(erd).toContain("Không tạo Stocktake_Session");

    const wireframe = read(
      "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html",
    );
    expect(wireframe.toLowerCase().includes("stocktake")).toBe(false);
    expect(wireframe.toLowerCase().includes("kiểm kê")).toBe(false);
  });
});
