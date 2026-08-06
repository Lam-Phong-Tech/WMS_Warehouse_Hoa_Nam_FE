import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const REQUIRED_ISSUES = Object.freeze([
  'WWHN-31',
  'WWHN-151',
  'WWHN-152',
  'WWHN-180',
  'WWHN-182',
  'WWHN-183',
]);

export const REQUIRED_RUNTIME_SCENARIOS = Object.freeze([
  'PERMISSION_DENY_403',
  'IDEMPOTENCY_REPLAY',
  'IDEMPOTENCY_CONFLICT',
  'STALE_WRITE',
  'PERMISSION_CATALOG',
]);

export const REQUIRED_FINDINGS = Object.freeze([
  ['FE-P0-01', 'P0'],
  ['FE-P0-02', 'P0'],
  ['FE-P1-01', 'P1'],
  ['FE-P1-02', 'P1'],
  ['FE-P1-03', 'P1'],
  ['FE-P1-04', 'P1'],
  ['FE-P1-05', 'P1'],
  ['FE-P2-01', 'P2'],
  ['FE-P2-02', 'P2'],
]);

const HASH_256 = /^[a-f0-9]{64}$/i;
const SHA_40 = /^[a-f0-9]{40}$/i;
const PASS = 'PASS';
const PENDING = 'PENDING';
const FAIL = 'FAIL';
const ALLOWED_GATE_STATUS = new Set([PASS, PENDING, FAIL]);
const FORBIDDEN_ENV = /^(local|ci|mock|test|synthetic)$/i;
const SENSITIVE_ACTIONS = Object.freeze({
  'POST /stocktake/sessions/:sessionId/apply-adjustment': 'stocktake.adjust',
  'GET /reports/inventory-xnt/export-excel': 'report.export',
  'POST /warranty/cases:TEMP_ONLY': 'warranty.temp_only',
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function statusOf(value) {
  return ALLOWED_GATE_STATUS.has(value) ? value : FAIL;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hash(value) {
  return HASH_256.test(text(value));
}

function sha(value) {
  return SHA_40.test(text(value));
}

function unique(values) {
  return [...new Set(values)];
}

function sameNonEmpty(...values) {
  const normalized = values.map(text);
  return normalized.every(Boolean) && new Set(normalized).size === 1;
}

function separateAccounts(accounts, minimum = 2) {
  const normalized = unique((accounts ?? []).map(text).filter(Boolean));
  return normalized.length >= minimum;
}

function localHashMatches(rootDir, artifactPath, expectedHash) {
  if (!text(artifactPath) || !hash(expectedHash)) return false;
  const fullPath = path.resolve(rootDir, artifactPath);
  if (!fullPath.startsWith(path.resolve(rootDir) + path.sep)) return false;
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return true;
  const actual = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
  return actual.toLowerCase() === expectedHash.toLowerCase();
}

function evidenceArtifactsValid(items) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) =>
      isObject(item) &&
      text(item.path) &&
      hash(item.sha256) &&
      !/authorization|cookie|token|secret/i.test(item.path),
    )
  );
}

function effectProofValid(scenarioId, proof) {
  if (scenarioId === 'IDEMPOTENCY_CONFLICT' || scenarioId === 'PERMISSION_CATALOG') {
    return true;
  }
  if (!isObject(proof) || statusOf(proof.status) !== PASS) return false;
  if (!text(proof.probePath) || !text(proof.valuePath)) return false;
  if (!hash(proof.beforeHash) || !hash(proof.afterHash)) return false;
  if (scenarioId === 'IDEMPOTENCY_REPLAY') {
    return (
      hash(proof.afterFirstHash) &&
      hash(proof.afterReplayHash) &&
      proof.afterFirstHash === proof.afterReplayHash &&
      proof.secondSideEffectCreated === false
    );
  }
  return proof.beforeHash === proof.afterHash && proof.sideEffectCreated === false;
}

