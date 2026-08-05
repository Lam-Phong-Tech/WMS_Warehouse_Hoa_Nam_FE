export type EvidenceStatus = "PENDING" | "PASS" | "FAIL";
export type BaGateDecision = "GO" | "CONDITIONAL_GO" | "NO_GO" | null;

export interface ExactHashEvidence {
  status: EvidenceStatus;
  sha256: string | null;
  actor: string | null;
  role: string | null;
}

export interface RuntimeScenarioEvidence {
  id:
    | "PERMISSION_DENY_403"
    | "IDEMPOTENCY_REPLAY"
    | "IDEMPOTENCY_CONFLICT"
    | "STALE_WRITE";
  status: EvidenceStatus;
  directApi: boolean;
  synthetic: boolean;
  authorizationRedacted: boolean;
}

export interface Wwhn153FinalEvidence {
  officialContract: ExactHashEvidence & {
    version: string | null;
    publisherAccounts: string[];
  };
  qa1Review: ExactHashEvidence & {
    reviewedSha256: string | null;
    constraintsResult: EvidenceStatus;
    errorContractResult: EvidenceStatus;
    testabilityResult: EvidenceStatus;
  };
  moduleSchema: ExactHashEvidence;
  independentConfirmation: ExactHashEvidence & {
    confirmedSha256: string | null;
  };
  qa2Runtime: {
    status: EvidenceStatus;
    executor: string | null;
    role: string | null;
    sourceSha: string | null;
    buildId: string | null;
    environment: string | null;
    artifactDigest: string | null;
    scenarios: RuntimeScenarioEvidence[];
  };
  permissionApproval: {
    status: EvidenceStatus;
    backendApprover: string | null;
    businessApprover: string | null;
    sourceSha: string | null;
    buildId: string | null;
  };
  baMinutes: {
    status: EvidenceStatus;
    decision: BaGateDecision;
    decidedBy: string | null;
    role: string | null;
    sourceSha: string | null;
    artifactDigest: string | null;
    openP0: number | null;
    openP1: number | null;
  };
}

