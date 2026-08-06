#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateWwhn153Signoff } from './wwhn-153-signoff-core.mjs';

const H = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const SOURCE = '1'.repeat(40);
const PARENT = '2'.repeat(40);
const TREE = '3'.repeat(40);
const artifact = (name, digest = H) => ({ path: `evidence/${name}.json`, sha256: digest });
const scenario = (id, statuses, extra = {}) => ({
  id, status: 'PASS', observedHttpStatuses: statuses, requestIds: [`req-${id}`],
  requestArtifacts: [artifact(`${id}-request`)], responseArtifacts: [artifact(`${id}-response`, id === 'PERMISSION_CATALOG' ? H2 : H)],
  effectProof: null, ...extra,
});

const rootDir = process.cwd();
const evidenceDir = path.resolve(rootDir, 'docs/evidence/wwhn-153');
const manifest = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'WWHN-153_SIGNOFF_MANIFEST.json'), 'utf8'));
manifest.officialContractRelease = {
  issueKey: 'WWHN-31', status: 'PASS', version: '1.0.0', backendCommitSha: '4'.repeat(40),
  artifactPath: 'missing/openapi.yaml', artifactSha256: H, changelogPath: 'missing/changelog.md', changelogSha256: H2,
  publisherAccounts: ['be1', 'be2'],
};
manifest.moduleSchemaRelease = {
  issueKey: 'WWHN-151', status: 'PASS', version: '1.0.0', backendCommitSha: '5'.repeat(40),
  artifactPath: 'missing/module-schema.json', artifactSha256: H2,
};
manifest.qa1Review = {
  issueKey: 'WWHN-152', status: 'PASS', reviewerAccount: 'qa1',
  reviewedArtifacts: [{ sha256: H }, { sha256: H2 }],
  dimensions: { constraints: 'PASS', errorContract: 'PASS', testability: 'PASS' },
};
manifest.independentConfirmation = { issueKey: 'WWHN-180', status: 'PASS', confirmerAccount: 'qa-independent', artifactSha256: H };
manifest.qa2Runtime = {
  issueKey: 'WWHN-182', status: 'PASS', sourceSha: SOURCE, buildId: 'build-immutable-1', environment: 'UAT', qa2Account: 'qa2',
  artifactDigest: H, sha256SumsPath: 'evidence/SHA256SUMS', sha256SumsSha256: H2, summaryPath: 'evidence/summary.json',
  scenarios: [
    scenario('PERMISSION_DENY_403', [403], { effectProof: { status: 'PASS', probePath: '/resource/1', valuePath: '$.version', beforeHash: H, afterHash: H, sideEffectCreated: false } }),
    scenario('IDEMPOTENCY_REPLAY', [201, 201], { sameBusinessResult: true, secondSideEffectCreated: false, effectProof: { status: 'PASS', probePath: '/resource/1', valuePath: '$.version', beforeHash: H, afterHash: H2, afterFirstHash: H2, afterReplayHash: H2, secondSideEffectCreated: false } }),
    scenario('IDEMPOTENCY_CONFLICT', [409]),
    scenario('STALE_WRITE', [412], { effectProof: { status: 'PASS', probePath: '/resource/1', valuePath: '$.version', beforeHash: H, afterHash: H, sideEffectCreated: false } }),
    scenario('PERMISSION_CATALOG', [200]),
  ],
};
manifest.baG1Minutes = {
  issueKey: 'WWHN-183', status: 'PASS', decision: 'GO', sourceSha: SOURCE, artifactDigest: H,
  openP0: 0, openP1: 0, minutesPath: 'evidence/g1.md', minutesSha256: H2, baAccount: 'ba',
};

