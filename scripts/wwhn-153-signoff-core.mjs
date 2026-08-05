import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

export const REQUIRED_FINDINGS = [
  "FE-P0-01",
  "FE-P0-02",
  "FE-P1-01",
  "FE-P1-02",
  "FE-P1-03",
  "FE-P1-04",
  "FE-P2-01",
];
export const REQUIRED_RUNTIME_SCENARIOS = [
  "PERMISSION_DENY_403",
  "IDEMPOTENCY_REPLAY",
  "IDEMPOTENCY_CONFLICT",
  "STALE_WRITE",
];
const MATRIX = {
  "POST /scan/classify": ["inventory.trace", "scan.classify"],
  "POST /inbound-documents/:id/post-receipt": ["inbound.post"],
  "POST /outbound-documents/:id/post-issue": ["outbound.post"],
  "POST /stocktake/sessions/:sessionId/apply-adjustment": [
    "stocktake.adjust",
  ],
  "GET /reports/inventory-xnt/export-excel": ["report.export"],
  "POST /warranty/cases": ["warranty.temp_only"],
};

export const sha256Buffer = (value) =>
  createHash("sha256").update(value).digest("hex");
const sha256File = (path) => sha256Buffer(readFileSync(path));
const isHash = (value) => /^[a-f0-9]{64}$/u.test(value ?? "");
const isCommit = (value) => /^[a-f0-9]{40}$/u.test(value ?? "");
const text = (value) => typeof value === "string" && value.trim().length > 0;
const identity = (value) => (text(value) ? value.trim().toLowerCase() : null);
const sameSet = (a, b) =>
  JSON.stringify([...new Set(a ?? [])].sort()) ===
  JSON.stringify([...new Set(b ?? [])].sort());