export interface Wwhn153FinalDecision {
  finalAllowed: boolean;
  status: "FINAL_GO" | "CONDITIONAL_PASS_FAIL_CLOSED";
  blockers: string[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/u;
const REQUIRED_SCENARIOS = [
  "PERMISSION_DENY_403",
  "IDEMPOTENCY_REPLAY",
  "IDEMPOTENCY_CONFLICT",
  "STALE_WRITE",
] as const;

function normalized(value: string | null): string | null {
  return value?.trim().toLowerCase() || null;
}

/**
 * Pure fail-closed policy. The function never trusts a source-controlled
 * `finalAllowed` flag; authorization is derived from independent evidence.
 */
export function evaluateWwhn153FinalSignoff(
  evidence: Wwhn153FinalEvidence,
): Wwhn153FinalDecision {
  const blockers: string[] = [];
  const official = evidence.officialContract;
  const qa1 = evidence.qa1Review;
  const schema = evidence.moduleSchema;
  const confirmation = evidence.independentConfirmation;
  const runtime = evidence.qa2Runtime;
  const permissions = evidence.permissionApproval;
  const minutes = evidence.baMinutes;

  if (official.status !== "PASS") blockers.push("WWHN-31_NOT_PASS");
  if (!official.version?.trim()) blockers.push("WWHN-31_VERSION_MISSING");
  if (!official.sha256 || !SHA256_PATTERN.test(official.sha256)) {
    blockers.push("WWHN-31_SHA256_INVALID");
  }
  const publishers = new Set(
    official.publisherAccounts
      .map((account) => normalized(account))
      .filter(Boolean),
  );
  if (publishers.size < 2) {
    blockers.push("WWHN-31_BE1_BE2_PUBLISHERS_INCOMPLETE");
  }

  if (qa1.status !== "PASS") blockers.push("WWHN-152_NOT_PASS");
  if (normalized(qa1.role) !== "qa1") blockers.push("WWHN-152_ROLE_INVALID");
  if (!qa1.reviewedSha256 || qa1.reviewedSha256 !== official.sha256) {
    blockers.push("WWHN-152_EXACT_HASH_MISMATCH");
  }
  if (normalized(qa1.actor) && publishers.has(normalized(qa1.actor))) {
    blockers.push("WWHN-152_REVIEWER_NOT_INDEPENDENT");
  }
  if (
    qa1.constraintsResult !== "PASS" ||
    qa1.errorContractResult !== "PASS" ||
    qa1.testabilityResult !== "PASS"
  ) {
    blockers.push("WWHN-152_REVIEW_DIMENSIONS_NOT_PASS");
  }

  if (schema.status !== "PASS") blockers.push("WWHN-151_NOT_PASS");
  if (!schema.sha256 || !SHA256_PATTERN.test(schema.sha256)) {
    blockers.push("WWHN-151_SHA256_INVALID");
  }
  if (normalized(schema.role) !== "be2") {
    blockers.push("WWHN-151_PUBLISHER_ROLE_INVALID");
  }

  if (confirmation.status !== "PASS") blockers.push("WWHN-180_NOT_PASS");
  if (confirmation.confirmedSha256 !== official.sha256) {
    blockers.push("WWHN-180_EXACT_HASH_MISMATCH");
  }
  if (
    normalized(confirmation.actor) &&
    publishers.has(normalized(confirmation.actor))
  ) {
    blockers.push("WWHN-180_REVIEWER_NOT_INDEPENDENT");
  }

  if (runtime.status !== "PASS") blockers.push("WWHN-182_NOT_PASS");
  if (normalized(runtime.role) !== "qa2") {
    blockers.push("WWHN-182_ROLE_INVALID");
  }
  if (!runtime.sourceSha || !GIT_SHA_PATTERN.test(runtime.sourceSha)) {
    blockers.push("WWHN-182_SOURCE_SHA_INVALID");
  }
  if (!runtime.buildId?.trim()) blockers.push("WWHN-182_BUILD_ID_MISSING");
  if (!runtime.artifactDigest || !SHA256_PATTERN.test(runtime.artifactDigest)) {
    blockers.push("WWHN-182_ARTIFACT_DIGEST_INVALID");
  }
  if (
    !runtime.environment ||
    /^(local|ci|mock|test)$/iu.test(runtime.environment)
  ) {
    blockers.push("WWHN-182_ENVIRONMENT_INVALID");
  }
  const scenarios = new Map(
    runtime.scenarios.map((scenario) => [scenario.id, scenario]),
  );
  for (const id of REQUIRED_SCENARIOS) {
    const scenario = scenarios.get(id);
    if (
      !scenario ||
      scenario.status !== "PASS" ||
      scenario.directApi !== true ||
      scenario.synthetic !== false ||
      scenario.authorizationRedacted !== true
    ) {
      blockers.push(`WWHN-182_${id}_INVALID`);
    }
  }

  if (permissions.status !== "PASS") {
    blockers.push("PERMISSION_APPROVAL_NOT_PASS");
  }
  if (!normalized(permissions.backendApprover)) {
    blockers.push("PERMISSION_BE_APPROVER_MISSING");
  }
  if (!normalized(permissions.businessApprover)) {
    blockers.push("PERMISSION_BA_APPROVER_MISSING");
  }
  if (
    normalized(permissions.backendApprover) &&
    normalized(permissions.backendApprover) ===
      normalized(permissions.businessApprover)
  ) {
    blockers.push("PERMISSION_APPROVERS_NOT_INDEPENDENT");
  }
  if (
    permissions.sourceSha !== runtime.sourceSha ||
    permissions.buildId !== runtime.buildId
  ) {
    blockers.push("PERMISSION_RUNTIME_BUILD_MISMATCH");
  }

  if (minutes.status !== "PASS") blockers.push("WWHN-183_NOT_PASS");
  if (minutes.decision !== "GO") blockers.push("WWHN-183_DECISION_NOT_GO");
  if (normalized(minutes.role) !== "ba") blockers.push("WWHN-183_ROLE_INVALID");
  if (minutes.sourceSha !== runtime.sourceSha) {
    blockers.push("WWHN-183_SOURCE_SHA_MISMATCH");
  }
  if (minutes.artifactDigest !== runtime.artifactDigest) {
    blockers.push("WWHN-183_ARTIFACT_DIGEST_MISMATCH");
  }
  if (minutes.openP0 !== 0) blockers.push("WWHN-183_OPEN_P0_NONZERO");
  if (minutes.openP1 !== 0) blockers.push("WWHN-183_OPEN_P1_NONZERO");

  return {
    finalAllowed: blockers.length === 0,
    status: blockers.length === 0 ? "FINAL_GO" : "CONDITIONAL_PASS_FAIL_CLOSED",
    blockers,
  };
}

export function assertWwhn153FinalSignoff(
  evidence: Wwhn153FinalEvidence,
): void {
  const decision = evaluateWwhn153FinalSignoff(evidence);
  if (!decision.finalAllowed) {
    throw new Error(
      `WWHN-153 final sign-off blocked: ${decision.blockers.join(", ")}`,
    );
  }
}
