import { describe, expect, it } from "vitest";
import {
  evaluateWwhn153FinalSignoff,
  type RuntimeScenarioEvidence,
  type Wwhn153FinalEvidence,
} from "@/shared/api/wwhn-153-final-signoff";

const H = "a".repeat(64);
const H2 = "b".repeat(64);
const SOURCE = "1".repeat(40);
const PARENT = "2".repeat(40);
const TREE = "3".repeat(40);

function scenario(id: RuntimeScenarioEvidence["id"]): RuntimeScenarioEvidence {
  const effect =
    id === "IDEMPOTENCY_CONFLICT" || id === "PERMISSION_CATALOG"
      ? null
      : id === "IDEMPOTENCY_REPLAY"
        ? {
            status: "PASS" as const,
            beforeHash: H,
            afterHash: H2,
            afterFirstHash: H2,
            afterReplayHash: H2,
            secondSideEffectCreated: false,
          }
        : {
            status: "PASS" as const,
            beforeHash: H,
            afterHash: H,
            sideEffectCreated: false,
          };
  return {
    id,
    status: "PASS",
    directApi: true,
    synthetic: false,
    authorizationRedacted: true,
    requestId: `req-${id}`,
    requestArtifactSha256: H,
    responseArtifactSha256: id === "PERMISSION_CATALOG" ? H2 : H,
    sameBusinessResult: id === "IDEMPOTENCY_REPLAY" ? true : undefined,
    secondSideEffectCreated: id === "IDEMPOTENCY_REPLAY" ? false : undefined,
    effectProof: effect,
  };
}

function validEvidence(): Wwhn153FinalEvidence {
  return {
    sourceProvenance: {
      status: "PASS",
      repository: "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
      branch: "m1",
      sourceSha: SOURCE,
      executionSha: SOURCE,
      parentSha: PARENT,
      expectedParentSha: PARENT,
      treeSha: TREE,
      workflowRunId: "123",
      workflowRunUrl: "https://github.com/run/123",
      artifactName: `wwhn-153-signoff-integrity-${SOURCE}`,
    },
    officialContract: {
      status: "PASS",
      sha256: H,
      actor: "be1",
      role: "be1",
      version: "1.0.0",
      publisherAccounts: ["be1", "be2"],
    },
    qa1Review: {
      status: "PASS",
      sha256: H,
      actor: "qa1",
      role: "qa1",
      reviewedSha256: H,
      reviewedModuleSha256: H2,
      constraintsResult: "PASS",
      errorContractResult: "PASS",
      testabilityResult: "PASS",
    },
    moduleSchema: {
      status: "PASS",
      sha256: H2,
      actor: "be2",
      role: "be2",
    },
    independentConfirmation: {
      status: "PASS",
      sha256: H,
      actor: "independent",
      role: "qa",
      confirmedSha256: H,
    },
    qa2Runtime: {
      status: "PASS",
      executor: "qa2",
      role: "qa2",
      sourceSha: SOURCE,
      buildId: "build-1",
      environment: "UAT",
      artifactDigest: H,
      sha256SumsSha256: H2,
      scenarios: [
        scenario("PERMISSION_DENY_403"),
        scenario("IDEMPOTENCY_REPLAY"),
        scenario("IDEMPOTENCY_CONFLICT"),
        scenario("STALE_WRITE"),
        scenario("PERMISSION_CATALOG"),
      ],
    },
    permissionApproval: {
      status: "PASS",
      backendApprover: "be-rbac",
      businessApprover: "ba",
      frontendApprover: "fe",
      sourceSha: SOURCE,
      buildId: "build-1",
      artifactDigest: H,
      runtimeCatalogSha256: H2,
    },
    baMinutes: {
      status: "PASS",
      decision: "GO",
      decidedBy: "ba",
      role: "ba",
      sourceSha: SOURCE,
      artifactDigest: H,
      openP0: 0,
      openP1: 0,
    },
  };
}

describe("WWHN-153 derived final sign-off", () => {
  it("allows final only when the entire exact-hash chain passes", () => {
    expect(evaluateWwhn153FinalSignoff(validEvidence())).toEqual({
      finalAllowed: true,
      status: "FINAL_GO",
      blockers: [],
    });
  });

  it("blocks a stale or unrelated FE source", () => {
    const evidence = validEvidence();
    evidence.sourceProvenance.parentSha = "9".repeat(40);
    expect(evaluateWwhn153FinalSignoff(evidence).blockers).toContain(
      "FE_PARENT_SHA_MISMATCH",
    );
  });

  it("blocks idempotency evidence without measured side-effect stability", () => {
    const evidence = validEvidence();
    const replay = evidence.qa2Runtime.scenarios.find(
      (item) => item.id === "IDEMPOTENCY_REPLAY",
    )!;
    replay.effectProof!.afterReplayHash = H;
    expect(evaluateWwhn153FinalSignoff(evidence).blockers).toContain(
      "WWHN-182_IDEMPOTENCY_REPLAY_INVALID",
    );
  });

  it("blocks permission approval not bound to the runtime catalog response", () => {
    const evidence = validEvidence();
    evidence.permissionApproval.runtimeCatalogSha256 = H;
    expect(evaluateWwhn153FinalSignoff(evidence).blockers).toContain(
      "PERMISSION_CATALOG_HASH_MISMATCH",
    );
  });

  it("rejects CONDITIONAL_GO", () => {
    const evidence = validEvidence();
    evidence.baMinutes.decision = "CONDITIONAL_GO";
    expect(evaluateWwhn153FinalSignoff(evidence).finalAllowed).toBe(false);
  });
});
