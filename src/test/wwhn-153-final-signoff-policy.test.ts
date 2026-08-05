import { describe, expect, it } from "vitest";
import {
  assertWwhn153FinalSignoff,
  evaluateWwhn153FinalSignoff,
  type Wwhn153FinalEvidence,
} from "@/shared/api/wwhn-153-final-signoff";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const SOURCE_SHA = "c".repeat(40);

function validEvidence(): Wwhn153FinalEvidence {
  return {
    officialContract: {
      status: "PASS",
      sha256: HASH_A,
      actor: "be-release",
      role: "BE1+BE2",
      version: "wms-api-1.0.0",
      publisherAccounts: ["be1-account", "be2-account"],
    },
    qa1Review: {
      status: "PASS",
      sha256: HASH_B,
      actor: "qa1-account",
      role: "QA1",
      reviewedSha256: HASH_A,
      constraintsResult: "PASS",
      errorContractResult: "PASS",
      testabilityResult: "PASS",
    },
    moduleSchema: {
      status: "PASS",
      sha256: HASH_B,
      actor: "be2-account",
      role: "BE2",
    },
    independentConfirmation: {
      status: "PASS",
      sha256: HASH_B,
      actor: "independent-reviewer",
      role: "QA1",
      confirmedSha256: HASH_A,
    },
    qa2Runtime: {
      status: "PASS",
      executor: "qa2-account",
      role: "QA2",
      sourceSha: SOURCE_SHA,
      buildId: "build-123",
      environment: "UAT",
      artifactDigest: HASH_B,
      scenarios: [
        "PERMISSION_DENY_403",
        "IDEMPOTENCY_REPLAY",
        "IDEMPOTENCY_CONFLICT",
        "STALE_WRITE",
      ].map((id) => ({
        id: id as
          | "PERMISSION_DENY_403"
          | "IDEMPOTENCY_REPLAY"
          | "IDEMPOTENCY_CONFLICT"
          | "STALE_WRITE",
        status: "PASS",
        directApi: true,
        synthetic: false,
        authorizationRedacted: true,
      })),
    },
    permissionApproval: {
      status: "PASS",
      backendApprover: "be-rbac-account",
      businessApprover: "ba-account",
      sourceSha: SOURCE_SHA,
      buildId: "build-123",
    },
    baMinutes: {
      status: "PASS",
      decision: "GO",
      decidedBy: "ba-account",
      role: "BA",
      sourceSha: SOURCE_SHA,
      artifactDigest: HASH_B,
      openP0: 0,
      openP1: 0,
    },
  };
}

describe("WWHN-153 derived final sign-off", () => {
  it("allows final only when every independent exact-hash gate passes", () => {
    const result = evaluateWwhn153FinalSignoff(validEvidence());
    expect(result).toEqual({
      finalAllowed: true,
      status: "FINAL_GO",
      blockers: [],
    });
    expect(() => assertWwhn153FinalSignoff(validEvidence())).not.toThrow();
  });

  it("fails closed when QA1 reviews a different contract hash", () => {
    const evidence = validEvidence();
    evidence.qa1Review.reviewedSha256 = HASH_B;
    expect(evaluateWwhn153FinalSignoff(evidence)).toMatchObject({
      finalAllowed: false,
      blockers: expect.arrayContaining(["WWHN-152_EXACT_HASH_MISMATCH"]),
    });
  });

  it("fails closed for self-review, missing runtime cases or synthetic evidence", () => {
    const evidence = validEvidence();
    evidence.qa1Review.actor = "be1-account";
    evidence.qa2Runtime.scenarios = evidence.qa2Runtime.scenarios.slice(0, 3);
    evidence.qa2Runtime.scenarios[0].synthetic = true;
    const result = evaluateWwhn153FinalSignoff(evidence);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "WWHN-152_REVIEWER_NOT_INDEPENDENT",
        "WWHN-182_PERMISSION_DENY_403_INVALID",
        "WWHN-182_STALE_WRITE_INVALID",
      ]),
    );
  });

  it("does not treat Conditional Go or a non-zero P1 count as final approval", () => {
    const evidence = validEvidence();
    evidence.baMinutes.decision = "CONDITIONAL_GO";
    evidence.baMinutes.openP1 = 1;
    expect(() => assertWwhn153FinalSignoff(evidence)).toThrow(
      /WWHN-183_DECISION_NOT_GO.*WWHN-183_OPEN_P1_NONZERO/u,
    );
  });

  it("fails closed when permission approval targets another build", () => {
    const evidence = validEvidence();
    evidence.permissionApproval.buildId = "build-other";
    expect(evaluateWwhn153FinalSignoff(evidence).blockers).toContain(
      "PERMISSION_RUNTIME_BUILD_MISMATCH",
    );
  });
});
