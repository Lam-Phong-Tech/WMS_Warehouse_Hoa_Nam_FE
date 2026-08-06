#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const contractOnly = process.argv.includes('--contract-only');
const rootDir = process.cwd();
const evidenceDir = path.resolve(
  rootDir,
  process.env.WWHN_153_RUNTIME_EVIDENCE_DIR || 'docs/evidence/wwhn-153/generated/local/qa2-live',
);
const apiBaseUrl = (process.env.WWHN_153_API_BASE_URL || '').replace(/\/$/, '');
const environment = process.env.WWHN_153_ENVIRONMENT || '';
const sourceSha = process.env.WWHN_153_SOURCE_SHA || '';
const buildId = process.env.WWHN_153_BUILD_ID || '';
const qa2Account = process.env.WWHN_153_QA2_ACCOUNT || '';
const deniedToken = process.env.WWHN_153_DENIED_TOKEN || '';
const allowedToken = process.env.WWHN_153_ALLOWED_TOKEN || '';
const SHA_40 = /^[a-f0-9]{40}$/i;
const FORBIDDEN_ENV = /^(local|ci|mock|test|synthetic)$/i;
const persistedFiles = [];
let callIndex = 0;

const runtimeContract = {
  schemaVersion: '2.0.0',
  task: 'WWHN-153/WWHN-182',
  evidenceRules: [
    'Direct HTTP only; no browser interception or mock server',
    'Separate sanitized request and response artifacts with SHA256',
    'Every business response must expose request_id/x-request-id',
    'Denied and stale writes require unchanged before/after effect probe',
    'Idempotency replay requires after-first = after-replay effect proof',
    'Authorization/cookie/token/secret values must never be persisted',
    'PERMISSION_CATALOG response hash must bind formal permission approval',
  ],
  requiredProbeShape: {
    permissionDeny: 'method/path/body/effectProbe(method/path/valuePath)',
    idempotency: 'method/path/body/changedBody/idempotencyKey/effectProbe(method/path/valuePath)',
    stale: 'method/path/body/staleIfMatch/effectProbe(method/path/valuePath)',
  },
};

if (contractOnly) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const output = path.join(evidenceDir, 'WWHN-153_RUNTIME_EVIDENCE_CONTRACT.json');
  fs.writeFileSync(output, `${JSON.stringify(runtimeContract, null, 2)}\n`);
  console.log(JSON.stringify({ contractOnly: true, output: path.relative(rootDir, output), ...runtimeContract }, null, 2));
  process.exit(0);
}

function required(name, value) {
  if (!String(value || '').trim()) throw new Error(`${name} is required for live runtime evidence.`);
  return value;
}

function parseProbe(name) {
  const raw = required(name, process.env[name]);
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must be valid JSON: ${error.message}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  for (const key of ['method', 'path']) required(`${name}.${key}`, value[key]);
  if (!value.path.startsWith('/')) throw new Error(`${name}.path must start with '/'.`);
  if (!value.effectProbe || typeof value.effectProbe !== 'object') throw new Error(`${name}.effectProbe is required.`);
  for (const key of ['method', 'path', 'valuePath']) required(`${name}.effectProbe.${key}`, value.effectProbe[key]);
  if (!value.effectProbe.path.startsWith('/')) throw new Error(`${name}.effectProbe.path must start with '/'.`);
  return value;
}

function sanitizeKey(key) {
  return /authorization|cookie|set-cookie|token|secret|password|api[-_]?key/i.test(key);
}

function sanitize(value, key = '') {
  if (sanitizeKey(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitize(child, childKey)]));
  }
  return value;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(fileName, value) {
  const fullPath = path.join(evidenceDir, fileName);
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
  persistedFiles.push(fullPath);
  return { path: path.relative(rootDir, fullPath).replaceAll('\\', '/'), sha256: sha256(fs.readFileSync(fullPath)) };
}