function scenarioValid(scenario, expectedId) {
  if (!isObject(scenario) || scenario.id !== expectedId || statusOf(scenario.status) !== PASS) {
    return false;
  }
  if (!evidenceArtifactsValid(scenario.requestArtifacts)) return false;
  if (!evidenceArtifactsValid(scenario.responseArtifacts)) return false;
  if (!Array.isArray(scenario.requestIds) || scenario.requestIds.length === 0) return false;
  if (scenario.requestIds.some((value) => !text(value))) return false;
  if (!Array.isArray(scenario.observedHttpStatuses) || scenario.observedHttpStatuses.length === 0) {
    return false;
  }

  const statuses = scenario.observedHttpStatuses;
  if (expectedId === 'PERMISSION_DENY_403' && !statuses.includes(403)) return false;
  if (expectedId === 'IDEMPOTENCY_REPLAY' && statuses.some((value) => value < 200 || value >= 300)) {
    return false;
  }
  if (expectedId === 'IDEMPOTENCY_REPLAY') {
    if (scenario.sameBusinessResult !== true || scenario.secondSideEffectCreated !== false) return false;
  }
  if (expectedId === 'IDEMPOTENCY_CONFLICT' && !statuses.includes(409)) return false;
  if (expectedId === 'STALE_WRITE' && !statuses.some((value) => value === 409 || value === 412)) {
    return false;
  }
  if (expectedId === 'PERMISSION_CATALOG' && statuses.some((value) => value < 200 || value >= 300)) {
    return false;
  }
  return effectProofValid(expectedId, scenario.effectProof);
}

function validateManifestShape(manifest, errors) {
  if (!isObject(manifest)) {
    errors.push('Manifest must be an object.');
    return;
  }
  if (manifest.schemaVersion !== '4.0.0') errors.push('Manifest schemaVersion must be 4.0.0.');
  if (manifest.task !== 'WWHN-153') errors.push('Manifest task must be WWHN-153.');

  const keys = manifest.requiredIssueKeys ?? [];
  for (const key of REQUIRED_ISSUES) {
    if (!keys.includes(key)) errors.push(`Missing required issue key ${key}.`);
  }

  const findings = manifest.findings ?? [];
  for (const [id, severity] of REQUIRED_FINDINGS) {
    const finding = findings.find((item) => item?.id === id);
    if (!finding || finding.severity !== severity) {
      errors.push(`Missing or invalid finding ${id}/${severity}.`);
    }
  }
  if (!text(manifest.sourceProvenancePath)) errors.push('sourceProvenancePath is required.');
  if (!text(manifest.permissionApprovalPath)) errors.push('permissionApprovalPath is required.');
}

function evaluateSourceProvenance(policy, context, blockers) {
  const status = statusOf(context?.status ?? (context?.isCi ? PASS : PENDING));
  const validPolicy =
    isObject(policy) &&
    policy.schemaVersion === '1.0.0' &&
    policy.task === 'WWHN-153' &&
    text(policy.repository) &&
    policy.branch === 'm1' &&
    policy.resolutionStrategy === 'CI_HEAD' &&
    sha(policy.preRemediationHead) &&
    sha(policy.expectedParentSha) &&
    policy.expectedParentSha === policy.preRemediationHead &&
    Array.isArray(policy.supersededReferences) &&
    policy.supersededReferences.every((item) => isObject(item) && text(item.ref) && text(item.reason));

  const sourceSha = text(context?.sourceSha);
  const executionSha = text(context?.executionSha);
  const parentSha = text(context?.parentSha);
  const treeSha = text(context?.treeSha);
  const validContext =
    status === PASS &&
    context.repository === policy?.repository &&
    context.branch === policy?.branch &&
    sha(sourceSha) &&
    sameNonEmpty(sourceSha, executionSha) &&
    sha(parentSha) &&
    parentSha === policy?.expectedParentSha &&
    sha(treeSha) &&
    text(context.runId) &&
    text(context.runUrl) &&
    text(context.artifactName) &&
    context.artifactName.includes(sourceSha);

  if (!validPolicy) blockers.push('FE-SOURCE-PROVENANCE: policy invalid or incomplete.');
  if (status === FAIL) blockers.push('FE-SOURCE-PROVENANCE: source context explicitly failed.');
  if (status === PASS && !validContext) {
    blockers.push('FE-SOURCE-PROVENANCE: repository/branch/SHA/parent/tree/run/artifact mismatch.');
  }

  return {
    id: 'FE-SOURCE-PROVENANCE',
    status: validPolicy && validContext ? PASS : status === PASS || status === FAIL || !validPolicy ? FAIL : PENDING,
    sourceSha: sourceSha || null,
    parentSha: parentSha || null,
    treeSha: treeSha || null,
  };
}