const permissionApproval = {
  schemaVersion: '3.0.0', task: 'WWHN-153', issueKey: 'WWHN-153', status: 'PASS',
  approverAccounts: ['be-rbac', 'ba', 'fe'], approverRoles: ['BE/RBAC', 'BA', 'FE'],
  runtimeLink: { sourceSha: SOURCE, buildId: 'build-immutable-1', environment: 'UAT', artifactDigest: H, summaryPath: 'evidence/summary.json', sha256SumsPath: 'evidence/SHA256SUMS' },
  runtimeCatalogSnapshot: { path: 'evidence/catalog-response.json', sha256: H2, requestId: 'req-catalog', missingCanonicalCodes: [] },
  backendPermissionCatalog: { path: 'backend/permission-catalog.json', sha256: H, version: '1.0.0', backendCommitSha: '6'.repeat(40) },
  endpointPermissionRoleMapping: [
    { endpointAction: 'POST /stocktake/sessions/:sessionId/apply-adjustment', permission: 'stocktake.adjust', roles: ['stock-controller'], approved: true },
    { endpointAction: 'GET /reports/inventory-xnt/export-excel', permission: 'report.export', roles: ['reporter'], approved: true },
    { endpointAction: 'POST /warranty/cases:TEMP_ONLY', permission: 'warranty.temp_only', roles: ['warranty'], approved: true },
  ],
};
const sourceProvenance = {
  schemaVersion: '1.0.0', task: 'WWHN-153', repository: 'Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE', branch: 'm1',
  resolutionStrategy: 'CI_HEAD', preRemediationHead: PARENT, expectedParentSha: PARENT,
  supersededReferences: [{ ref: 'old', reason: 'superseded' }],
};
const sourceContext = {
  status: 'PASS', isCi: true, repository: sourceProvenance.repository, branch: 'm1', sourceSha: SOURCE,
  executionSha: SOURCE, parentSha: PARENT, treeSha: TREE, runId: '123',
  runUrl: 'https://github.com/org/repo/actions/runs/123', artifactName: `wwhn-153-signoff-integrity-${SOURCE}`,
};

function evaluate(overrides = {}) {
  return evaluateWwhn153Signoff({ manifest: structuredClone(manifest), permissionApproval: structuredClone(permissionApproval), sourceProvenance: structuredClone(sourceProvenance), sourceContext: structuredClone(sourceContext), rootDir, ...overrides });
}

const pass = evaluate();
assert.equal(pass.integrityOk, true);
assert.equal(pass.finalAllowed, true);
assert.deepEqual([pass.openP0, pass.openP1, pass.openP2], [0, 0, 0]);

const badHashManifest = structuredClone(manifest);
badHashManifest.qa1Review.reviewedArtifacts = [{ sha256: H }];
assert.equal(evaluate({ manifest: badHashManifest }).finalAllowed, false);

const badProvenance = structuredClone(sourceContext);
badProvenance.parentSha = '9'.repeat(40);
assert.equal(evaluate({ sourceContext: badProvenance }).gates.find((gate) => gate.id === 'FE-SOURCE-PROVENANCE').status, 'FAIL');

const fakeEffect = structuredClone(manifest);
fakeEffect.qa2Runtime.scenarios.find((item) => item.id === 'IDEMPOTENCY_REPLAY').effectProof.afterReplayHash = H;
assert.equal(evaluate({ manifest: fakeEffect }).gates.find((gate) => gate.id === 'QA2-DIRECT-RUNTIME').status, 'FAIL');

const badCatalog = structuredClone(permissionApproval);
badCatalog.runtimeCatalogSnapshot.sha256 = H;
assert.equal(evaluate({ permissionApproval: badCatalog }).gates.find((gate) => gate.id === 'PERMISSION-APPROVAL').status, 'FAIL');

const pendingManifest = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'WWHN-153_SIGNOFF_MANIFEST.json'), 'utf8'));
const pendingApproval = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'WWHN-153_PERMISSION_APPROVAL.json'), 'utf8'));
const pendingProvenance = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'WWHN-153_FE_SOURCE_PROVENANCE.json'), 'utf8'));
const pending = evaluateWwhn153Signoff({ manifest: pendingManifest, permissionApproval: pendingApproval, sourceProvenance: pendingProvenance, sourceContext: { status: 'PENDING' }, rootDir });
assert.equal(pending.integrityOk, true);
assert.equal(pending.finalAllowed, false);
assert.deepEqual([pending.openP0, pending.openP1, pending.openP2], [2, 5, 0]);

console.log('WWHN-153 sign-off core self-tests: PASS');