function valueAt(value, dottedPath) {
  if (dottedPath === '$' || dottedPath === '') return value;
  return dottedPath.replace(/^\$\.?/, '').split('.').filter(Boolean).reduce((current, part) => {
    if (current == null) return undefined;
    const index = /^\d+$/.test(part) ? Number(part) : part;
    return current[index];
  }, value);
}

function requestIdOf(headers, body) {
  const fromHeader = headers.get('x-request-id') || headers.get('request-id') || headers.get('x-correlation-id');
  if (fromHeader) return fromHeader;
  const candidates = [body?.request_id, body?.requestId, body?.meta?.request_id, body?.meta?.requestId, body?.error?.request_id];
  return candidates.find((item) => typeof item === 'string' && item.trim()) || '';
}

async function call({ scenario, label, method, requestPath, token, body, headers = {} }) {
  callIndex += 1;
  const requestHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...headers,
  };
  const url = new URL(`${apiBaseUrl}${requestPath}`);
  const requestArtifact = writeJson(`${String(callIndex).padStart(2, '0')}-${scenario}-${label}-request.json`, sanitize({
    scenario,
    label,
    method: method.toUpperCase(),
    url: url.toString(),
    headers: requestHeaders,
    body: body ?? null,
  }));

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers: requestHeaders,
    body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : JSON.stringify(body ?? {}),
    redirect: 'manual',
  });
  const raw = await response.text();
  let responseBody;
  try { responseBody = raw ? JSON.parse(raw) : null; } catch { responseBody = { raw }; }
  const responseHeaders = Object.fromEntries(response.headers.entries());
  const requestId = requestIdOf(response.headers, responseBody);
  const responseArtifact = writeJson(`${String(callIndex).padStart(2, '0')}-${scenario}-${label}-response.json`, sanitize({
    scenario,
    label,
    status: response.status,
    headers: responseHeaders,
    body: responseBody,
    requestId,
  }));
  return { status: response.status, body: responseBody, requestId, requestArtifact, responseArtifact };
}

function assertStatus(result, allowed, scenario) {
  if (!allowed.includes(result.status)) throw new Error(`${scenario}: expected HTTP ${allowed.join('/')}, received ${result.status}.`);
  if (!result.requestId) throw new Error(`${scenario}: response did not expose request_id/x-request-id.`);
}

async function readEffect(effectProbe, scenario, label) {
  const result = await call({
    scenario,
    label,
    method: effectProbe.method,
    requestPath: effectProbe.path,
    token: allowedToken,
    body: effectProbe.body,
    headers: effectProbe.headers,
  });
  assertStatus(result, effectProbe.expectedStatuses || [200], `${scenario}/${label}`);
  const value = valueAt(result.body, effectProbe.valuePath);
  if (value === undefined) throw new Error(`${scenario}/${label}: valuePath ${effectProbe.valuePath} was not found.`);
  return { ...result, value, valueHash: sha256(stableJson(value)) };
}

function artifactList(...results) {
  return results.flat().filter(Boolean).map((result) => result.requestArtifact);
}

function responseList(...results) {
  return results.flat().filter(Boolean).map((result) => result.responseArtifact);
}

function requestIds(...results) {
  return unique(results.flat().filter(Boolean).map((result) => result.requestId));
}

function unique(values) {
  return [...new Set(values)];
}

function permissionRows(value) {
  const candidate = Array.isArray(value) ? value : value?.data || value?.items || value?.rows || value?.permissions || [];
  return Array.isArray(candidate) ? candidate : [];
}

function permissionCode(row) {
  if (typeof row === 'string') return row.trim();
  return String(row?.code || row?.permission_code || row?.name || '').trim();
}

function canonicalPermissionCodes() {
  const source = fs.readFileSync(path.resolve(rootDir, 'src/shared/constants/wms-permissions.ts'), 'utf8');
  const block = source.match(/WMS_PERMISSION_CATALOG\s*=\s*\{([\s\S]*?)\}\s*as const/)?.[1] || '';
  const codes = [...block.matchAll(/:\s*["']([^"']+)["']/g)].map((match) => match[1]);
  if (codes.length === 0) throw new Error('Cannot parse WMS_PERMISSION_CATALOG.');
  return unique(codes);
}