function evaluateOfficial(manifest, rootDir, blockers) {
  const release = manifest.officialContractRelease ?? {};
  const state = statusOf(release.status);
  const valid =
    state === PASS &&
    release.issueKey === 'WWHN-31' &&
    text(release.version) &&
    sha(release.backendCommitSha) &&
    text(release.artifactPath) &&
    hash(release.artifactSha256) &&
    text(release.changelogPath) &&
    hash(release.changelogSha256) &&
    separateAccounts(release.publisherAccounts, 2) &&
    localHashMatches(rootDir, release.artifactPath, release.artifactSha256) &&
    localHashMatches(rootDir, release.changelogPath, release.changelogSha256);
  if (state === FAIL) blockers.push('OFFICIAL-RELEASE: explicitly failed.');
  if (state === PASS && !valid) blockers.push('OFFICIAL-RELEASE: version/SHA/path/hash/changelog/publisher separation invalid.');
  return { id: 'OFFICIAL-RELEASE', status: valid ? PASS : state === PASS || state === FAIL ? FAIL : PENDING };
}

function evaluateModuleSchema(manifest, rootDir, blockers) {
  const release = manifest.moduleSchemaRelease ?? {};
  const state = statusOf(release.status);
  const valid =
    state === PASS &&
    release.issueKey === 'WWHN-151' &&
    text(release.version) &&
    sha(release.backendCommitSha) &&
    text(release.artifactPath) &&
    hash(release.artifactSha256) &&
    localHashMatches(rootDir, release.artifactPath, release.artifactSha256);
  if (state === FAIL) blockers.push('MODULE-SCHEMA: explicitly failed.');
  if (state === PASS && !valid) blockers.push('MODULE-SCHEMA: WWHN-151 artifact metadata/hash invalid.');
  return { id: 'MODULE-SCHEMA', status: valid ? PASS : state === PASS || state === FAIL ? FAIL : PENDING };
}

function evaluateQa1(manifest, officialGate, moduleGate, blockers) {
  const qa1 = manifest.qa1Review ?? {};
  const state = statusOf(qa1.status);
  const publishers = manifest.officialContractRelease?.publisherAccounts ?? [];
  const reviewed = qa1.reviewedArtifacts ?? [];
  const valid =
    state === PASS &&
    qa1.issueKey === 'WWHN-152' &&
    text(qa1.reviewerAccount) &&
    !publishers.includes(qa1.reviewerAccount) &&
    officialGate.status === PASS &&
    moduleGate.status === PASS &&
    reviewed.some((item) => item?.sha256 === manifest.officialContractRelease?.artifactSha256) &&
    reviewed.some((item) => item?.sha256 === manifest.moduleSchemaRelease?.artifactSha256) &&
    qa1.dimensions?.constraints === PASS &&
    qa1.dimensions?.errorContract === PASS &&
    qa1.dimensions?.testability === PASS;
  if (state === FAIL) blockers.push('QA1-INDEPENDENT-REVIEW: explicitly failed.');
  if (state === PASS && !valid) blockers.push('QA1-INDEPENDENT-REVIEW: exact-hash review or dimensions invalid.');
  return { id: 'QA1-INDEPENDENT-REVIEW', status: valid ? PASS : state === PASS || state === FAIL ? FAIL : PENDING };
}

function evaluateIndependent(manifest, officialGate, blockers) {
  const item = manifest.independentConfirmation ?? {};
  const state = statusOf(item.status);
  const publishers = manifest.officialContractRelease?.publisherAccounts ?? [];
  const valid =
    state === PASS &&
    item.issueKey === 'WWHN-180' &&
    officialGate.status === PASS &&
    text(item.confirmerAccount) &&
    !publishers.includes(item.confirmerAccount) &&
    item.artifactSha256 === manifest.officialContractRelease?.artifactSha256;
  if (state === FAIL) blockers.push('INDEPENDENT-CONFIRMATION: explicitly failed.');
  if (state === PASS && !valid) blockers.push('INDEPENDENT-CONFIRMATION: account/hash mismatch.');
  return { id: 'INDEPENDENT-CONFIRMATION', status: valid ? PASS : state === PASS || state === FAIL ? FAIL : PENDING };
}

