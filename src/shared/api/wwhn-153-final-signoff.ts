export type EvidenceStatus = "PENDING" | "PASS" | "FAIL";
export type BaGateDecision = "GO" | "CONDITIONAL_GO" | "NO_GO" | null;

export interface ExactHashEvidence {
  status: EvidenceStatus;
  sha256: string | null;
  actor: string | null;
  role: string | null;
}

export interface RuntimeEffectProof {
  status: EvidenceStatus;
  beforeHash: string | null;
  afterHash: string | null;
  afterFirstHash?: string | null;
  afterReplayHash?: string | null;
  sideEffectCreated?: boolean;
  secondSideEffectCreated?: boolean;
}

export interface RuntimeScenarioEvidence {
  id:
    | "PERMISSION_DENY_403"
    | "IDEMPOTENCY_REPLAY"
    | "IDEMPOTENCY_CONFLICT"
    | "STALE_WRITE"
    | "PERMISSION_CATALOG";
  status: EvidenceStatus;
  directApi: boolean;
  synthetic: boolean;
  authorizationRedacted: boolean;
  requestId: string | null;
  requestArtifactSha256: string | null;
  responseArtifactSha256: string | null;
  sameBusinessResult?: boolean;
  secondSideEffectCreated?: boolean;
  effectProof?: RuntimeEffectProof | null;
}

export interface SourceProvenanceEvidence {
  status: EvidenceStatus;
  repository: string | null;
  branch: string | null;
  sourceSha: string | null;
  executionSha: string | null;
  parentSha: string | null;
  expectedParentSha: string | null;
  treeSha: string | null;
  workflowRunId: string | null;
  workflowRunUrl: string | null;
  artifactName: string | null;
}