function secretScan() {
  const rawSecrets = [deniedToken, allowedToken].filter(Boolean);
  const findings = [];
  for (const filePath of persistedFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const secret of rawSecrets) {
      if (secret.length >= 8 && content.includes(secret)) findings.push(`${path.basename(filePath)} contains raw credential.`);
    }
    if (/Bearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+\/-]{8,}/i.test(content)) findings.push(`${path.basename(filePath)} contains non-redacted bearer value.`);
    if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(content)) findings.push(`${path.basename(filePath)} contains JWT-like material.`);
  }
  if (findings.length) throw new Error(`Secret hygiene failed: ${findings.join(' ')}`);
  return { status: 'PASS', filesScanned: persistedFiles.length, findings: [] };
}

required('WWHN_153_API_BASE_URL', apiBaseUrl);
required('WWHN_153_ENVIRONMENT', environment);
required('WWHN_153_SOURCE_SHA', sourceSha);
required('WWHN_153_BUILD_ID', buildId);
required('WWHN_153_QA2_ACCOUNT', qa2Account);
required('WWHN_153_DENIED_TOKEN', deniedToken);
required('WWHN_153_ALLOWED_TOKEN', allowedToken);
if (!SHA_40.test(sourceSha)) throw new Error('WWHN_153_SOURCE_SHA must be an exact 40-hex commit SHA.');
if (FORBIDDEN_ENV.test(environment)) throw new Error('Runtime evidence environment must be DEV or UAT, not local/CI/mock/test/synthetic.');
if (deniedToken === allowedToken) throw new Error('Denied and allowed tokens must be different identities/credentials.');

const denyProbe = parseProbe('WWHN_153_PERMISSION_DENY_PROBE_JSON');
const idemProbe = parseProbe('WWHN_153_IDEMPOTENCY_PROBE_JSON');
const staleProbe = parseProbe('WWHN_153_STALE_PROBE_JSON');
required('WWHN_153_IDEMPOTENCY_PROBE_JSON.changedBody', idemProbe.changedBody);
required('WWHN_153_IDEMPOTENCY_PROBE_JSON.idempotencyKey', idemProbe.idempotencyKey);
required('WWHN_153_STALE_PROBE_JSON.staleIfMatch', staleProbe.staleIfMatch);
fs.mkdirSync(evidenceDir, { recursive: true });

const denyBefore = await readEffect(denyProbe.effectProbe, 'PERMISSION_DENY_403', 'effect-before');
const denied = await call({ scenario: 'PERMISSION_DENY_403', label: 'denied-write', method: denyProbe.method, requestPath: denyProbe.path, token: deniedToken, body: denyProbe.body, headers: denyProbe.headers });
assertStatus(denied, [403], 'PERMISSION_DENY_403');
const denyAfter = await readEffect(denyProbe.effectProbe, 'PERMISSION_DENY_403', 'effect-after');
if (denyBefore.valueHash !== denyAfter.valueHash) throw new Error('PERMISSION_DENY_403: denied request changed the effect probe.');