function evaluateQa2(manifest, provenanceGate, blockers) {
  const runtime = manifest.qa2Runtime ?? {};
  const state = statusOf(runtime.status);
  const scenarios = runtime.scenarios ?? [];
  const allScenarios = REQUIRED_RUNTIME_SCENARIOS.every((id) =>
    scenarioValid(scenarios.find((item) => item?.id === id), id),
  );
  const valid =
    state === PASS &&
    runtime.issueKey === 'WWHN-182' &&
    provenanceGate.status === PASS &&
    sameNonEmpty(runtime.sourceSha, provenanceGate.sourceSha) &&
    text(runtime.buildId) &&
    text(runtime.environment) &&
    !FORBIDDEN_ENV.test(runtime.environment) &&
    text(runtime.qa2Account) &&
    hash(runtime.artifactDigest) &&
    text(runtime.sha256SumsPath) &&
    hash(runtime.sha256SumsSha256) &&
    text(runtime.summaryPath) &&
    allScenarios;
  if (state === FAIL) blockers.push('QA2-DIRECT-RUNTIME: explicitly failed.');
  if (state === PASS && !valid) blockers.push('QA2-DIRECT-RUNTIME: exact source/build/env/artifacts/request IDs/effect proof invalid.');
  return { id: 'QA2-DIRECT-RUNTIME', status: valid ? PASS : state === PASS || state === FAIL ? FAIL : PENDING };
}

function evaluatePermission(manifest, approval, qa2Gate, blockers) {
  const state = statusOf(approval?.status);
  const runtime = manifest.qa2Runtime ?? {};
  const catalogScenario = runtime.scenarios?.find((item) => item?.id === 'PERMISSION_CATALOG');
  const catalogResponseHash = catalogScenario?.responseArtifacts?.[0]?.sha256;
  const mapped = new Map((approval?.endpointPermissionRoleMapping ?? []).map((item) => [item.endpointAction, item]));
  const sensitiveValid = Object.entries(SENSITIVE_ACTIONS).every(([action, permission]) => {
    const item = mapped.get(action);
    return item?.permission === permission && Array.isArray(item.roles) && item.roles.length > 0 && item.approved === true;
  });
  const valid =
    state === PASS &&
    approval.issueKey === 'WWHN-153' &&
    qa2Gate.status === PASS &&
    separateAccounts(approval.approverAccounts, 3) &&
    approval.approverRoles?.includes('BE/RBAC') &&
    approval.approverRoles?.includes('BA') &&
    approval.approverRoles?.includes('FE') &&
    sameNonEmpty(approval.runtimeLink?.sourceSha, runtime.sourceSha) &&
    sameNonEmpty(approval.runtimeLink?.buildId, runtime.buildId) &&
    sameNonEmpty(approval.runtimeLink?.environment, runtime.environment) &&
    sameNonEmpty(approval.runtimeLink?.artifactDigest, runtime.artifactDigest) &&
    sameNonEmpty(approval.runtimeLink?.summaryPath, runtime.summaryPath) &&
    sameNonEmpty(approval.runtimeLink?.sha256SumsPath, runtime.sha256SumsPath) &&
    sameNonEmpty(approval.runtimeCatalogSnapshot?.sha256, catalogResponseHash) &&
    approval.runtimeCatalogSnapshot?.missingCanonicalCodes?.length === 0 &&
    hash(approval.backendPermissionCatalog?.sha256) &&
    text(approval.backendPermissionCatalog?.path) &&
    sensitiveValid;
  if (state === FAIL) blockers.push('PERMISSION-APPROVAL: explicitly failed.');
  if (state === PASS && !valid) blockers.push('PERMISSION-APPROVAL: catalog/runtime/hash/approver/action-role linkage invalid.');
  return { id: 'PERMISSION-APPROVAL', status: valid ? PASS : state === PASS || state === FAIL ? FAIL : PENDING };
}

function evaluateBa(manifest, qa2Gate, blockers) {
  const ba = manifest.baG1Minutes ?? {};
  const runtime = manifest.qa2Runtime ?? {};
  const state = statusOf(ba.status);
  const valid =
    state === PASS &&
    ba.issueKey === 'WWHN-183' &&
    ba.decision === 'GO' &&
    qa2Gate.status === PASS &&
    sameNonEmpty(ba.sourceSha, runtime.sourceSha) &&
    sameNonEmpty(ba.artifactDigest, runtime.artifactDigest) &&
    ba.openP0 === 0 &&
    ba.openP1 === 0 &&
    text(ba.minutesPath) &&
    hash(ba.minutesSha256) &&
    text(ba.baAccount);
  if (state === FAIL) blockers.push('BA-G1-MINUTES: explicitly failed.');
  if (state === PASS && !valid) blockers.push('BA-G1-MINUTES: GO/SHA/digest/open counts/minutes invalid.');
  return { id: 'BA-G1-MINUTES', status: valid ? PASS : state === PASS || state === FAIL ? FAIL : PENDING };
}