export interface Wwhn153FinalEvidence {
  sourceProvenance: SourceProvenanceEvidence;
  officialContract: ExactHashEvidence & {
    version: string | null;
    publisherAccounts: string[];
  };
  qa1Review: ExactHashEvidence & {
    reviewedSha256: string | null;
    reviewedModuleSha256: string | null;
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
    sha256SumsSha256: string | null;
    scenarios: RuntimeScenarioEvidence[];
  };
  permissionApproval: {
    status: EvidenceStatus;
    backendApprover: string | null;
    businessApprover: string | null;
    frontendApprover: string | null;
    sourceSha: string | null;
    buildId: string | null;
    artifactDigest: string | null;
    runtimeCatalogSha256: string | null;
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
const REPOSITORY = "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE";
const REQUIRED_SCENARIOS = [
  "PERMISSION_DENY_403",
  "IDEMPOTENCY_REPLAY",
  "IDEMPOTENCY_CONFLICT",
  "STALE_WRITE",
  "PERMISSION_CATALOG",
] as const;

function normalized(value: string | null): string | null {
  return value?.trim().toLowerCase() || null;
}

function validHash(value: string | null): value is string {
  return Boolean(value && SHA256_PATTERN.test(value));
}

function effectProofValid(scenario: RuntimeScenarioEvidence): boolean {
  if (
    scenario.id === "IDEMPOTENCY_CONFLICT" ||
    scenario.id === "PERMISSION_CATALOG"
  ) {
    return true;
  }
  const proof = scenario.effectProof;
  if (
    !proof ||
    proof.status !== "PASS" ||
    !validHash(proof.beforeHash) ||
    !validHash(proof.afterHash)
  ) {
    return false;
  }
  if (scenario.id === "IDEMPOTENCY_REPLAY") {
    return (
      validHash(proof.afterFirstHash ?? null) &&
      validHash(proof.afterReplayHash ?? null) &&
      proof.afterFirstHash === proof.afterReplayHash &&
      proof.secondSideEffectCreated === false &&
      scenario.sameBusinessResult === true &&
      scenario.secondSideEffectCreated === false
    );
  }
  return (
    proof.beforeHash === proof.afterHash && proof.sideEffectCreated === false
  );
}

/** Derived fail-closed policy. No source-controlled boolean can authorize final. */
export function evaluateWwhn153FinalSignoff(
  evidence: Wwhn153FinalEvidence,
): Wwhn153FinalDecision {
  const blockers: string[] = [];
  const provenance = evidence.sourceProvenance;
  const official = evidence.officialContract;
  const qa1 = evidence.qa1Review;
  const schema = evidence.moduleSchema;
  const confirmation = evidence.independentConfirmation;
  const runtime = evidence.qa2Runtime;
  const permissions = evidence.permissionApproval;
  const minutes = evidence.baMinutes;

  if (provenance.status !== "PASS")
    blockers.push("FE_SOURCE_PROVENANCE_NOT_PASS");
  if (provenance.repository !== REPOSITORY || provenance.branch !== "m1") {
    blockers.push("FE_SOURCE_REPOSITORY_REF_MISMATCH");
  }
  if (!provenance.sourceSha || !GIT_SHA_PATTERN.test(provenance.sourceSha)) {
    blockers.push("FE_SOURCE_SHA_INVALID");
  }
  if (provenance.executionSha !== provenance.sourceSha) {
    blockers.push("FE_EXECUTION_SHA_MISMATCH");
  }
  if (
    !provenance.parentSha ||
    provenance.parentSha !== provenance.expectedParentSha
  ) {
    blockers.push("FE_PARENT_SHA_MISMATCH");
  }
  if (!provenance.treeSha || !GIT_SHA_PATTERN.test(provenance.treeSha)) {
    blockers.push("FE_TREE_SHA_INVALID");
  }
  if (!provenance.workflowRunId?.trim() || !provenance.workflowRunUrl?.trim()) {
    blockers.push("FE_WORKFLOW_TRACE_MISSING");
  }
  if (
    !provenance.artifactName?.includes(provenance.sourceSha ?? "__missing__")
  ) {
    blockers.push("FE_ARTIFACT_NAME_SHA_MISMATCH");
  }

  if (official.status !== "PASS") blockers.push("WWHN-31_NOT_PASS");
  if (!official.version?.trim()) blockers.push("WWHN-31_VERSION_MISSING");
  if (!validHash(official.sha256)) blockers.push("WWHN-31_SHA256_INVALID");
  const publishers = new Set(
    official.publisherAccounts
      .map((account) => normalized(account))
      .filter(Boolean),
  );
  if (publishers.size < 2) {
    blockers.push("WWHN-31_BE1_BE2_PUBLISHERS_INCOMPLETE");
  }

  if (schema.status !== "PASS") blockers.push("WWHN-151_NOT_PASS");
  if (!validHash(schema.sha256)) blockers.push("WWHN-151_SHA256_INVALID");
  if (normalized(schema.role) !== "be2") {
    blockers.push("WWHN-151_PUBLISHER_ROLE_INVALID");
  }

  if (qa1.status !== "PASS") blockers.push("WWHN-152_NOT_PASS");
  if (normalized(qa1.role) !== "qa1") blockers.push("WWHN-152_ROLE_INVALID");
  if (
    qa1.reviewedSha256 !== official.sha256 ||
    qa1.reviewedModuleSha256 !== schema.sha256
  ) {
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
  if (normalized(runtime.role) !== "qa2")
    blockers.push("WWHN-182_ROLE_INVALID");
  if (runtime.sourceSha !== provenance.sourceSha) {
    blockers.push("WWHN-182_SOURCE_SHA_MISMATCH");
  }
  if (!runtime.buildId?.trim()) blockers.push("WWHN-182_BUILD_ID_MISSING");
  if (
    !validHash(runtime.artifactDigest) ||
    !validHash(runtime.sha256SumsSha256)
  ) {
    blockers.push("WWHN-182_PACKAGE_HASH_INVALID");
  }
  if (
    !runtime.environment ||
    /^(local|ci|mock|test|synthetic)$/iu.test(runtime.environment)
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
      scenario.authorizationRedacted !== true ||
      !scenario.requestId?.trim() ||
      !validHash(scenario.requestArtifactSha256) ||
      !validHash(scenario.responseArtifactSha256) ||
      !effectProofValid(scenario)
    ) {
      blockers.push(`WWHN-182_${id}_INVALID`);
    }
  }

  if (permissions.status !== "PASS") {
    blockers.push("PERMISSION_APPROVAL_NOT_PASS");
  }
  const approvers = [
    permissions.backendApprover,
    permissions.businessApprover,
    permissions.frontendApprover,
  ]
    .map(normalized)
    .filter(Boolean);
  if (new Set(approvers).size !== 3) {
    blockers.push("PERMISSION_APPROVERS_NOT_INDEPENDENT");
  }
  if (
    permissions.sourceSha !== runtime.sourceSha ||
    permissions.buildId !== runtime.buildId ||
    permissions.artifactDigest !== runtime.artifactDigest
  ) {
    blockers.push("PERMISSION_RUNTIME_PACKAGE_MISMATCH");
  }
  const catalog = scenarios.get("PERMISSION_CATALOG");
  if (
    !catalog ||
    permissions.runtimeCatalogSha256 !== catalog.responseArtifactSha256
  ) {
    blockers.push("PERMISSION_CATALOG_HASH_MISMATCH");
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
    blockers: [...new Set(blockers)],
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