const idemBefore = await readEffect(idemProbe.effectProbe, 'IDEMPOTENCY_REPLAY', 'effect-before');
const idemHeaders = { ...(idemProbe.headers || {}), 'Idempotency-Key': idemProbe.idempotencyKey };
if (idemProbe.ifMatch) idemHeaders['If-Match'] = idemProbe.ifMatch;
const idemFirst = await call({ scenario: 'IDEMPOTENCY_REPLAY', label: 'first', method: idemProbe.method, requestPath: idemProbe.path, token: allowedToken, body: idemProbe.body, headers: idemHeaders });
assertStatus(idemFirst, idemProbe.successStatuses || [200, 201, 202], 'IDEMPOTENCY_REPLAY/first');
const idemAfterFirst = await readEffect(idemProbe.effectProbe, 'IDEMPOTENCY_REPLAY', 'effect-after-first');
const idemReplay = await call({ scenario: 'IDEMPOTENCY_REPLAY', label: 'replay', method: idemProbe.method, requestPath: idemProbe.path, token: allowedToken, body: idemProbe.body, headers: idemHeaders });
assertStatus(idemReplay, idemProbe.successStatuses || [200, 201, 202], 'IDEMPOTENCY_REPLAY/replay');
const idemAfterReplay = await readEffect(idemProbe.effectProbe, 'IDEMPOTENCY_REPLAY', 'effect-after-replay');
if (idemAfterFirst.valueHash !== idemAfterReplay.valueHash) throw new Error('IDEMPOTENCY_REPLAY: replay created a second side effect.');
const sameBusinessResult = stableJson(idemFirst.body) === stableJson(idemReplay.body) ||
  [idemFirst.body?.data?.id, idemFirst.body?.id].filter(Boolean).some((id) => id === idemReplay.body?.data?.id || id === idemReplay.body?.id);
if (!sameBusinessResult) throw new Error('IDEMPOTENCY_REPLAY: replay business result is inconsistent.');

const conflict = await call({ scenario: 'IDEMPOTENCY_CONFLICT', label: 'changed-payload', method: idemProbe.method, requestPath: idemProbe.path, token: allowedToken, body: idemProbe.changedBody, headers: idemHeaders });
assertStatus(conflict, [409], 'IDEMPOTENCY_CONFLICT');

const staleBefore = await readEffect(staleProbe.effectProbe, 'STALE_WRITE', 'effect-before');
const staleHeaders = { ...(staleProbe.headers || {}), 'If-Match': staleProbe.staleIfMatch };
if (staleProbe.idempotencyKey) staleHeaders['Idempotency-Key'] = staleProbe.idempotencyKey;
const stale = await call({ scenario: 'STALE_WRITE', label: 'stale-write', method: staleProbe.method, requestPath: staleProbe.path, token: allowedToken, body: staleProbe.body, headers: staleHeaders });
assertStatus(stale, [409, 412], 'STALE_WRITE');
const staleAfter = await readEffect(staleProbe.effectProbe, 'STALE_WRITE', 'effect-after');
if (staleBefore.valueHash !== staleAfter.valueHash) throw new Error('STALE_WRITE: rejected stale request changed the effect probe.');

const catalog = await call({ scenario: 'PERMISSION_CATALOG', label: 'catalog', method: 'GET', requestPath: '/permissions?per_page=500&status=active', token: allowedToken });
assertStatus(catalog, [200], 'PERMISSION_CATALOG');
const runtimeCodes = unique(permissionRows(catalog.body).map(permissionCode).filter(Boolean));
const canonicalCodes = canonicalPermissionCodes();
const missingCanonicalCodes = canonicalCodes.filter((code) => !runtimeCodes.includes(code));
if (missingCanonicalCodes.length) throw new Error(`PERMISSION_CATALOG: missing canonical codes: ${missingCanonicalCodes.join(', ')}.`);