function derivedFindingStatus(id, gates, structuralOk) {
  const byId = new Map(gates.map((gate) => [gate.id, gate.status]));
  const all = (...ids) => ids.every((gateId) => byId.get(gateId) === PASS);
  switch (id) {
    case 'FE-P0-01': return all('OFFICIAL-RELEASE', 'QA1-INDEPENDENT-REVIEW') ? PASS : PENDING;
    case 'FE-P0-02': return gates.every((gate) => gate.status === PASS) ? PASS : PENDING;
    case 'FE-P1-01': return all('MODULE-SCHEMA', 'QA1-INDEPENDENT-REVIEW') ? PASS : PENDING;
    case 'FE-P1-02': return all('QA2-DIRECT-RUNTIME') ? PASS : PENDING;
    case 'FE-P1-03': return all('BA-G1-MINUTES') ? PASS : PENDING;
    case 'FE-P1-04': return all('PERMISSION-APPROVAL') ? PASS : PENDING;
    case 'FE-P1-05': return all('FE-SOURCE-PROVENANCE') ? PASS : PENDING;
    case 'FE-P2-01':
    case 'FE-P2-02': return structuralOk ? PASS : FAIL;
    default: return FAIL;
  }
}

export function evaluateWwhn153Signoff({
  manifest,
  permissionApproval,
  sourceProvenance,
  sourceContext = {},
  rootDir = process.cwd(),
}) {
  const errors = [];
  const blockers = [];
  validateManifestShape(manifest, errors);

  const provenanceGate = evaluateSourceProvenance(sourceProvenance, sourceContext, blockers);
  const officialGate = evaluateOfficial(manifest, rootDir, blockers);
  const moduleGate = evaluateModuleSchema(manifest, rootDir, blockers);
  const qa1Gate = evaluateQa1(manifest, officialGate, moduleGate, blockers);
  const independentGate = evaluateIndependent(manifest, officialGate, blockers);
  const qa2Gate = evaluateQa2(manifest, provenanceGate, blockers);
  const permissionGate = evaluatePermission(manifest, permissionApproval, qa2Gate, blockers);
  const baGate = evaluateBa(manifest, qa2Gate, blockers);

  const gates = [
    provenanceGate,
    officialGate,
    moduleGate,
    qa1Gate,
    independentGate,
    qa2Gate,
    permissionGate,
    baGate,
  ];
  const structuralOk = errors.length === 0;
  const findings = REQUIRED_FINDINGS.map(([id, severity]) => ({
    id,
    severity,
    status: derivedFindingStatus(id, gates, structuralOk),
  }));
  const openP0 = findings.filter((item) => item.severity === 'P0' && item.status !== PASS).length;
  const openP1 = findings.filter((item) => item.severity === 'P1' && item.status !== PASS).length;
  const openP2 = findings.filter((item) => item.severity === 'P2' && item.status !== PASS).length;
  const finalAllowed = structuralOk && gates.every((gate) => gate.status === PASS) && openP0 === 0 && openP1 === 0;

  if (!finalAllowed) blockers.push('FINAL-SIGNOFF: fail-closed until every independent gate is PASS and open P0/P1 = 0.');

  return {
    schemaVersion: '4.0.0',
    task: 'WWHN-153',
    integrityOk: structuralOk,
    finalAllowed,
    openP0,
    openP1,
    openP2,
    errors: unique(errors),
    blockers: unique(blockers),
    gates,
    findings,
  };
}

export function loadWwhn153Evidence(rootDir = process.cwd()) {
  const manifestPath = path.resolve(rootDir, 'docs/evidence/wwhn-153/WWHN-153_SIGNOFF_MANIFEST.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const permissionPath = path.resolve(rootDir, manifest.permissionApprovalPath);
  const provenancePath = path.resolve(rootDir, manifest.sourceProvenancePath);
  return {
    manifest,
    permissionApproval: JSON.parse(fs.readFileSync(permissionPath, 'utf8')),
    sourceProvenance: JSON.parse(fs.readFileSync(provenancePath, 'utf8')),
    paths: { manifestPath, permissionPath, provenancePath },
  };
}