function localDigest(root, path, expected, label, errors) {
  if (!text(path) || !isHash(expected) || /^https?:\/\//u.test(path)) return;
  const target = isAbsolute(path) ? path : resolve(root, path);
  const rel = relative(resolve(root), target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    errors.push(`${label}: path escapes repository`);
    return;
  }
  if (existsSync(target) && sha256File(target) !== expected) {
    errors.push(`${label}: local SHA256 mismatch`);
  }
}

function evaluateGate(id, checks, errors) {
  const blockers = [];
  for (const [ok, message, malformed = false] of checks) {
    if (!ok) {
      blockers.push(message);
      if (malformed) errors.push(`${id}: ${message}`);
    }
  }
  return {
    id,
    pass: blockers.length === 0,
    status: blockers.length ? "BLOCKED" : "PASS",
    blockers,
  };
}

export function evaluateWwhn153Signoff({
  manifest,
  permissionApproval,
  root = process.cwd(),
}) {
  const errors = [];
  if (manifest?.schemaVersion !== "3.0.0") {
    errors.push("signoff schemaVersion must be 3.0.0");
  }
  if (manifest?.task !== "WWHN-153") {
    errors.push("signoff task must be WWHN-153");
  }
  if (permissionApproval?.schemaVersion !== "2.0.0") {
    errors.push("permission schemaVersion must be 2.0.0");
  }
  if (permissionApproval?.task !== "WWHN-153") {
    errors.push("permission task must be WWHN-153");
  }
  if (
    manifest?.repositoryPolicy?.branch !== "m1" ||
    manifest?.repositoryPolicy?.noSideBranch !== true ||
    manifest?.repositoryPolicy?.singleFinalCommit !== true
  ) {
    errors.push(
      "repository policy must lock m1/no-side-branch/single-final-commit",
    );
  }
  if (
    manifest?.assessment?.score !== 80 ||
    !sameSet(
      manifest?.assessment?.findings?.map((item) => item.id),
      REQUIRED_FINDINGS,
    )
  ) {
    errors.push("assessment must match the 80/100 FE-P0/P1/P2 review");
  }

  const official = manifest.officialContract ?? {};
  const release = official.release ?? {};
  const review = official.independentReview ?? {};
  const publishers = new Map(
    (release.publishedBy ?? []).map((item) => [
      String(item?.role ?? "").toUpperCase(),
      identity(item?.account),
    ]),
  );
  const be1 = publishers.get("BE1");
  const be2 = publishers.get("BE2");
  const reviewed = new Map(
    (review.reviewedArtifacts ?? []).map((item) => [
      item?.issue,
      item?.sha256,
    ]),
  );
  const officialGate = evaluateGate(
    "WWHN-31/WWHN-152",
    [
      [official.status === "PASS", "official contract is not PASS"],
      [
        isCommit(release.sourceCommitSha),
        "official source SHA missing/invalid",
        official.status === "PASS",
      ],
      [
        text(release.version),
        "official version missing",
        official.status === "PASS",
      ],
      [
        text(release.artifactPath) && isHash(release.artifactSha256),
        "official artifact path/hash missing",
        official.status === "PASS",
      ],
      [
        text(release.changelogPath) && isHash(release.changelogSha256),
        "changelog path/hash missing",
        official.status === "PASS",
      ],
      [
        be1 && be2 && be1 !== be2,
        "BE1/BE2 publishers must be distinct",
        official.status === "PASS",
      ],
      [review.status === "PASS", "QA1 review is not PASS"],
      [
        identity(review.reviewer) &&
          String(review.reviewerRole).toUpperCase() === "QA1",
        "QA1 reviewer identity/role missing",
        review.status === "PASS",
      ],
      [
        identity(review.reviewer) !== be1 && identity(review.reviewer) !== be2,
        "QA1 reviewer is not independent",
        review.status === "PASS",
      ],
      [
        reviewed.get("WWHN-31") === release.artifactSha256,
        "QA1 official hash mismatch",
        review.status === "PASS",
      ],
      [review.constraintsResult === "PASS", "constraints review is not PASS"],
      [
        review.errorContractResult === "PASS",
        "error contract review is not PASS",
      ],
      [review.testabilityResult === "PASS", "testability review is not PASS"],
    ],
    errors,
  );
  localDigest(
    root,
    release.artifactPath,
    release.artifactSha256,
    "WWHN-31 artifact",
    errors,
  );
  localDigest(
    root,
    release.changelogPath,
    release.changelogSha256,
    "WWHN-31 changelog",
    errors,
  );

  const schema = manifest.moduleSchema ?? {};
  const schemaGate = evaluateGate(
    "WWHN-151",
    [
      [schema.status === "PASS", "module schema is not PASS"],
      [
        isCommit(schema.sourceCommitSha),
        "module schema source SHA missing/invalid",
        schema.status === "PASS",
      ],
      [
        text(schema.version),
        "module schema version missing",
        schema.status === "PASS",
      ],
      [
        text(schema.artifactPath) && isHash(schema.artifactSha256),
        "module schema path/hash missing",
        schema.status === "PASS",
      ],
      [
        text(schema.publishedBy) &&
          String(schema.publisherRole).toUpperCase() === "BE2",
        "BE2 publisher identity/role missing",
        schema.status === "PASS",
      ],
      [
        reviewed.get("WWHN-151") === schema.artifactSha256,
        "QA1 module schema hash mismatch",
        review.status === "PASS",
      ],
    ],
    errors,
  );
  localDigest(
    root,
    schema.artifactPath,
    schema.artifactSha256,
    "WWHN-151 artifact",
    errors,
  );

  const confirmation =
    manifest.independentConfirmations?.["WWHN-180"] ?? {};
  const confirmer = identity(confirmation.reviewer);
  const confirmationGate = evaluateGate(
    "WWHN-180",
    [
      [
        confirmation.status === "PASS",
        "independent confirmation is not PASS",
      ],
      [
        confirmation.confirmedContractSha256 === release.artifactSha256,
        "confirmed contract hash mismatch",
        confirmation.status === "PASS",
      ],
      [
        confirmer && confirmer !== be1 && confirmer !== be2,
        "confirmer is not independent",
        confirmation.status === "PASS",
      ],
      [
        text(confirmation.evidencePath) &&
          isHash(confirmation.evidenceSha256),
        "confirmation evidence path/hash missing",
        confirmation.status === "PASS",
      ],
    ],
    errors,
  );
  localDigest(
    root,
    confirmation.evidencePath,
    confirmation.evidenceSha256,
    "WWHN-180 evidence",
    errors,
  );

  const runtime = manifest.independentConfirmations?.["WWHN-182"] ?? {};
  const scenarioMap = new Map(
    (runtime.scenarios ?? []).map((item) => [item.id, item]),
  );
  const runtimeChecks = [
    [runtime.status === "PASS", "QA2 runtime is not PASS"],
    [
      identity(runtime.executor) &&
        String(runtime.executorRole).toUpperCase() === "QA2",
      "QA2 executor identity/role missing",
      runtime.status === "PASS",
    ],
    [
      identity(runtime.executor) !== be1 && identity(runtime.executor) !== be2,
      "QA2 executor is not independent",
      runtime.status === "PASS",
    ],
    [
      isCommit(runtime.sourceSha),
      "exact FE source SHA missing/invalid",
      runtime.status === "PASS",
    ],
    [text(runtime.buildId), "immutable build ID missing", runtime.status === "PASS"],
    [
      text(runtime.environment) &&
        !/^(local|ci|mock|test)$/iu.test(runtime.environment),
      "runtime environment is not DEV/UAT-like",
      runtime.status === "PASS",
    ],
    [
      text(runtime.artifactName) && isHash(runtime.artifactDigest),
      "runtime artifact name/digest missing",
      runtime.status === "PASS",
    ],
    [
      runtime.directApi === true && runtime.synthetic === false,
      "runtime must be direct and non-synthetic",
      runtime.status === "PASS",
    ],
  ];
  for (const id of REQUIRED_RUNTIME_SCENARIOS) {
    const item = scenarioMap.get(id);
    const observed = item?.observedHttpStatuses ?? [];
    const statusOk =
      id === "PERMISSION_DENY_403"
        ? observed.includes(403)
        : id === "IDEMPOTENCY_CONFLICT"
          ? observed.includes(409)
          : id === "STALE_WRITE"
            ? observed.some((status) => status === 409 || status === 412)
            : observed.length >= 2 &&
              observed.every((status) => status >= 200 && status < 300);
    const replayOk =
      id !== "IDEMPOTENCY_REPLAY" ||
      (item?.sameBusinessResult === true &&
        item?.secondSideEffectCreated === false);
    runtimeChecks.push([
      item?.status === "PASS" &&
        item?.directApi === true &&
        item?.synthetic === false &&
        item?.authorizationRedacted === true &&
        text(item?.requestArtifactPath) &&
        isHash(item?.requestArtifactSha256) &&
        text(item?.responseArtifactPath) &&
        isHash(item?.responseArtifactSha256) &&
        text(item?.requestId) &&
        statusOk &&
        replayOk,
      `${id} evidence is incomplete/invalid`,
      runtime.status === "PASS",
    ]);
  }
  const runtimeGate = evaluateGate("WWHN-182", runtimeChecks, errors);

  const catalog = permissionApproval.backendCatalog ?? {};
  const snapshot = permissionApproval.runtimeSnapshot ?? {};
  const approvals = permissionApproval.approvals ?? {};
  const rows = new Map(
    (permissionApproval.endpointPermissionRoleMatrix ?? []).map((row) => [
      `${String(row.method).toUpperCase()} ${row.path}`,
      row,
    ]),
  );
  const permissionChecks = [
    [
      manifest.permissionApproval?.status === "PASS" &&
        permissionApproval.status === "PASS",
      "permission approval is not PASS",
    ],
    [
      text(catalog.version) && isCommit(catalog.sourceCommitSha),
      "backend catalog version/source SHA missing",
      permissionApproval.status === "PASS",
    ],
    [
      text(catalog.artifactPath) && isHash(catalog.artifactSha256),
      "backend catalog path/hash missing",
      permissionApproval.status === "PASS",
    ],
    [
      text(catalog.publishedBy) &&
        String(catalog.publisherRole).toUpperCase() === "BE/RBAC",
      "BE/RBAC publisher missing",
      permissionApproval.status === "PASS",
    ],
    [
      approvals.backend?.status === "PASS" &&
        text(approvals.backend?.approvedBy),
      "BE/RBAC approval missing",
      permissionApproval.status === "PASS",
    ],
    [
      approvals.business?.status === "PASS" &&
        text(approvals.business?.approvedBy),
      "BA approval missing",
      permissionApproval.status === "PASS",
    ],
    [
      identity(approvals.backend?.approvedBy) !==
        identity(approvals.business?.approvedBy),
      "BE/RBAC and BA approvers must be distinct",
      permissionApproval.status === "PASS",
    ],
    [
      snapshot.environment === runtime.environment &&
        snapshot.sourceSha === runtime.sourceSha &&
        snapshot.buildId === runtime.buildId,
      "permission snapshot build binding mismatch",
      permissionApproval.status === "PASS",
    ],
    [
      text(snapshot.artifactPath) && isHash(snapshot.artifactSha256),
      "permission snapshot path/hash missing",
      permissionApproval.status === "PASS",
    ],
    [
      (snapshot.missingCanonicalCodes ?? []).length === 0,
      "runtime catalog has missing canonical permissions",
      permissionApproval.status === "PASS",
    ],
  ];
  for (const [key, expected] of Object.entries(MATRIX)) {
    const row = rows.get(key);
    permissionChecks.push([
      row?.approvalStatus === "PASS" &&
        sameSet(row?.permissionsAny, expected) &&
        (row?.roles ?? []).some(text),
      `${key} permission/role mapping is not approved`,
      permissionApproval.status === "PASS",
    ]);
  }
  const permissionGate = evaluateGate(
    "FE-P1-04",
    permissionChecks,
    errors,
  );
  localDigest(
    root,
    catalog.artifactPath,
    catalog.artifactSha256,
    "permission catalog",
    errors,
  );
  localDigest(
    root,
    snapshot.artifactPath,
    snapshot.artifactSha256,
    "permission snapshot",
    errors,
  );

  const minutes = manifest.independentConfirmations?.["WWHN-183"] ?? {};
  const minutesGate = evaluateGate(
    "WWHN-183",
    [
      [minutes.status === "PASS", "BA minutes are not PASS"],
      [minutes.decision === "GO", "BA decision must be GO"],
      [
        text(minutes.decidedBy) &&
          String(minutes.deciderRole).toUpperCase() === "BA",
        "BA decider identity/role missing",
        minutes.status === "PASS",
      ],
      [
        minutes.sourceSha === runtime.sourceSha,
        "BA minutes source SHA mismatch",
        minutes.status === "PASS",
      ],
      [
        minutes.artifactDigest === runtime.artifactDigest,
        "BA minutes artifact digest mismatch",
        minutes.status === "PASS",
      ],
      [
        minutes.openP0 === 0 && minutes.openP1 === 0,
        "BA minutes must record zero open P0/P1",
      ],
      [
        text(minutes.minutesPath) && isHash(minutes.minutesSha256),
        "BA minutes path/hash missing",
        minutes.status === "PASS",
      ],
      [
        runtimeGate.pass && permissionGate.pass,
        "QA2/permission gates are not PASS",
      ],
    ],
    errors,
  );
  localDigest(
    root,
    minutes.minutesPath,
    minutes.minutesSha256,
    "WWHN-183 minutes",
    errors,
  );

  const gates = [
    officialGate,
    schemaGate,
    confirmationGate,
    runtimeGate,
    permissionGate,
    minutesGate,
  ];
  const blockers = gates.flatMap((gate) =>
    gate.blockers.map((blocker) => `${gate.id}: ${blocker}`),
  );
  const finalAllowed = errors.length === 0 && gates.every((gate) => gate.pass);
  return {
    schemaVersion: "1.0.0",
    task: "WWHN-153",
    evaluatedAt: new Date().toISOString(),
    integrityOk: errors.length === 0,
    finalAllowed,
    status: finalAllowed ? "FINAL_GO" : "CONDITIONAL_PASS_FAIL_CLOSED",
    errors,
    blockers,
    openP0: finalAllowed ? 0 : 1,
    openP1: finalAllowed ? 0 : 4,
    gates,
  };
}

export function loadWwhn153Evidence(root = process.cwd()) {
  const manifestPath = join(
    root,
    "docs/evidence/wwhn-153/WWHN-153_SIGNOFF_MANIFEST.json",
  );
  const permissionPath = join(
    root,
    "docs/evidence/wwhn-153/WWHN-153_PERMISSION_APPROVAL.json",
  );
  const manifestText = readFileSync(manifestPath, "utf8");
  const permissionText = readFileSync(permissionPath, "utf8");
  return {
    manifestPath,
    permissionPath,
    manifestText,
    permissionText,
    manifest: JSON.parse(manifestText),
    permissionApproval: JSON.parse(permissionText),
  };
}