const scenarios = [
  {
    id: 'PERMISSION_DENY_403', status: 'PASS', observedHttpStatuses: [denied.status],
    requestIds: requestIds(denyBefore, denied, denyAfter),
    requestArtifacts: artifactList(denyBefore, denied, denyAfter), responseArtifacts: responseList(denyBefore, denied, denyAfter),
    effectProof: { status: 'PASS', probePath: denyProbe.effectProbe.path, valuePath: denyProbe.effectProbe.valuePath, beforeHash: denyBefore.valueHash, afterHash: denyAfter.valueHash, sideEffectCreated: false },
  },
  {
    id: 'IDEMPOTENCY_REPLAY', status: 'PASS', observedHttpStatuses: [idemFirst.status, idemReplay.status],
    requestIds: requestIds(idemBefore, idemFirst, idemAfterFirst, idemReplay, idemAfterReplay),
    requestArtifacts: artifactList(idemBefore, idemFirst, idemAfterFirst, idemReplay, idemAfterReplay), responseArtifacts: responseList(idemBefore, idemFirst, idemAfterFirst, idemReplay, idemAfterReplay),
    sameBusinessResult, secondSideEffectCreated: false,
    effectProof: { status: 'PASS', probePath: idemProbe.effectProbe.path, valuePath: idemProbe.effectProbe.valuePath, beforeHash: idemBefore.valueHash, afterHash: idemAfterReplay.valueHash, afterFirstHash: idemAfterFirst.valueHash, afterReplayHash: idemAfterReplay.valueHash, secondSideEffectCreated: false },
  },
  {
    id: 'IDEMPOTENCY_CONFLICT', status: 'PASS', observedHttpStatuses: [conflict.status], requestIds: requestIds(conflict),
    requestArtifacts: artifactList(conflict), responseArtifacts: responseList(conflict), effectProof: null,
  },
  {
    id: 'STALE_WRITE', status: 'PASS', observedHttpStatuses: [stale.status], requestIds: requestIds(staleBefore, stale, staleAfter),
    requestArtifacts: artifactList(staleBefore, stale, staleAfter), responseArtifacts: responseList(staleBefore, stale, staleAfter),
    effectProof: { status: 'PASS', probePath: staleProbe.effectProbe.path, valuePath: staleProbe.effectProbe.valuePath, beforeHash: staleBefore.valueHash, afterHash: staleAfter.valueHash, sideEffectCreated: false },
  },
  {
    id: 'PERMISSION_CATALOG', status: 'PASS', observedHttpStatuses: [catalog.status], requestIds: requestIds(catalog),
    requestArtifacts: artifactList(catalog), responseArtifacts: responseList(catalog), effectProof: null,
    runtimeCodes, canonicalCodes, missingCanonicalCodes,
  },
];

const summaryPath = path.join(evidenceDir, 'WWHN-153_RUNTIME_API_SUMMARY.json');
const summary = {
  schemaVersion: '2.0.0', task: 'WWHN-153', issueKey: 'WWHN-182', status: 'PASS',
  generatedAt: new Date().toISOString(), sourceSha, buildId, environment, qa2Account,
  apiBaseUrl, synthetic: false, scenarios,
  permissionCatalogSnapshot: { responseArtifact: catalog.responseArtifact, requestId: catalog.requestId, runtimeCodes, canonicalCodes, missingCanonicalCodes },
  packageDigestAlgorithm: 'sha256(SHA256SUMS)',
  secretHygiene: null,
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
persistedFiles.push(summaryPath);
const hygiene = secretScan();
summary.secretHygiene = hygiene;
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

const sortedFiles = [...persistedFiles].sort((a, b) => a.localeCompare(b));
const sums = sortedFiles.map((filePath) => `${sha256(fs.readFileSync(filePath))}  ${path.relative(evidenceDir, filePath).replaceAll('\\', '/')}`).join('\n') + '\n';
const sumsPath = path.join(evidenceDir, 'SHA256SUMS');
fs.writeFileSync(sumsPath, sums);
const digest = sha256(sums);
const digestPath = path.join(evidenceDir, 'WWHN-153_RUNTIME_ARTIFACT_DIGEST.txt');
fs.writeFileSync(digestPath, `${digest}\n`);

console.log(JSON.stringify({
  status: 'PASS', sourceSha, buildId, environment, qa2Account,
  scenarioCount: scenarios.length,
  summaryPath: path.relative(rootDir, summaryPath),
  sha256SumsPath: path.relative(rootDir, sumsPath),
  sha256SumsSha256: sha256(sums),
  artifactDigest: digest,
  secretHygiene: hygiene,
}, null, 2));
